// The stand-in mod host (push delivery, task 9.1; design decision 11; the spine's Consistency
// Conventions, Tests): Claude Code's mod API, as much of it as AskBoard's mod uses, for the
// conformance suite. It loads a mod module, the built `hooks/askboard-mod.js` by default, and calls
// its `register(on)`. What reaches the machine is real: `$.process.run` starts processes as
// children of this suite, which stands for Claude Code, so the mod's `sh -c 'echo $PPID'` prints
// the PID that names the session file, as it does under Claude Code; `$.clock` is the system clock
// and its timers; `$.http.fetch` goes over the session's Unix socket; `$.fs` reads the real files.
// What would act on Claude Code is recorded instead: the agent list, the turn events the suite
// emits, appends, submits, toasts and the status entry. A member the host does not implement is a
// problem the suite reports, never a silent `undefined` (mod-host-api.ts).

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ApiOptions,
  emptyRecord,
  type HostApi,
  type HostedAgent,
  type HostRecord,
  type HostState,
  hostApi,
} from "./mod-host-api.ts";

export {
  type Exchange,
  FETCH_REFUSAL,
  type HostApi,
  type HostedAgent,
  type HostRecord,
  type Push,
} from "./mod-host-api.ts";

/** The plugin root, `$.plugin.root`: this checkout, which holds the built bundle and mod. */
export const PLUGIN_ROOT = join(import.meta.dir, "..", "..", "..", "..");

/** The built mod module, which `bun run build:mod` writes. */
export const MOD_MODULE = join(PLUGIN_ROOT, "hooks", "askboard-mod.js");

const WAIT_MS = 5_000;

type Next = (e: unknown) => unknown;
type Hook = (api: HostApi, e: unknown, next: Next) => unknown;

/** A mod module: what `hooks/hooks.json`'s `modules` names, exporting `register(on)`. */
export type ModModule = {
  readonly register: (on: (event: string, hook: Hook) => unknown) => void;
};

/** The events AskBoard's mod hooks, which the host emits when the suite says. */
const EMITTED = new Set(["session.start", "turn.start", "turn.step", "turn.complete"]);

export type ModHostOptions = Omit<ApiOptions, "root"> & {
  /** The mod: the built module by default. */
  readonly module?: ModModule;
  /** `$.plugin.root`: this checkout by default. */
  readonly root?: string;
  /** The agent list `$.agent.list()` gives until `setAgents` changes it. */
  readonly agents?: readonly HostedAgent[];
};

export type ModHost = {
  readonly record: HostRecord;
  setAgents(agents: readonly HostedAgent[]): void;
  /** Claude Code's session start: the mod learns its key and starts its poll. */
  sessionStart(): Promise<void>;
  /** A turn of the main conversation, or of the subagent `agentId` names. */
  turnStart(agentId?: string): Promise<void>;
  /** One model request of the agent's running turn, its stream read to its end. */
  turnStep(agentId?: string): Promise<void>;
  turnComplete(agentId?: string, isAborted?: boolean): Promise<void>;
  /** Waits until `probe` finds something in the record. */
  until<T>(probe: (record: HostRecord) => T | undefined, what: string, ms?: number): Promise<T>;
  /** Cancels the mod's timers, ends the processes it started, and waits for them. Idempotent. */
  stop(): Promise<void>;
};

type Events = Pick<ModHost, "sessionStart" | "turnStart" | "turnStep" | "turnComplete">;

/** Loads the mod and keeps the hooks its `register` gives, reporting an event never emitted. */
const registered = async (
  module: ModModule | undefined,
  problems: string[],
): Promise<Map<string, Hook[]>> => {
  const loaded = module ?? ((await import(pathToFileURL(MOD_MODULE).href)) as ModModule);
  const hooks = new Map<string, Hook[]>();
  loaded.register((event, hook) => {
    if (!EMITTED.has(event)) {
      problems.push(`the mod hooks ${event}, which the stand-in host never emits`);
    }
    hooks.set(event, [...(hooks.get(event) ?? []), hook]);
  });
  return hooks;
};

/** The events the suite emits, each through the mod's hooks, the last one calling `base`. */
const eventsOf = (hooks: Map<string, Hook[]>, $: HostApi, state: HostState): Events => {
  const emit = (event: string, input: unknown, base: Next): unknown => {
    const list = hooks.get(event) ?? [];
    const call = (at: number, e: unknown): unknown => {
      const hook = list[at];
      return hook === undefined ? base(e) : hook($, e, (next) => call(at + 1, next));
    };
    return call(0, input);
  };
  const noted = (event: string, agentId: string | undefined) =>
    state.record.events.push({ event, ...withAgent(agentId) });
  // Each agent's running turn: its ID and the requests it made.
  const turns = new Map<string, { readonly id: string; readonly steps: number }>();
  let started = 0;
  return {
    sessionStart: async () => {
      noted("session.start", undefined);
      const cwd = state.options.cwd;
      await emit("session.start", { cwd, isInteractive: true }, async () => ({ cwd }));
    },
    turnStart: async (agentId) => {
      started += 1;
      const turnId = `turn-${started}`;
      turns.set(agentId ?? "", { id: turnId, steps: 0 });
      noted("turn.start", agentId);
      await emit("turn.start", { text: "", turnId, ...withAgent(agentId) }, async () => ({
        turnId,
      }));
    },
    turnStep: async (agentId) => {
      const turn = turns.get(agentId ?? "") ?? { id: "turn-0", steps: 0 };
      turns.set(agentId ?? "", { ...turn, steps: turn.steps + 1 });
      noted("turn.step", agentId);
      const input = { turnId: turn.id, index: turn.steps, ...withAgent(agentId) };
      // biome-ignore lint/correctness/useYield: the model's stream here has no chunk to give.
      const stream = emit("turn.step", input, async function* () {
        return "step";
      }) as AsyncGenerator<unknown, unknown>;
      // The engine reads the response's chunks; the host only drains them.
      for (let step = await stream.next(); !step.done; step = await stream.next());
    },
    turnComplete: async (agentId, isAborted = false) => {
      const turnId = turns.get(agentId ?? "")?.id ?? "turn-0";
      noted("turn.complete", agentId);
      await emit("turn.complete", { turnId, isAborted, ...withAgent(agentId) }, async () => ({
        text: "",
      }));
    },
  };
};

const withAgent = (agentId: string | undefined) => (agentId === undefined ? {} : { agentId });

/** Loads the mod, registers it, and gives the host that runs it. */
export const createModHost = async (options: ModHostOptions): Promise<ModHost> => {
  const { module, agents, ...api } = options;
  const state: HostState = {
    options: { ...api, root: options.root ?? PLUGIN_ROOT },
    record: emptyRecord(),
    timers: new Set(),
    children: new Set(),
    agents: agents ?? [],
    stopped: false,
  };
  const $ = hostApi(state);
  const hooks = await registered(module, state.record.problems);
  return {
    record: state.record,
    setAgents: (next) => {
      state.agents = next;
    },
    ...eventsOf(hooks, $, state),
    until: async (probe, what, ms = WAIT_MS) => {
      const until = Date.now() + ms;
      for (;;) {
        const found = probe(state.record);
        if (found !== undefined) return found;
        if (Date.now() > until)
          throw new Error(`the stand-in mod host waited ${ms} ms for ${what}`);
        await Bun.sleep(10);
      }
    },
    stop: async () => {
      state.stopped = true;
      for (const timer of state.timers) clearInterval(timer);
      state.timers.clear();
      const running = [...state.children];
      for (const child of running) child.kill("SIGKILL");
      await Promise.all(running.map((child) => child.exited));
    },
  };
};
