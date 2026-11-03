import { describe, expect, test } from "bun:test";
import { LOCAL_API_ROUTES, LOCAL_API_VERSION } from "@askboard/contract";
import { validateLocalApi } from "@askboard/contract/validate";
import { register } from "../src/index.ts";
import { clientCommand } from "../src/transport.ts";
import { runningSession, SUB_AGENT } from "./fake-local-api.ts";
import { fakeModApi, fakeOn, settle } from "./fake-mod-api.ts";

// Turn reports (task 8.3; mod spec, "Turn reports"; design decision 7; AD-4): at `turn.start` and
// `turn.complete` of the main conversation and of any subagent, the mod tells the local API whether
// the agent has a turn running, on a change only, through the path its polls take. A report that
// gets no answer is tried once more at the next poll, then dropped: the next change replaces it.

const ROUTE = LOCAL_API_ROUTES.modTurn.path;
const ROOT = "/plugins/askboard";

const setUp = async (options: { readonly read?: boolean } = {}) => {
  const fake = fakeModApi({ root: ROOT });
  const hooks = fakeOn(fake.api);
  register(hooks.on);
  await hooks.sessionStart();
  const api = runningSession(fake);
  // A first poll reads the session file, as the mod does before any turn of a real session.
  if (options.read !== false) {
    await fake.tick();
    await settle();
  }
  return { fake, hooks, api };
};

const turns = (api: ReturnType<typeof runningSession>) => api.bodiesTo(ROUTE);

const report = (running: boolean, agentId?: string) => ({
  version: LOCAL_API_VERSION,
  ...(agentId === undefined ? {} : { agent_id: agentId }),
  running,
});

// A whole turn of an agent, with its model requests.
const wholeTurn = async (hooks: ReturnType<typeof fakeOn>, agentId?: string, steps = 1) => {
  await hooks.turnStart({ agentId });
  for (let index = 0; index < steps; index += 1) await hooks.turnStep({ agentId, index });
  await hooks.turnComplete({ agentId });
  await settle();
};

describe("turn reports", () => {
  test("a subagent's turn start and completion are each reported once, valid against the contract", async () => {
    const { hooks, api } = await setUp();
    await wholeTurn(hooks, SUB_AGENT);
    expect(turns(api)).toEqual([report(true, SUB_AGENT), report(false, SUB_AGENT)]);
    for (const body of turns(api)) expect(validateLocalApi("modTurnRequest", body).ok).toBe(true);
  });

  test("the main conversation's reports name no agent", async () => {
    const { hooks, api } = await setUp();
    await wholeTurn(hooks);
    expect(turns(api)).toEqual([report(true), report(false)]);
  });

  test("a turn of ten model requests reports its start and its completion only", async () => {
    const { hooks, api } = await setUp();
    await wholeTurn(hooks, SUB_AGENT, 10);
    expect(turns(api)).toHaveLength(2);
  });

  test("only transitions: a start or a completion the agent is already in is not reported", async () => {
    const { hooks, api } = await setUp();
    await hooks.turnStart({ agentId: SUB_AGENT });
    await hooks.turnStart({ agentId: SUB_AGENT });
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await hooks.turnStart();
    await settle();
    expect(turns(api)).toEqual([report(true, SUB_AGENT), report(false, SUB_AGENT), report(true)]);
  });

  test("reports go in the order of the turns", async () => {
    const { fake, hooks, api } = await setUp();
    const answer = fake.handlers.fetch;
    // The first report's answer comes late: the second still goes after it.
    let first = true;
    fake.handlers.fetch = async (url, init) => {
      if (first && url.endsWith(ROUTE)) {
        first = false;
        await settle();
      }
      return answer(url, init);
    };
    await hooks.turnStart({ agentId: SUB_AGENT });
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await settle();
    await settle();
    expect(turns(api)).toEqual([report(true, SUB_AGENT), report(false, SUB_AGENT)]);
  });

  test("a turn before the session file was read is reported at the next poll", async () => {
    const { fake, hooks, api } = await setUp({ read: false });
    await hooks.turnComplete();
    await settle();
    expect(turns(api)).toEqual([]);
    await fake.tick();
    await settle();
    expect(turns(api)).toEqual([report(false)]);
  });

  test("a report that gets no answer is tried once more at the next poll, then dropped", async () => {
    const { fake, hooks, api } = await setUp();
    api.unreachable.add(ROUTE);
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await settle();
    await fake.tick();
    await settle();
    await fake.tick();
    await settle();
    expect(turns(api)).toEqual([report(false, SUB_AGENT), report(false, SUB_AGENT)]);
  });

  test("a later change replaces a report waiting for its retry", async () => {
    const { fake, hooks, api } = await setUp();
    api.unreachable.add(ROUTE);
    await hooks.turnComplete({ agentId: SUB_AGENT });
    await settle();
    api.unreachable.clear();
    await hooks.turnStart({ agentId: SUB_AGENT });
    await settle();
    await fake.tick();
    await settle();
    expect(turns(api)).toEqual([report(false, SUB_AGENT), report(true, SUB_AGENT)]);
  });

  test("a refused report is not retried", async () => {
    const { fake, hooks, api } = await setUp();
    api.refuse.set(ROUTE, 400);
    await hooks.turnComplete();
    await settle();
    await fake.tick();
    await settle();
    expect(turns(api)).toEqual([report(false)]);
  });

  test("go through the process client once fetch is refused", async () => {
    const { fake, hooks, api } = await setUp({ read: false });
    fake.handlers.run = async (argv) => {
      expect(argv.slice(0, 3)).toEqual([...clientCommand(ROOT)]);
      return api.client(argv.slice(3));
    };
    fake.handlers.fetch = async () => {
      throw new Error("$.http.fetch: network requests are refused by policy");
    };
    await fake.tick();
    await settle();
    await hooks.turnStart({ agentId: SUB_AGENT });
    await settle();
    const sent = api.requests.filter((request) => request.path === ROUTE);
    expect(sent).toEqual([
      { via: "client", method: "POST", path: ROUTE, body: report(true, SUB_AGENT) },
    ]);
  });

  test("never delay the turn: the hooks pass their events on with the report unanswered", async () => {
    const { fake, hooks } = await setUp();
    fake.handlers.fetch = () => new Promise(() => undefined);
    expect(await hooks.turnStart({ agentId: SUB_AGENT })).toEqual({ turnId: "turn" });
    expect(await hooks.turnComplete({ agentId: SUB_AGENT })).toEqual({ text: "" });
  });
});
