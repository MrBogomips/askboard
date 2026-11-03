import { describe, expect, test } from "bun:test";
import { LOCAL_API_ROUTES, LOCAL_API_VERSION } from "@askboard/contract";
import { validateLocalApi } from "@askboard/contract/validate";
import { register } from "../src/index.ts";
import type { AgentInfo } from "../src/mod-api.ts";
import { runningSession, SUB_AGENT } from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// A teammate's turn reports (task 18.1; mod spec, Turn reports; design decision 4, Origin, plan B):
// an in-process teammate's hook `agent_id` is opaque, so the mod, whose `$.agent.list()` lists it
// with a `teammateId` and a `name`, names it in its turn reports. The lookup starts when the turn
// changes and never holds the hook up; the report goes once it resolves, in the order of the turns.
// An agent listed without a `teammateId`, or one the list does not tell of, is named no teammate.

const ROUTE = LOCAL_API_ROUTES.modTurn.path;

// The ids of the PO's probe (task 17.6).
const TEAMMATE = "aresearcher-096d99adc3d94b0a";
const listedTeammate: AgentInfo = {
  id: TEAMMATE,
  teammateId: "researcher@session-653b7577",
  name: "researcher",
  type: "researcher",
  description: "research the retry policy",
  status: "running",
};
const listedSubagent: AgentInfo = {
  id: SUB_AGENT,
  type: "code-reviewer",
  description: "review the retry",
  status: "running",
};

const setUp = async (agents: () => Promise<readonly AgentInfo[]>) => {
  const fake = fakeModApi();
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  fake.handlers.agents = agents;
  await fake.tick();
  await settle();
  return { fake, hooks, api };
};

const report = (running: boolean, agentId?: string, teammate?: string) => ({
  version: LOCAL_API_VERSION,
  ...(agentId === undefined ? {} : { agent_id: agentId }),
  running,
  ...(teammate === undefined ? {} : { teammate }),
});

describe("a teammate's turn reports", () => {
  test("name it, with its listed name, at its turn's start and completion, valid against the contract", async () => {
    const { hooks, api } = await setUp(async () => [listedTeammate, listedSubagent]);
    await hooks.turnStart({ agentId: TEAMMATE });
    await hooks.turnComplete({ agentId: TEAMMATE });
    await settle();
    const bodies = api.bodiesTo(ROUTE);
    expect(bodies).toEqual([
      report(true, TEAMMATE, "researcher"),
      report(false, TEAMMATE, "researcher"),
    ]);
    for (const body of bodies) expect(validateLocalApi("modTurnRequest", body).ok).toBe(true);
  });

  test("a subagent listed without a teammateId, and the main conversation, are named no teammate", async () => {
    const { fake, hooks, api } = await setUp(async () => [listedTeammate, listedSubagent]);
    await hooks.turnStart({ agentId: SUB_AGENT });
    await hooks.turnStart();
    await settle();
    expect(api.bodiesTo(ROUTE)).toEqual([report(true, SUB_AGENT), report(true)]);
    // One lookup for the subagent; the main conversation's report needs none.
    expect(fake.calls.agentLists).toBe(1);
  });

  test("an agent the list does not hold, or a list that fails, gives a report naming none, and a log with no agent text", async () => {
    for (const agents of [
      async () => [listedSubagent],
      async (): Promise<readonly AgentInfo[]> => {
        throw new Error("the agent list is not ready");
      },
    ]) {
      const { fake, hooks, api } = await setUp(agents);
      await hooks.turnStart({ agentId: TEAMMATE });
      await settle();
      expect(api.bodiesTo(ROUTE)).toEqual([report(true, TEAMMATE)]);
      for (const line of fake.calls.log) {
        expect(line).not.toContain(TEAMMATE);
        expect(line).not.toContain("researcher");
      }
    }
  });

  test("an agent the list did not tell of is looked up again at its next change", async () => {
    let agents: readonly AgentInfo[] = [];
    const { hooks, api } = await setUp(async () => agents);
    await hooks.turnStart({ agentId: TEAMMATE });
    await settle();
    agents = [listedTeammate];
    await hooks.turnComplete({ agentId: TEAMMATE });
    await settle();
    expect(api.bodiesTo(ROUTE)).toEqual([
      report(true, TEAMMATE),
      report(false, TEAMMATE, "researcher"),
    ]);
  });

  test("a told agent is not looked up again", async () => {
    const { fake, hooks } = await setUp(async () => [listedTeammate]);
    await hooks.turnStart({ agentId: TEAMMATE });
    await hooks.turnComplete({ agentId: TEAMMATE });
    await hooks.turnStart({ agentId: TEAMMATE });
    await settle();
    expect(fake.calls.agentLists).toBe(1);
  });

  test("the turn's hook returns before the lookup resolves, and the reports keep the turns' order", async () => {
    let answer: (agents: readonly AgentInfo[]) => void = () => {};
    const listed = new Promise<readonly AgentInfo[]>((resolve) => {
      answer = resolve;
    });
    const { hooks, api } = await setUp(() => listed);
    await hooks.turnStart({ agentId: TEAMMATE });
    await hooks.turnStart();
    await settle();
    // Neither report goes while the teammate's lookup is pending: the second waits for the first.
    expect(api.bodiesTo(ROUTE)).toEqual([]);
    answer([listedTeammate]);
    await settle();
    expect(api.bodiesTo(ROUTE)).toEqual([report(true, TEAMMATE, "researcher"), report(true)]);
  });

  test("a teammate listed without a name is named by its address, cut to the contract's 256 characters", async () => {
    const unnamed = { ...listedTeammate, name: undefined };
    const long = { ...listedTeammate, id: SUB_AGENT, name: "n".repeat(300) };
    const { hooks, api } = await setUp(async () => [unnamed, long]);
    await hooks.turnStart({ agentId: TEAMMATE });
    await hooks.turnStart({ agentId: SUB_AGENT });
    await settle();
    const bodies = api.bodiesTo(ROUTE);
    expect(bodies).toEqual([
      report(true, TEAMMATE, "researcher"),
      report(true, SUB_AGENT, "n".repeat(256)),
    ]);
    for (const body of bodies) expect(validateLocalApi("modTurnRequest", body).ok).toBe(true);
  });

  test("a report retried at the next poll still names the teammate", async () => {
    const { fake, hooks, api } = await setUp(async () => [listedTeammate]);
    api.unreachable.add(ROUTE);
    await hooks.turnStart({ agentId: TEAMMATE });
    await settle();
    api.unreachable.clear();
    await fake.tick();
    await settle();
    expect(api.bodiesTo(ROUTE)).toEqual([
      report(true, TEAMMATE, "researcher"),
      report(true, TEAMMATE, "researcher"),
    ]);
  });
});
