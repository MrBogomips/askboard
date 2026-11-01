import { describe, expect, test } from "bun:test";
import { LOCAL_API_VERSION } from "@askboard/contract";
import { register } from "../src/index.ts";
import type { AgentInfo } from "../src/mod-api.ts";
import { answerAt, entryOf, pollOf, runningSession, SUB_AGENT, SUB_ASK } from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// A subagent's delivery report (task 13.1; mod spec, "An event is pushed once", "Delivery
// reports"; design decision 7, Turn tracking, review fix of 2026-11-01): an append to a subagent
// is reported only once a model request of that subagent starts after the append resolved, and
// from its turn's second request when it came before the first; never when the subagent's turn
// completes first, so that the stop guard carries the answer (AD-10). Requests are counted, never
// timed. Reports go with the next poll.

const OTHER_AGENT = "b71e0c55d9a24f13";

const running = (id: string): AgentInfo => ({
  id,
  type: "general-purpose",
  description: "worker",
  status: "running",
});

const setUp = async () => {
  const fake = fakeModApi();
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  fake.handlers.agents = async () => [running(SUB_AGENT), running(OTHER_AGENT)];
  return { fake, hooks, api };
};

type SetUp = Awaited<ReturnType<typeof setUp>>;

const reports = (api: SetUp["api"]) => api.bodiesTo("/v1/mod/delivered");

const DELIVERED = (seq: number) => ({
  version: LOCAL_API_VERSION,
  askId: SUB_ASK,
  cursor: `k3x9.${seq}`,
  via: "append",
});

/** One poll that lists the subagent's ask with answers up to `seq`, and so appends to it. */
const answered = async ({ fake, api }: SetUp, seq: number) => {
  const events = Array.from({ length: seq }, (_, index) => answerAt(index + 1));
  api.answerPolls(pollOf([entryOf(SUB_ASK, events, SUB_AGENT)]));
  await fake.tick();
  await settle();
};

/** Polls twice more, so that any report waiting has gone. */
const laterPolls = async ({ fake }: SetUp) => {
  await fake.tick();
  await fake.tick();
  await settle();
};

describe("an append to a subagent mid-turn", () => {
  test("is reported once the subagent's next request starts, at the next poll", async () => {
    const setup = await setUp();
    const { hooks, api } = setup;
    await hooks.turnStart({ agentId: SUB_AGENT });
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await answered(setup, 1);
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([DELIVERED(1)]);
  });

  // The review's case: the answer lands while the subagent writes its final reply.
  test("is never reported when the subagent's turn completes first, and is not pushed again", async () => {
    const setup = await setUp();
    const { fake, hooks, api } = setup;
    await hooks.turnStart({ agentId: SUB_AGENT });
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await answered(setup, 1);
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await laterPolls(setup);
    expect(fake.calls.append).toHaveLength(1);
    expect(reports(api)).toEqual([]);
    // A later run of the subagent's loop does not report it either: its turn completed first.
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
  });

  test("counts only that subagent's requests", async () => {
    const setup = await setUp();
    const { hooks, api } = setup;
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await answered(setup, 1);
    await hooks.turnStart();
    await hooks.turnStep({ index: 0 });
    await hooks.turnStep({ agentId: OTHER_AGENT, index: 0 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([DELIVERED(1)]);
  });

  test("reports two appends that one request carried once, up to the later cursor", async () => {
    const setup = await setUp();
    const { hooks, api } = setup;
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await answered(setup, 1);
    await answered(setup, 2);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([DELIVERED(2)]);
  });

  test("reports what a request carried, and not what was appended after it", async () => {
    const setup = await setUp();
    const { hooks, api } = setup;
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await answered(setup, 1);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await answered(setup, 2);
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await laterPolls(setup);
    expect(reports(api)).toEqual([DELIVERED(1)]);
  });
});

describe("an append to a subagent before its turn's first request", () => {
  test("is carried only from the turn's second request", async () => {
    const setup = await setUp();
    const { hooks, api } = setup;
    await hooks.turnStart({ agentId: SUB_AGENT });
    await answered(setup, 1);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([DELIVERED(1)]);
  });

  test("is not reported when the turn makes one request and completes", async () => {
    const setup = await setUp();
    const { hooks, api } = setup;
    await hooks.turnStart({ agentId: SUB_AGENT });
    await answered(setup, 1);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
  });

  test("of a subagent the mod saw nothing of yet, is carried from the second request", async () => {
    const setup = await setUp();
    const { hooks, api } = setup;
    await answered(setup, 1);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([DELIVERED(1)]);
  });
});

describe("an append whose subagent's turn completes while it is made", () => {
  test("is never reported", async () => {
    const setup = await setUp();
    const { fake, hooks, api } = setup;
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    fake.handlers.append = async () => {
      await hooks.turnComplete({ agentId: SUB_AGENT });
      return { uuid: "row" };
    };
    await answered(setup, 1);
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
  });
});

describe("a new session process", () => {
  test("forgets the appends of the old epoch: nothing is reported for them", async () => {
    const setup = await setUp();
    const { fake, hooks } = setup;
    await hooks.turnStep({ agentId: SUB_AGENT, index: 0 });
    await answered(setup, 1);
    const next = runningSession(fake, { epoch: "m7q2", pid: 48299 });
    next.answerPolls(pollOf([], [], { epoch: "m7q2" }));
    await fake.tick();
    await hooks.turnStep({ agentId: SUB_AGENT, index: 1 });
    await laterPolls(setup);
    expect(next.bodiesTo("/v1/mod/delivered")).toEqual([]);
  });
});
