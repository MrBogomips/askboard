import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  type AgentRecord,
  LOCAL_API_MAX_BYTES,
  LOCAL_API_ROUTES,
  LOCAL_API_VERSION,
  type PollResponse,
  pollPath,
} from "@askboard/contract";
import { validateLocalApi } from "@askboard/contract/validate";
import { plainChoiceAsk } from "../helpers.ts";
import {
  LINK,
  localRequest,
  PROJECT,
  post,
  removeRuntimeFolders,
  type TestApi,
  testApi,
} from "./helpers.ts";

// Board-host spec, Events for the mod, Pending asks, Local API answers at once (design decision 2,
// task 4.5): the mod's hello, its poll of owned asks' events above `received` with the pending asks,
// paged under 1 MiB, and its delivery reports, which raise `received`.

const { modHello, delivered, modTurn } = LOCAL_API_ROUTES;
const SUBAGENT = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" } as const;
const MAIN_ID = "order-db-choice-x7k2";
const SUB_ID = "retry-policy-q3m8";
const UNCHECKED_ID = "cache-choice-b5n1";

let run: TestApi;
beforeEach(async () => {
  run = testApi();
  await run.api.start();
});
afterEach(() => run.api.close());
afterAll(removeRuntimeFolders);

const record = (askId: string, toolUseId: string, agent?: typeof SUBAGENT): AgentRecord => ({
  version: LOCAL_API_VERSION,
  ...agent,
  cwd: PROJECT,
  tool_use_id: toolUseId,
  tool_name: "mcp__plugin_askboard_askboard__ask",
  askIds: [askId],
  timestamp: "2026-10-29T09:40:31Z",
});

// An ask created through ask-core, bound to the record its hook sent over the socket.
const askAs = async (askId: string, agent?: typeof SUBAGENT, fields: object = {}) => {
  const toolUseId = `toolu_${askId}`;
  expect(
    (await post(run.socket, LOCAL_API_ROUTES.records.path, record(askId, toolUseId, agent))).status,
  ).toBe(200);
  return run.core.ask(
    { ...plainChoiceAsk(askId), ...fields },
    { tool: "ask", askIds: [askId], toolUseId },
  );
};

// The user's answer to the ask's question, as its event.
const answer = (askId: string) => {
  const outcome = run.core.answer(askId, {
    itemId: "database",
    rev: 1,
    choice: ["PostgreSQL"],
    when: "2026-10-29T09:41:27Z",
  });
  if (!outcome.ok) throw new Error(outcome.detail);
  return outcome.event;
};

const poll = async (path = pollPath()): Promise<PollResponse> => {
  const answered = await localRequest(run.socket, path);
  expect(answered.status).toBe(200);
  const checked = validateLocalApi("pollResponse", answered.json());
  if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
  return checked.value;
};

describe("the mod's hello", () => {
  test("sets the client version from Claude Code's name and version", async () => {
    const reported = await post(run.socket, modHello.path, {
      version: LOCAL_API_VERSION,
      client: { name: "claude-code", version: "2.1.308" },
    });
    expect(reported.status).toBe(200);
    expect(validateLocalApi("modHelloResponse", reported.json()).ok).toBe(true);
    const outcome = await run.core.ask(plainChoiceAsk());
    expect(outcome).toMatchObject({ kind: "unsupported-version", version: "2.1.308" });
  });

  test("a hello from another client sets no version", async () => {
    await post(run.socket, modHello.path, {
      version: LOCAL_API_VERSION,
      client: { name: "other-client", version: "0.1.0" },
    });
    expect(await run.core.ask(plainChoiceAsk())).toMatchObject({ kind: "created" });
  });
});

describe("the poll", () => {
  test("is empty with no ask", async () => {
    expect(await poll()).toEqual({
      version: LOCAL_API_VERSION,
      epoch: run.core.epoch,
      asks: [],
      pending: [],
    });
  });

  test("gives an owned ask's events above received, with its owner's agent ID", async () => {
    await askAs(SUB_ID, SUBAGENT);
    const appended = answer(SUB_ID);
    const response = await poll();
    expect(response.asks).toEqual([
      {
        askId: SUB_ID,
        agent_id: SUBAGENT.agent_id,
        state: "answered",
        cursor: `${run.core.epoch}.1`,
        events: [appended],
      },
    ]);
  });

  test("gives the main conversation's ask with no agent ID", async () => {
    await askAs(MAIN_ID);
    answer(MAIN_ID);
    const [ask] = (await poll()).asks;
    expect(ask?.askId).toBe(MAIN_ID);
    expect(ask && "agent_id" in ask).toBe(false);
  });

  test("never lists an unchecked ask's events, nor an ask with nothing above received", async () => {
    await run.core.ask(plainChoiceAsk(UNCHECKED_ID));
    answer(UNCHECKED_ID);
    await askAs(MAIN_ID);
    expect((await poll()).asks).toEqual([]);
  });

  test("lists the pending asks by the Counting rule, an unchecked one as Agent", async () => {
    await askAs(MAIN_ID);
    await askAs(SUB_ID, SUBAGENT, { agentName: "Retry review", title: "How should we retry?" });
    await run.core.ask(plainChoiceAsk(UNCHECKED_ID));
    expect((await poll()).pending).toEqual([
      {
        askId: MAIN_ID,
        title: "Which database should the order service use?",
        label: "Main agent",
        openQuestions: 1,
        link: LINK(MAIN_ID),
      },
      {
        askId: SUB_ID,
        title: "How should we retry?",
        label: "Subagent code-reviewer",
        agentName: "Retry review",
        openQuestions: 1,
        link: LINK(SUB_ID),
        agent_id: SUBAGENT.agent_id,
      },
      {
        askId: UNCHECKED_ID,
        title: "Which database should the order service use?",
        label: "Agent",
        openQuestions: 1,
        link: LINK(UNCHECKED_ID),
      },
    ]);
  });

  test("an answer the agent has not received keeps its ask pending; once received, it goes", async () => {
    await askAs(MAIN_ID);
    answer(MAIN_ID);
    expect(
      (await poll()).pending.map(({ askId, openQuestions }) => [askId, openQuestions]),
    ).toEqual([[MAIN_ID, 1]]);
    run.core.delivered(MAIN_ID, `${run.core.epoch}.1`);
    expect((await poll()).pending).toEqual([]);
  });

  test("a discarded ask is not pending, and its discard is listed for its owner", async () => {
    await askAs(MAIN_ID);
    run.core.discardAll("session-exit");
    const response = await poll();
    expect(response.pending).toEqual([]);
    expect(response.asks[0]?.events).toEqual([
      { cursor: `${run.core.epoch}.1`, type: "discarded", reason: "session-exit" },
    ]);
  });

  test("a continuation of another session's ask starts again from the first", async () => {
    await askAs(MAIN_ID);
    answer(MAIN_ID);
    const response = await poll(pollPath({ askId: "gone-ask", seq: 4 }));
    expect(response.asks.map(({ askId }) => askId)).toEqual([MAIN_ID]);
  });

  test("a malformed continuation is refused", async () => {
    for (const query of [
      "askId=a",
      "seq=1",
      "askId=a&seq=-1",
      "askId=a%20b&seq=1",
      "askId=a&seq=x",
    ]) {
      const answered = await localRequest(run.socket, `${LOCAL_API_ROUTES.poll.path}?${query}`);
      expect(answered.status).toBe(400);
    }
  });
});

describe("paging", () => {
  // Many owned asks, each with a long answer label, whose events pass 1 MiB together.
  const fill = async (count: number) => {
    const label = "L".repeat(18_000);
    for (let index = 0; index < count; index += 1) {
      const askId = `big-ask-${index}`;
      const asked = await askAs(askId, undefined, {
        items: [
          {
            type: "question",
            id: "database",
            props: {
              text: "Which one?",
              options: [{ label: `${label}${index}` }, { label: "Other" }],
            },
          },
        ],
      });
      expect(asked).toMatchObject({ kind: "created" });
      run.core.answer(askId, {
        itemId: "database",
        rev: 1,
        choice: [`${label}${index}`],
        when: "2026-10-29T09:41:27Z",
      });
    }
  };

  test("a poll over 1 MiB stops at a whole event and says where the next one starts", async () => {
    await fill(70);
    const first = await localRequest(run.socket, pollPath());
    expect(Buffer.byteLength(first.text)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
    const page = first.json() as PollResponse;
    expect(page.more).toBe(true);
    const { continuation } = page;
    expect(continuation).toBeDefined();
    const seen = new Set(page.asks.map(({ askId }) => askId));
    expect(seen.has(continuation?.askId ?? "")).toBe(false);
    const rest = await poll(pollPath(continuation));
    expect(rest.more).toBeUndefined();
    for (const { askId } of rest.asks) expect(seen.has(askId)).toBe(false);
    expect(seen.size + rest.asks.length).toBe(70);
    expect(rest.asks[0]?.askId).toBe(continuation?.askId);
  });

  // AD-20 (review fix M1): asks of two questions, each answered by one board command of two
  // events, whose events pass 1 MiB together. No page ends inside a command.
  test("a poll over 1 MiB never splits one board command's events", async () => {
    const count = 35;
    const label = "L".repeat(18_000);
    const ids = ["first", "second"];
    for (let index = 0; index < count; index += 1) {
      const askId = `pair-ask-${index}`;
      const optionOf = (n: number) => `${label}${index}-${n}`;
      await askAs(askId, undefined, {
        items: ids.map((id, n) => ({
          type: "question",
          id,
          props: { text: "Which one?", options: [{ label: optionOf(n) }, { label: "Other" }] },
        })),
      });
      const acts = ids.map((itemId, n) => ({
        type: "answer" as const,
        itemId,
        rev: 1,
        choice: [optionOf(n)],
        when: "2026-10-29T09:41:27Z",
      }));
      const actionId = `action-${String(index).padStart(15, "0")}`;
      expect(run.core.act(askId, { actionId, acts })).toMatchObject({ ok: true });
    }
    const first = await localRequest(run.socket, pollPath());
    expect(Buffer.byteLength(first.text)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
    const page = first.json() as PollResponse;
    expect(page.more).toBe(true);
    for (const ask of page.asks) expect(ask.events).toHaveLength(2);
    expect(page.continuation?.seq).toBe(1);
    const rest = await poll(pollPath(page.continuation));
    expect(rest.asks[0]?.askId).toBe(page.continuation?.askId);
    for (const ask of rest.asks) expect(ask.events).toHaveLength(2);
    expect(page.asks.length + rest.asks.length).toBe(count);
  });

  test("a continuation inside a command, which no page gives, resumes at the command's start", async () => {
    const ids = ["first", "second"];
    await askAs(MAIN_ID, undefined, {
      items: ids.map((id) => ({
        type: "question",
        id,
        props: { text: "Which one?", options: [{ label: "PostgreSQL" }, { label: "SQLite" }] },
      })),
    });
    const acts = ids.map((itemId) => ({
      type: "answer" as const,
      itemId,
      rev: 1,
      choice: ["SQLite"],
      when: "2026-10-29T09:41:27Z",
    }));
    expect(run.core.act(MAIN_ID, { actionId: "action-000000000000001", acts })).toMatchObject({
      ok: true,
    });
    const rest = await poll(pollPath({ askId: MAIN_ID, seq: 2 }));
    expect(rest.asks[0]?.events.map(({ cursor }) => cursor)).toEqual(
      [1, 2].map((seq) => `${run.core.epoch}.${seq}`),
    );
  });

  test("a continuation inside an ask resumes at its seq, with the cursor of what it returns", async () => {
    await askAs(MAIN_ID);
    answer(MAIN_ID);
    run.core.discardAll("session-exit");
    const rest = await poll(pollPath({ askId: MAIN_ID, seq: 2 }));
    expect(rest.asks).toEqual([
      {
        askId: MAIN_ID,
        state: "discarded",
        cursor: `${run.core.epoch}.2`,
        events: [{ cursor: `${run.core.epoch}.2`, type: "discarded", reason: "session-exit" }],
      },
    ]);
  });
});

describe("delivery reports", () => {
  test("raise received, and the poll no longer lists what was delivered", async () => {
    await askAs(SUB_ID, SUBAGENT);
    answer(SUB_ID);
    const heard: string[] = [];
    run.core.subscribe((event) => heard.push(event.type));
    const reported = await post(run.socket, delivered.path, {
      version: LOCAL_API_VERSION,
      askId: SUB_ID,
      cursor: `${run.core.epoch}.1`,
      via: "append",
    });
    expect(reported.status).toBe(200);
    expect(validateLocalApi("deliveredResponse", reported.json()).ok).toBe(true);
    expect(heard).toEqual(["received"]);
    expect(run.core.board(SUB_ID)?.questions[0]?.answer?.delivered).toBe(true);
    expect((await poll()).asks).toEqual([]);
  });

  test("a report repeated is taken again, changing nothing", async () => {
    await askAs(SUB_ID, SUBAGENT);
    answer(SUB_ID);
    const report = {
      version: LOCAL_API_VERSION,
      askId: SUB_ID,
      cursor: `${run.core.epoch}.1`,
      via: "submit",
    };
    await post(run.socket, delivered.path, report);
    expect((await post(run.socket, delivered.path, report)).status).toBe(200);
  });

  test("a report no poll could have given is refused with 409, and received does not move", async () => {
    await run.core.ask(plainChoiceAsk(UNCHECKED_ID));
    answer(UNCHECKED_ID);
    const reported = await post(run.socket, delivered.path, {
      version: LOCAL_API_VERSION,
      askId: UNCHECKED_ID,
      cursor: `${run.core.epoch}.1`,
      via: "append",
    });
    expect(reported.status).toBe(409);
    expect(run.core.board(UNCHECKED_ID)?.questions[0]?.answer?.delivered).toBe(false);
  });
});

describe("turn reports (task 8.3)", () => {
  const turn = (running: boolean, agent?: typeof SUBAGENT) =>
    post(run.socket, modTurn.path, {
      version: LOCAL_API_VERSION,
      ...(agent === undefined ? {} : { agent_id: agent.agent_id }),
      running,
    });

  test("a subagent's turn ending makes its asks waiting, and its next turn working", async () => {
    await askAs(SUB_ID, SUBAGENT);
    await askAs(MAIN_ID);
    const ended = await turn(false, SUBAGENT);
    expect(ended.status).toBe(200);
    expect(validateLocalApi("modTurnResponse", ended.json()).ok).toBe(true);
    expect(run.core.agentStatus(SUB_ID)).toBe("waiting");
    expect(run.core.agentStatus(MAIN_ID)).toBe("working");
    await turn(true, SUBAGENT);
    expect(run.core.agentStatus(SUB_ID)).toBe("working");
  });

  test("a report with no agent ID is the main conversation's", async () => {
    await askAs(MAIN_ID);
    await askAs(SUB_ID, SUBAGENT);
    await turn(false);
    expect(run.core.agentStatus(MAIN_ID)).toBe("waiting");
    expect(run.core.agentStatus(SUB_ID)).toBe("working");
  });

  test("a report for an agent with no record yet is taken and changes nothing", async () => {
    await run.core.ask(plainChoiceAsk(UNCHECKED_ID));
    expect((await turn(false, SUBAGENT)).status).toBe(200);
    expect((await turn(false)).status).toBe(200);
    expect(run.core.agentStatus(UNCHECKED_ID)).toBe("working");
  });
});
