import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
  type AgentRecord,
  type AskingRule,
  LOCAL_API_MAX_BYTES,
  LOCAL_API_ROUTES,
  LOCAL_API_VERSION,
  noticePath,
  OUTPUT_FORMAT_VERSION,
  type StopDecision,
} from "@askboard/contract";
import { validateLocalApi, validatePushMessage } from "@askboard/contract/validate";
import { plainChoiceAsk } from "../helpers.ts";
import {
  LINK,
  localRequest,
  PROJECT,
  post,
  removeRuntimeFolders,
  type TestApi,
  type TestApiOptions,
  testApi,
} from "./helpers.ts";

// Board-host spec, Stop decisions and Effective asking rule (design decision 2, task 4.6): the stop
// guard's decision, acted on in the same call; the rule `none` with whether a board can be shown;
// and an ask's title and link for the terminal link.

const { stop, rule, records } = LOCAL_API_ROUTES;
const SUBAGENT = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" } as const;
const OTHER = { agent_id: "b7c2e9f04d1a3e85", agent_type: "general-purpose" } as const;
const ASK_ID = "retry-policy-q3m8";

const runs: TestApi[] = [];
afterEach(async () => {
  for (const run of runs.splice(0)) await run.api.close();
});
afterAll(removeRuntimeFolders);

const started = async (options: TestApiOptions = {}) => {
  const run = testApi(options);
  runs.push(run);
  await run.api.start();
  return run;
};

const recordOf = (askId: string, toolUseId: string, agent: object): AgentRecord => ({
  version: LOCAL_API_VERSION,
  ...agent,
  cwd: PROJECT,
  tool_use_id: toolUseId,
  tool_name: "mcp__plugin_askboard_askboard__ask",
  askIds: [askId],
  timestamp: "2026-10-29T09:40:31Z",
});

const askAs = async (run: TestApi, askId: string, agent: object = SUBAGENT, fields = {}) => {
  const toolUseId = `toolu_${askId}`;
  await post(run.socket, records.path, recordOf(askId, toolUseId, agent));
  await run.core.ask(
    { ...plainChoiceAsk(askId), ...fields },
    { tool: "ask", askIds: [askId], toolUseId },
  );
};

// The user's answer to the ask's question, as its event.
const answer = (run: TestApi, askId: string) => {
  const outcome = run.core.answer(askId, {
    itemId: "database",
    rev: 1,
    choice: ["PostgreSQL"],
    when: "2026-10-29T09:41:27Z",
  });
  if (!outcome.ok) throw new Error(outcome.detail);
  return outcome.event;
};

const stopOf = async (run: TestApi, agent: object, active = false) => {
  const answered = await post(run.socket, stop.path, {
    version: LOCAL_API_VERSION,
    ...agent,
    stop_hook_active: active,
  });
  expect(answered.status).toBe(200);
  const checked = validateLocalApi("stopResponse", answered.json());
  if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
  return checked.value;
};

describe("the stop guard", () => {
  test("blocks once with the answer above received, carrying the push message, and raises received", async () => {
    const run = await started();
    await askAs(run, ASK_ID);
    await askAs(run, "retry-limit-w2n5");
    const appended = answer(run, ASK_ID);
    const decision = await stopOf(run, SUBAGENT);
    expect(decision).toEqual({
      version: LOCAL_API_VERSION,
      decision: "block",
      message: {
        versions: { output: OUTPUT_FORMAT_VERSION },
        epoch: run.core.epoch,
        asks: [
          {
            askId: ASK_ID,
            state: "answered",
            cursor: `${run.core.epoch}.1`,
            events: [appended],
          },
        ],
        openAsks: [
          { askId: ASK_ID, state: "answered", cursor: `${run.core.epoch}.1` },
          { askId: "retry-limit-w2n5", state: "waiting", cursor: `${run.core.epoch}.0` },
        ],
      },
    });
    expect(decision.decision === "block" && validatePushMessage(decision.message).ok).toBe(true);
    expect(run.core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(true);
    expect(await stopOf(run, SUBAGENT)).toEqual({ version: LOCAL_API_VERSION, decision: "allow" });
  });

  // PO decision of 2026-11-03 on AD-10 and AD-21: a discarded ask's tombstone is delivered too.
  test("blocks with a discarded ask's answer and its discard, listing no open ask", async () => {
    const run = await started();
    await askAs(run, ASK_ID);
    const appended = answer(run, ASK_ID);
    run.core.discardAll("session-exit");
    const decision = await stopOf(run, SUBAGENT);
    if (decision.decision !== "block") throw new Error("expected a block");
    expect(validatePushMessage(decision.message).ok).toBe(true);
    expect(decision.message.asks).toEqual([
      {
        askId: ASK_ID,
        state: "discarded",
        cursor: `${run.core.epoch}.2`,
        events: [
          appended,
          { cursor: `${run.core.epoch}.2`, type: "discarded", reason: "session-exit" },
        ],
      },
    ]);
    expect(decision.message.openAsks).toEqual([]);
    expect(await stopOf(run, SUBAGENT)).toEqual({ version: LOCAL_API_VERSION, decision: "allow" });
  });

  test("allows a stop that follows a block, leaving received where it is", async () => {
    const run = await started();
    await askAs(run, ASK_ID);
    answer(run, ASK_ID);
    expect((await stopOf(run, SUBAGENT, true)).decision).toBe("allow");
    expect(run.core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
  });

  test("allows an agent it has no record of, and one owning no ask, with no error", async () => {
    const run = await started();
    await askAs(run, ASK_ID);
    answer(run, ASK_ID);
    expect((await stopOf(run, { agent_id: "a0", agent_type: "" })).decision).toBe("allow");
    await post(run.socket, records.path, {
      ...recordOf(ASK_ID, "toolu_other", OTHER),
      tool_name: "mcp__askboard__collect",
    });
    await run.core.bind({ tool: "collect", askIds: [ASK_ID], toolUseId: "toolu_other" });
    expect((await stopOf(run, OTHER)).decision).toBe("allow");
    expect(run.core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
    expect(run.reported).toEqual([]);
  });
});

// Board-host spec, A teammate's stop is idle (tasks 17.2 and 18.2, G1): Claude Code fires
// SubagentStop at every turn end of an in-process teammate, whose agent ID is opaque. Its stop is
// blocked as a subagent's is, but one let through closes none of its asks. The mod's turn report
// says which agent is a teammate; an agent never reported either way is taken for one when its ID
// reads `a<agent_type>-<hex>`, so that a teammate is not closed with the mods off.
describe("an in-process teammate's stop", () => {
  // The ids of the PO's probe (task 17.6).
  const TEAMMATE = { agent_id: "aresearcher-096d99adc3d94b0a", agent_type: "researcher" } as const;
  const stateOf = (run: TestApi, askId: string) => run.core.lifecycleBoard(askId)?.state;
  const reportTurn = async (run: TestApi, agentId: string, teammate?: string) => {
    const body = { version: LOCAL_API_VERSION, agent_id: agentId, running: true };
    const sent = await post(run.socket, LOCAL_API_ROUTES.modTurn.path, {
      ...body,
      ...(teammate === undefined ? {} : { teammate }),
    });
    expect(sent.status).toBe(200);
  };

  test("reported a teammate, with nothing above received, is let through and leaves its ask waiting", async () => {
    const run = await started();
    await reportTurn(run, TEAMMATE.agent_id, "researcher");
    await askAs(run, ASK_ID, TEAMMATE);
    expect(await stopOf(run, TEAMMATE)).toEqual({ version: LOCAL_API_VERSION, decision: "allow" });
    expect(stateOf(run, ASK_ID)).toBe("waiting");
    // The user's answer still lands, and the teammate's next stop carries it.
    const appended = answer(run, ASK_ID);
    const decision = await stopOf(run, TEAMMATE);
    if (decision.decision !== "block") throw new Error("expected a block");
    expect(decision.message.asks).toEqual([
      { askId: ASK_ID, state: "answered", cursor: appended.cursor, events: [appended] },
    ]);
    expect(run.reported).toEqual([]);
  });

  test("reported a teammate, is blocked with an answer above received, and the stop after closes nothing", async () => {
    const run = await started();
    await askAs(run, ASK_ID, SUBAGENT);
    await reportTurn(run, SUBAGENT.agent_id, "scout-2");
    answer(run, ASK_ID);
    expect((await stopOf(run, SUBAGENT)).decision).toBe("block");
    expect(run.core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(true);
    expect((await stopOf(run, SUBAGENT, true)).decision).toBe("allow");
    expect(stateOf(run, ASK_ID)).toBe("answered");
  });

  test("reported no teammate, is finished even with a named agent's ID", async () => {
    const run = await started();
    await reportTurn(run, TEAMMATE.agent_id);
    await askAs(run, ASK_ID, TEAMMATE);
    expect((await stopOf(run, TEAMMATE)).decision).toBe("allow");
    expect(stateOf(run, ASK_ID)).toBe("closed");
  });

  test("never reported, mods off: a named agent's ID is idle, any other finished", async () => {
    const run = await started();
    await askAs(run, ASK_ID, TEAMMATE);
    await askAs(run, "retry-limit-w2n5", SUBAGENT);
    expect((await stopOf(run, TEAMMATE)).decision).toBe("allow");
    expect(stateOf(run, ASK_ID)).toBe("waiting");
    expect((await stopOf(run, SUBAGENT)).decision).toBe("allow");
    expect(stateOf(run, "retry-limit-w2n5")).toBe("closed");
    expect(stateOf(run, ASK_ID)).toBe("waiting");
  });
});

// Board-host spec, Stop decisions (review fix, task 13.5): a block holds what the response limit
// does, in order, and raises received only to its last event, so the hook never drops it.
describe("a stop whose events exceed the response limit", () => {
  const COUNT = 70;
  const label = "L".repeat(18_000);

  // The subagent's asks, each answered with a long option label: together over 1 MiB.
  const fill = async (run: TestApi) => {
    for (let index = 0; index < COUNT; index += 1) {
      const askId = `big-ask-${index}`;
      const option = `${label}${index}`;
      await askAs(run, askId, SUBAGENT, {
        items: [
          {
            type: "question",
            id: "database",
            props: { text: "Which one?", options: [{ label: option }, { label: "Other" }] },
          },
        ],
      });
      const outcome = run.core.answer(askId, {
        itemId: "database",
        rev: 1,
        choice: [option],
        when: "2026-10-29T09:41:27Z",
      });
      if (!outcome.ok) throw new Error(outcome.detail);
    }
  };

  const delivered = (run: TestApi, askId: string) =>
    run.core.board(askId)?.questions[0]?.answer?.delivered;

  test("blocks with the leading events that fit, and raises received to the last one only", async () => {
    const run = await started();
    await fill(run);
    const answered = await post(run.socket, stop.path, {
      version: LOCAL_API_VERSION,
      ...SUBAGENT,
      stop_hook_active: false,
    });
    expect(answered.status).toBe(200);
    expect(Buffer.byteLength(answered.text)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
    const decision = answered.json() as StopDecision;
    expect(validateLocalApi("stopResponse", decision).ok).toBe(true);
    if (decision.decision !== "block") throw new Error("expected a block");
    expect(validatePushMessage(decision.message).ok).toBe(true);
    const carried = decision.message.asks.map(({ askId }) => askId);
    expect(carried.length).toBeGreaterThan(0);
    expect(carried.length).toBeLessThan(COUNT);
    expect(carried).toEqual(carried.map((_, index) => `big-ask-${index}`));
    expect(decision.message.openAsks).toHaveLength(COUNT);
    for (let index = 0; index < COUNT; index += 1) {
      expect(delivered(run, `big-ask-${index}`)).toBe(index < carried.length);
    }
    // The rest stays above received: the next block, were the subagent to stop again, starts there.
    const next = await stopOf(run, SUBAGENT);
    if (next.decision !== "block") throw new Error("expected a second block");
    expect(next.message.asks[0]?.askId).toBe(`big-ask-${carried.length}`);
  });
});

// AD-20 (review fix M1): the subagent's asks of two questions, each answered by one board command
// of two events, together over 1 MiB. The block ends between commands, never inside one.
describe("a stop whose commands straddle the response limit", () => {
  const COUNT = 35;
  const label = "L".repeat(18_000);
  const ids = ["first", "second"];

  const fill = async (run: TestApi) => {
    for (let index = 0; index < COUNT; index += 1) {
      const askId = `pair-ask-${index}`;
      const optionOf = (n: number) => `${label}${index}-${n}`;
      await askAs(run, askId, SUBAGENT, {
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
  };

  test("blocks with whole commands only, and the next block starts at the next command", async () => {
    const run = await started();
    await fill(run);
    const decision = await stopOf(run, SUBAGENT);
    if (decision.decision !== "block") throw new Error("expected a block");
    const { asks } = decision.message;
    expect(asks.length).toBeGreaterThan(0);
    expect(asks.length).toBeLessThan(COUNT);
    for (const ask of asks) expect(ask.events).toHaveLength(2);
    const board = (index: number) => run.core.board(`pair-ask-${index}`);
    for (let index = 0; index < COUNT; index += 1) {
      const delivered = index < asks.length;
      expect(board(index)?.questions.map((question) => question.answer?.delivered)).toEqual([
        delivered,
        delivered,
      ]);
    }
    const next = await stopOf(run, SUBAGENT);
    if (next.decision !== "block") throw new Error("expected a second block");
    expect(next.message.asks[0]?.askId).toBe(`pair-ask-${asks.length}`);
    expect(next.message.asks[0]?.events).toHaveLength(2);
  });
});

describe("the effective asking rule", () => {
  test("is none until configuration, with whether a board can be shown", async () => {
    for (const showable of [true, false]) {
      const run = await started({ showable: async () => showable });
      const answered = await localRequest(run.socket, rule.path);
      expect(answered.status).toBe(200);
      expect(answered.json()).toEqual({ version: LOCAL_API_VERSION, rule: "none", showable });
      expect(validateLocalApi("ruleResponse", answered.json()).ok).toBe(true);
    }
  });

  test("is the one its source gives, read at each request, when the session process gives one", async () => {
    let current: AskingRule = "always";
    const run = await started({ rule: () => current });
    const first = await localRequest(run.socket, rule.path);
    expect(first.json()).toEqual({ version: LOCAL_API_VERSION, rule: "always", showable: true });
    expect(validateLocalApi("ruleResponse", first.json()).ok).toBe(true);
    current = "none";
    expect((await localRequest(run.socket, rule.path)).json()).toMatchObject({ rule: "none" });
  });

  test("a showability check that fails is reported and answered 500", async () => {
    const run = await started({
      showable: async () => {
        throw new Error("PATH unreadable");
      },
    });
    expect((await localRequest(run.socket, rule.path)).status).toBe(500);
    expect(run.reported).toHaveLength(1);
    expect(run.diagnosed).toEqual([`local API ${rule.method} ${rule.path} answered 500`]);
  });
});

describe("an ask's notice", () => {
  test("gives its title and board link", async () => {
    const run = await started();
    await run.core.ask(plainChoiceAsk(ASK_ID));
    const answered = await localRequest(run.socket, noticePath(ASK_ID));
    expect(answered.status).toBe(200);
    expect(answered.json()).toEqual({
      version: LOCAL_API_VERSION,
      title: "Which database should the order service use?",
      link: LINK(ASK_ID),
    });
    expect(validateLocalApi("noticeResponse", answered.json()).ok).toBe(true);
  });

  test("refuses an ask the session does not hold, and a request that names none", async () => {
    const run = await started();
    expect((await localRequest(run.socket, noticePath("never-asked"))).status).toBe(404);
    expect((await localRequest(run.socket, LOCAL_API_ROUTES.notice.path)).status).toBe(400);
    expect(
      (await localRequest(run.socket, `${LOCAL_API_ROUTES.notice.path}?askId=a%20b`)).status,
    ).toBe(400);
  });
});
