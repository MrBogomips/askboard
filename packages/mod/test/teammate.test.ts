import { describe, expect, test } from "bun:test";
import { LOCAL_API_VERSION, type PolledAsk } from "@askboard/contract";
import { register } from "../src/index.ts";
import type { AgentInfo, AgentStatus } from "../src/mod-api.ts";
import { answerAt, entryOf, pollOf, runningSession, SUB_AGENT, SUB_ASK } from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// Waking an idle in-process teammate (task 17.3; mod spec, "Push to a subagent", "Waking an idle
// teammate", "An event is pushed once"; design decision 7, the idle in-process teammate (G2) and
// Never). An append adds a row to an idle teammate's conversation without starting a turn, so an
// agent listed with a `teammateId` and the status `idle` is pushed to by one `$.session.send` to
// its agent ID, reported as a submit that was not dropped is. A send not delivered, as auto mode
// answers a mod's (D13), or one that rejects, falls back to the append. A busy teammate gets the
// append, a finished one nothing, and a subagent is pushed to as before.

/** An in-process teammate: its loop's ID, and its address in the team. */
const TEAMMATE = "a5d07e2c9b41f836";
const ADDRESS = "scout-2@review";
const TEAMMATE_ASK = "cache-ttl-h6v4";

const teammate = (status: AgentStatus, id = TEAMMATE): AgentInfo => ({
  id,
  teammateId: ADDRESS,
  name: "scout-2",
  type: "teammate",
  description: "review the cache",
  status,
});

const subagent = (status: AgentStatus): AgentInfo => ({
  id: SUB_AGENT,
  type: "general-purpose",
  description: "worker",
  status,
});

const setUp = async (agents: readonly AgentInfo[]) => {
  const fake = fakeModApi();
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  fake.handlers.agents = async () => agents;
  return { fake, hooks, api };
};

type SetUp = Awaited<ReturnType<typeof setUp>>;

const reports = (api: SetUp["api"]) => api.bodiesTo("/v1/mod/delivered");

const delivered = (via: "append" | "submit", askId = TEAMMATE_ASK) => ({
  version: LOCAL_API_VERSION,
  askId,
  cursor: "k3x9.1",
  via,
});

/** The teammate's ask, owned under `owner`: its loop's ID unless a test says otherwise. */
const teammateAsk = (owner = TEAMMATE): PolledAsk => entryOf(TEAMMATE_ASK, [answerAt(1)], owner);

/** One poll that lists `asks`, then the promise chains it left running. */
const polled = async ({ fake, api }: SetUp, ...asks: PolledAsk[]) => {
  api.answerPolls(pollOf(asks));
  await fake.tick();
  await settle();
};

/** Polls twice more, so that any report waiting has gone and any push owed has been made. */
const laterPolls = async ({ fake }: SetUp) => {
  await fake.tick();
  await fake.tick();
  await settle();
};

/** Two model requests of the agent: the second carries a row appended before the first. */
const twoRequests = async ({ hooks }: SetUp, agentId: string) => {
  await hooks.turnStep({ agentId, index: 0 });
  await hooks.turnStep({ agentId, index: 1 });
};

describe("an idle in-process teammate", () => {
  test("is woken by one send to its agent ID and no append, reported delivered once", async () => {
    const setup = await setUp([teammate("idle")]);
    const { fake, api } = setup;
    await polled(setup, teammateAsk());
    expect(fake.calls.send).toHaveLength(1);
    expect(fake.calls.send[0]?.to).toEqual({ agentId: TEAMMATE });
    expect(Object.keys(fake.calls.send[0] ?? {}).sort()).toEqual(["text", "to"]);
    expect(fake.calls.append).toEqual([]);
    expect(fake.calls.submit).toEqual([]);
    expect(reports(api)).toEqual([delivered("submit")]);
    // Pushed once: the polls that still list the event neither send nor append it again.
    await laterPolls(setup);
    expect(fake.calls.send).toHaveLength(1);
    expect(fake.calls.append).toEqual([]);
    expect(reports(api)).toEqual([delivered("submit")]);
  });

  test("carries in its send the same text an append would carry", async () => {
    const idle = await setUp([teammate("idle")]);
    await polled(idle, teammateAsk());
    const busy = await setUp([teammate("running")]);
    await polled(busy, teammateAsk());
    const sent = idle.fake.calls.send[0]?.text;
    expect(sent).toBeString();
    expect(sent).toBe(busy.fake.calls.append[0]?.message.content[0]?.text as string);
  });

  test("owning the ask under its team address, is sent to by its agent ID", async () => {
    const setup = await setUp([teammate("idle")]);
    const { fake, api } = setup;
    await polled(setup, teammateAsk(ADDRESS));
    expect(fake.calls.send.map((message) => message.to)).toEqual([{ agentId: TEAMMATE }]);
    expect(fake.calls.append).toEqual([]);
    expect(reports(api)).toEqual([delivered("submit")]);
  });

  test("respawned under its address, is reached in its live loop, not its finished one", async () => {
    const setup = await setUp([teammate("completed", "a0f1e2d3c4b5a697"), teammate("idle")]);
    await polled(setup, teammateAsk(ADDRESS));
    expect(setup.fake.calls.send.map((message) => message.to)).toEqual([{ agentId: TEAMMATE }]);
  });

  test("gets one send for asks owned under its agent ID and under its address alike", async () => {
    const setup = await setUp([teammate("idle")]);
    const other = entryOf("cache-size-r8j3", [answerAt(1)], ADDRESS);
    await polled(setup, teammateAsk(), other);
    expect(setup.fake.calls.send).toHaveLength(1);
    expect(reports(setup.api)).toEqual([
      delivered("submit"),
      delivered("submit", "cache-size-r8j3"),
    ]);
  });
});

describe("a send that is not delivered", () => {
  const refused = async () => ({
    isDelivered: false as const,
    reason: "The server-side auto mode classifier gave no verdict for SendMessage",
  });
  const rejected = async (): Promise<never> => {
    throw new Error("no such agent");
  };

  // The row appended while the teammate was idle is in the conversation when its next turn starts,
  // so that turn's first request carries it: the append is reported then, and the stop guard does
  // not carry the answer a second time.
  test("refused, its fallback append is reported at the first request of the teammate's next turn", async () => {
    const setup = await setUp([teammate("idle")]);
    const { fake, hooks, api } = setup;
    fake.handlers.send = refused;
    await polled(setup, teammateAsk());
    expect(fake.calls.append).toHaveLength(1);
    await hooks.turnStart({ agentId: TEAMMATE });
    await hooks.turnStep({ agentId: TEAMMATE });
    await laterPolls(setup);
    expect(reports(api)).toEqual([delivered("append")]);
  });

  test("a row appended after the next turn started waits for that turn's second request", async () => {
    const setup = await setUp([teammate("running")]);
    const { fake, hooks, api } = setup;
    await hooks.turnStart({ agentId: TEAMMATE });
    await polled(setup, teammateAsk());
    expect(fake.calls.append).toHaveLength(1);
    await hooks.turnStep({ agentId: TEAMMATE });
    await laterPolls(setup);
    expect(reports(api)).toEqual([]);
    await hooks.turnStep({ agentId: TEAMMATE, index: 1 });
    await laterPolls(setup);
    expect(reports(api)).toEqual([delivered("append")]);
  });

  test.each([
    ["refused, as auto mode refuses a mod's send (D13)", refused],
    ["rejected", rejected],
  ])(
    "%s, falls back to one append, reported once a request carries it, never twice",
    async (_case, answer) => {
      const setup = await setUp([teammate("idle")]);
      const { fake, api } = setup;
      fake.handlers.send = answer;
      await polled(setup, teammateAsk());
      expect(fake.calls.send).toHaveLength(1);
      expect(fake.calls.append).toHaveLength(1);
      expect(fake.calls.append[0]?.agentId).toBe(TEAMMATE);
      expect(fake.calls.append[0]?.message.content[0]?.text).toBe(fake.calls.send[0]?.text);
      // Reported the way an append to a subagent is: only once a request of the agent carries it.
      await laterPolls(setup);
      expect(reports(api)).toEqual([]);
      await twoRequests(setup, TEAMMATE);
      await laterPolls(setup);
      expect(reports(api)).toEqual([delivered("append")]);
      await twoRequests(setup, TEAMMATE);
      await laterPolls(setup);
      expect(fake.calls.send).toHaveLength(1);
      expect(fake.calls.append).toHaveLength(1);
      expect(reports(api)).toEqual([delivered("append")]);
    },
  );

  test("whose append fails too, is pushed again at the next poll, and reported once", async () => {
    const setup = await setUp([teammate("idle")]);
    const { fake, api } = setup;
    let delivering = false;
    fake.handlers.send = async () =>
      delivering ? { isDelivered: true } : { isDelivered: false, reason: "refused" };
    fake.handlers.append = async () => ({ deny: "refused by policy" });
    await polled(setup, teammateAsk());
    expect(fake.calls.send).toHaveLength(1);
    expect(fake.calls.append).toHaveLength(1);
    expect(reports(api)).toEqual([]);
    delivering = true;
    await laterPolls(setup);
    expect(fake.calls.send).toHaveLength(2);
    expect(fake.calls.append).toHaveLength(1);
    expect(reports(api)).toEqual([delivered("submit")]);
  });

  test("writes a debug line that names neither the agent's text nor the reason", async () => {
    const setup = await setUp([teammate("idle")]);
    const { fake } = setup;
    fake.handlers.send = async () => ({ isDelivered: false, reason: "secret-reason" });
    await polled(setup, teammateAsk());
    await laterPolls(setup);
    expect(fake.calls.log.length).toBeGreaterThan(0);
    for (const line of fake.calls.log) {
      expect(line).not.toContain("PostgreSQL");
      expect(line).not.toContain("secret-reason");
      expect(line).not.toContain(TEAMMATE);
      expect(line).not.toContain(ADDRESS);
    }
  });
});

describe("a teammate that is not idle", () => {
  test.each(["running", "pending", "waiting"] as const)(
    "%s, gets the append, as a subagent does",
    async (status) => {
      const setup = await setUp([teammate(status)]);
      const { fake, api } = setup;
      await polled(setup, teammateAsk(ADDRESS));
      expect(fake.calls.send).toEqual([]);
      expect(fake.calls.append.map((row) => row.agentId)).toEqual([TEAMMATE]);
      expect(reports(api)).toEqual([]);
      await twoRequests(setup, TEAMMATE);
      await laterPolls(setup);
      expect(reports(api)).toEqual([delivered("append")]);
    },
  );

  test.each(["completed", "failed", "killed"] as const)("%s, gets nothing", async (status) => {
    const setup = await setUp([teammate(status)]);
    const { fake, api } = setup;
    await polled(setup, teammateAsk());
    await polled(setup, teammateAsk(ADDRESS));
    expect(fake.calls.send).toEqual([]);
    expect(fake.calls.append).toEqual([]);
    expect(fake.calls.submit).toEqual([]);
    expect(reports(api)).toEqual([]);
  });
});

describe("a subagent", () => {
  test("listed as idle, with no teammate address, still gets the append and no send", async () => {
    const setup = await setUp([subagent("idle")]);
    const { fake, api } = setup;
    await polled(setup, entryOf(SUB_ASK, [answerAt(1)], SUB_AGENT));
    expect(fake.calls.send).toEqual([]);
    expect(fake.calls.append.map((row) => row.agentId)).toEqual([SUB_AGENT]);
    await twoRequests(setup, SUB_AGENT);
    await laterPolls(setup);
    expect(reports(api)).toEqual([delivered("append", SUB_ASK)]);
  });
});
