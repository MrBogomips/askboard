import { describe, expect, test } from "bun:test";
import { LOCAL_API_VERSION, PUSH_MESSAGE_PREFACE, type PushMessage } from "@askboard/contract";
import { validatePushMessage } from "@askboard/contract/validate";
import { register } from "../src/index.ts";
import type { AgentInfo, AgentStatus } from "../src/mod-api.ts";
import {
  answerAt,
  entryOf,
  MAIN_ASK,
  pollOf,
  runningSession,
  SUB_AGENT,
  SUB_ASK,
} from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// The push paths (task 7.2; mod spec, "Push only to the ask's owner", "Push to a subagent", "Push
// to the main conversation", "An event is pushed once", "Delivery reports", "The push message";
// design decision 7, Per poll and Pushed once).

const OTHER_AGENT = "b71e0c55d9a24f13";
const OTHER_ASK = "log-level-p4r1";

const agent = (id: string, status: AgentStatus): AgentInfo => ({
  id,
  type: "general-purpose",
  description: "worker",
  status,
});

const setUp = async () => {
  const fake = fakeModApi();
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  return { fake, hooks, api };
};

/** The push message a pushed text carries, after its preface. */
const messageOf = (text: string): PushMessage => {
  const [preface, json, ...rest] = text.split("\n");
  expect(preface).toBe(PUSH_MESSAGE_PREFACE);
  expect(rest).toEqual([]);
  const checked = validatePushMessage(JSON.parse(json ?? ""));
  if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
  return checked.value;
};

const appendedText = (fake: ReturnType<typeof fakeModApi>, index: number): string =>
  fake.calls.append[index]?.message.content[0]?.text ?? "";

const reports = (api: ReturnType<typeof runningSession>) => api.bodiesTo("/v1/mod/delivered");

describe("push to a subagent", () => {
  test.each(["running", "pending", "waiting"] as const)(
    "appends to a %s subagent that owns the ask, with its agent ID, reported once a request carries it",
    async (status) => {
      const { fake, hooks, api } = await setUp();
      fake.handlers.agents = async () => [agent(SUB_AGENT, status)];
      api.answerPolls(pollOf([entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT)]));
      await fake.tick();
      expect(fake.calls.append).toHaveLength(1);
      expect(fake.calls.append[0]?.agentId).toBe(SUB_AGENT);
      expect(fake.calls.append[0]?.message.type).toBe("user");
      expect(messageOf(appendedText(fake, 0)).asks.map((ask) => ask.askId)).toEqual([SUB_ASK]);
      expect(fake.calls.submit).toEqual([]);
      // Not reported at the append (task 13.1): only once a later request of the subagent starts.
      expect(reports(api)).toEqual([]);
      await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
      await hooks.turnStep({ agentId: SUB_AGENT, index: 2 });
      // The report goes with the next poll, not from the hook.
      expect(reports(api)).toEqual([]);
      await fake.tick();
      expect(reports(api)).toEqual([
        { version: LOCAL_API_VERSION, askId: SUB_ASK, cursor: "k3x9.1", via: "append" },
      ]);
    },
  );

  test.each([
    ["completed", [agent(SUB_AGENT, "completed")]],
    ["failed", [agent(SUB_AGENT, "failed")]],
    ["killed", [agent(SUB_AGENT, "killed")]],
    ["absent", [agent(OTHER_AGENT, "running")]],
  ])("pushes nothing to a subagent that is %s, and reports nothing", async (_case, agents) => {
    const { fake, api } = await setUp();
    fake.handlers.agents = async () => agents;
    api.answerPolls(pollOf([entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT)]));
    await fake.tick();
    await fake.tick();
    expect(fake.calls.append).toEqual([]);
    expect(fake.calls.submit).toEqual([]);
    expect(reports(api)).toEqual([]);
  });

  test("pushes to a subagent once it is listed, at a later poll", async () => {
    const { fake, api } = await setUp();
    let agents: AgentInfo[] = [];
    fake.handlers.agents = async () => agents;
    api.answerPolls(pollOf([entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT)]));
    await fake.tick();
    agents = [agent(SUB_AGENT, "running")];
    await fake.tick();
    expect(fake.calls.append).toHaveLength(1);
  });

  test("asks for the agent list only when a subagent has something to push", async () => {
    const { fake, api } = await setUp();
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    expect(fake.calls.agentLists).toBe(0);
  });

  test("pushes nothing to subagents when the agent list cannot be read", async () => {
    const { fake, api } = await setUp();
    fake.handlers.agents = async () => {
      throw new Error("no list");
    };
    api.answerPolls(
      pollOf([entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT), entryOf(MAIN_ASK, [answerAt(1)])]),
    );
    await fake.tick();
    await settle();
    expect(fake.calls.append).toEqual([]);
    expect(fake.calls.submit).toHaveLength(1);
  });
});

describe("push to the main conversation", () => {
  test("submits to an idle main conversation, as the plugin, never as the user", async () => {
    const { fake, api } = await setUp();
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    expect(fake.calls.append).toEqual([]);
    expect(fake.calls.submit).toHaveLength(1);
    expect(Object.keys(fake.calls.submit[0] ?? {})).toEqual(["text"]);
    expect(messageOf(fake.calls.submit[0]?.text ?? "").asks.map((ask) => ask.askId)).toEqual([
      MAIN_ASK,
    ]);
    expect(reports(api)).toEqual([
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.1", via: "submit" },
    ]);
  });

  test("appends while a main turn runs, with no agent ID, reported once the append succeeds", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    expect(fake.calls.submit).toEqual([]);
    expect(fake.calls.append).toHaveLength(1);
    expect(fake.calls.append[0]?.agentId).toBeUndefined();
    expect(reports(api)).toEqual([
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.1", via: "append" },
    ]);
    // Whether a request carried the row is counted in requests, never by the clock (task 13.1).
    expect(fake.calls.reached).not.toContain("clock.now");
  });

  test("submits again once the main turn has completed", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart();
    await hooks.turnComplete();
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    expect(fake.calls.append).toEqual([]);
    expect(fake.calls.submit).toHaveLength(1);
  });

  test("a subagent's turn does not make the main conversation busy", async () => {
    const { fake, hooks, api } = await setUp();
    await hooks.turnStart({ agentId: SUB_AGENT });
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
  });

  test("still pushes after /clear, which leaves the poll running", async () => {
    const { fake, api } = await setUp();
    await fake.tick();
    // /clear fires session.end, which the mod does not hook, and no session.start.
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
  });
});

describe("one push message per agent and poll", () => {
  test("carries every new event of the agent's asks, each entry as collect returns it", async () => {
    const { fake, hooks, api } = await setUp();
    fake.handlers.agents = async () => [agent(SUB_AGENT, "running"), agent(OTHER_AGENT, "running")];
    api.answerPolls(
      pollOf([
        entryOf(MAIN_ASK, [answerAt(1), answerAt(2, "SQLite")]),
        entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT),
        entryOf("retry-limit-w2n5", [answerAt(3)], SUB_AGENT),
        entryOf(OTHER_ASK, [answerAt(1, "info")], OTHER_AGENT),
        entryOf("order-cache-m2t6", [answerAt(1)]),
      ]),
    );
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
    expect(fake.calls.append.map((row) => row.agentId)).toEqual([SUB_AGENT, OTHER_AGENT]);
    const main = messageOf(fake.calls.submit[0]?.text ?? "");
    expect(main.epoch).toBe("k3x9");
    expect(main.asks.map((ask) => [ask.askId, ask.events.length])).toEqual([
      [MAIN_ASK, 2],
      ["order-cache-m2t6", 1],
    ]);
    expect(main.asks[0] as unknown).toEqual(
      entryOf(MAIN_ASK, [answerAt(1), answerAt(2, "SQLite")]),
    );
    expect(messageOf(appendedText(fake, 0)).asks.map((ask) => ask.askId)).toEqual([
      SUB_ASK,
      "retry-limit-w2n5",
    ]);
    expect(messageOf(appendedText(fake, 1)).asks.map((ask) => ask.askId)).toEqual([OTHER_ASK]);
    // The main conversation's at once; each subagent's once two of its requests have started.
    expect(reports(api)).toHaveLength(2);
    for (const agentId of [SUB_AGENT, OTHER_AGENT]) {
      await hooks.turnStep({ agentId, index: 0 });
      await hooks.turnStep({ agentId, index: 1 });
    }
    await fake.tick();
    expect(reports(api)).toHaveLength(5);
  });
});

describe("an event is pushed once per epoch", () => {
  test("pushes only the events it has not pushed, while the poll still lists the old ones", async () => {
    const { fake, api } = await setUp();
    api.answerPolls(
      pollOf([entryOf(MAIN_ASK, [answerAt(1)])]),
      pollOf([entryOf(MAIN_ASK, [answerAt(1)])]),
      pollOf([entryOf(MAIN_ASK, [answerAt(1), answerAt(2, "SQLite")])]),
    );
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(2);
    const second = messageOf(fake.calls.submit[1]?.text ?? "");
    expect(second.asks[0]?.events.map((event) => event.cursor)).toEqual(["k3x9.2"]);
    expect(second.asks[0]?.cursor).toBe("k3x9.2");
  });

  test("pushes the same ask and seq again under a new epoch", async () => {
    const { fake, api } = await setUp();
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    const next = runningSession(fake, { epoch: "m7q2", pid: 48299 });
    next.answerPolls(
      pollOf([entryOf(MAIN_ASK, [answerAt(1, "PostgreSQL", "m7q2")])], [], { epoch: "m7q2" }),
    );
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(2);
    expect(messageOf(fake.calls.submit[1]?.text ?? "").epoch).toBe("m7q2");
  });
});

describe("delivery reports", () => {
  test("reports nothing for an append that throws, and pushes it at the next poll", async () => {
    const { fake, hooks, api } = await setUp();
    fake.handlers.agents = async () => [agent(SUB_AGENT, "running")];
    let failing = true;
    fake.handlers.append = async () => {
      if (failing) throw new Error("no loop");
      return { uuid: "row" };
    };
    api.answerPolls(pollOf([entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT)]));
    await fake.tick();
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await fake.tick();
    expect(reports(api)).toEqual([]);
    failing = false;
    await fake.tick();
    expect(fake.calls.append).toHaveLength(3);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 2 });
    await fake.tick();
    expect(reports(api)).toHaveLength(1);
  });

  test("reports nothing for an append a hook refused, and pushes it at the next poll", async () => {
    const { fake, api } = await setUp();
    fake.handlers.agents = async () => [agent(SUB_AGENT, "running")];
    fake.handlers.append = async () => ({ deny: "refused by policy" });
    api.answerPolls(pollOf([entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT)]));
    await fake.tick();
    await fake.tick();
    expect(fake.calls.append).toHaveLength(2);
    expect(reports(api)).toEqual([]);
  });

  test("reports nothing for a dropped submit, and does not push it again by poll", async () => {
    const { fake, api } = await setUp();
    fake.handlers.submit = async () => ({ drop: "the session was stopped" });
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
    expect(reports(api)).toEqual([]);
  });

  test("reports nothing for a submit that rejects, and pushes it at the next poll", async () => {
    const { fake, api } = await setUp();
    let failing = true;
    fake.handlers.submit = async ({ text }) => {
      if (failing) throw new Error("refused");
      return { text };
    };
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    expect(reports(api)).toEqual([]);
    failing = false;
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(2);
    expect(reports(api)).toHaveLength(1);
  });

  test("reports a submit only once its turn has started", async () => {
    const { fake, api } = await setUp();
    let started = (_value: { text: string }) => {};
    fake.handlers.submit = () =>
      new Promise((resolve) => {
        started = resolve;
      });
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    expect(reports(api)).toEqual([]);
    started({ text: "" });
    await settle();
    expect(reports(api)).toHaveLength(1);
  });

  test("retries a report that could not be sent at the next poll, alone", async () => {
    const { fake, api } = await setUp();
    api.unreachable.add("/v1/mod/delivered");
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    api.unreachable.clear();
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
    expect(reports(api)).toEqual([
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.1", via: "submit" },
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.1", via: "submit" },
    ]);
    // The retry goes before the poll, on its own.
    const paths = api.paths();
    const retry = paths.lastIndexOf("POST /v1/mod/delivered");
    expect(paths[retry + 1]).toBe("GET /v1/mod/poll");
  });

  test("keeps only the latest report of an ask to retry", async () => {
    const { fake, api } = await setUp();
    api.unreachable.add("/v1/mod/delivered");
    api.answerPolls(
      pollOf([entryOf(MAIN_ASK, [answerAt(1)])]),
      pollOf([entryOf(MAIN_ASK, [answerAt(1), answerAt(2, "SQLite")])]),
    );
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    api.unreachable.clear();
    const before = reports(api).length;
    await fake.tick();
    await settle();
    expect(reports(api).slice(before)).toEqual([
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.2", via: "submit" },
    ]);
  });

  test("retries a report the local API answered with a server error (task 13.2)", async () => {
    const { fake, api } = await setUp();
    api.refuse.set("/v1/mod/delivered", 503);
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    api.refuse.clear();
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    expect(fake.calls.submit).toHaveLength(1);
    expect(reports(api)).toEqual([
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.1", via: "submit" },
      { version: LOCAL_API_VERSION, askId: MAIN_ASK, cursor: "k3x9.1", via: "submit" },
    ]);
  });

  test.each([400, 404, 409])(
    "does not retry a report the local API refused with %i",
    async (status) => {
      const { fake, api } = await setUp();
      api.refuse.set("/v1/mod/delivered", status);
      api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
      await fake.tick();
      await settle();
      await fake.tick();
      await settle();
      expect(reports(api)).toHaveLength(1);
    },
  );

  test("retries a report whose acknowledgement is outside the contract", async () => {
    const { fake, api } = await setUp();
    const answering = fake.handlers.fetch;
    let wrong = true;
    fake.handlers.fetch = async (url, init) => {
      const response = await answering(url, init);
      if (!url.endsWith("/v1/mod/delivered") || !wrong) return response;
      return { ...response, text: JSON.stringify({ version: "2.0" }) };
    };
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    wrong = false;
    await fake.tick();
    await settle();
    expect(reports(api)).toHaveLength(2);
  });

  test("forgets the reports of an old epoch", async () => {
    const { fake, api } = await setUp();
    api.unreachable.add("/v1/mod/delivered");
    api.answerPolls(pollOf([entryOf(MAIN_ASK, [answerAt(1)])]));
    await fake.tick();
    await settle();
    const next = runningSession(fake, { epoch: "m7q2", pid: 48299 });
    next.answerPolls(pollOf([], [], { epoch: "m7q2" }));
    await fake.tick();
    await settle();
    expect(next.paths()).not.toContain("POST /v1/mod/delivered");
  });
});
