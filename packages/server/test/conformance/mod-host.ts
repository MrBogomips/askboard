// The stand-in mod host (push delivery, tasks 9.1 and 15.2; design decision 11; the spine's
// Consistency Conventions, Tests): Claude Code's mod API, as much of it as AskBoard's mod uses, for
// the conformance suite. It loads a mod module, the built `hooks/askboard-mod.js` by default, and
// calls its `register(on)`. What reaches the machine is real: `$.process.run` starts processes as
// children of this suite, which stands for Claude Code, so the mod's `sh -c 'echo $PPID'` prints
// the PID that names the session file, as it does under Claude Code; `$.clock` is the system clock
// and its timers; `$.http.fetch` goes over the session's Unix socket; `$.fs` reads the real files.
// What would act on Claude Code is recorded instead: the agent list, the turn events the suite
// emits, appends, submits, toasts, the status entry and the band's redraw requests. The band above
// the prompt is drawn when the suite says, through the mod's `ui.render` hook on `AbovePrompt`, and
// read back as rows (mod-host-band.ts); `$.session.surfaces` gives the terminal alone unless the
// suite gives others. A member the host does not implement, or a hook on an event or a component it
// never emits, is a problem the suite reports, never a silent `undefined` (mod-host-api.ts).

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
import {
  type AbovePromptInput,
  BAND_PROPS,
  type BandProps,
  BENEATH,
  rowsOf,
} from "./mod-host-band.ts";

export {
  type Exchange,
  FETCH_REFUSAL,
  type HostApi,
  type HostedAgent,
  type HostRecord,
  type Push,
} from "./mod-host-api.ts";

export {
  type AbovePromptInput,
  type BandElement,
  type BandProps,
  BENEATH_ROW,
} from "./mod-host-band.ts";

/** The plugin root, `$.plugin.root`: this checkout, which holds the built bundle and mod. */
export const PLUGIN_ROOT = join(import.meta.dir, "..", "..", "..", "..");

/** The built mod module, which `bun run build:mod` writes. */
export const MOD_MODULE = join(PLUGIN_ROOT, "hooks", "askboard-mod.js");

const WAIT_MS = 5_000;

type Next = (e: unknown) => unknown;

/** A hook as the mod registers it: `next` runs the hooks beneath, then the engine's own step. */
export type ModHook = (api: HostApi, e: unknown, next: Next) => unknown;

/** `on(event, hook)`, and `on(event, matcher, hook)` for a `ui.render` hook. */
export type ModOn = {
  (event: string, hook: ModHook): unknown;
  (event: string, matcher: Readonly<Record<string, unknown>>, hook: ModHook): unknown;
};

/** A mod module: what `hooks/hooks.json`'s `modules` names, exporting `register(on)`. */
export type ModModule = { readonly register: (on: ModOn) => void };

/** The band above the prompt: a `ui.render` hook with the `AbovePrompt` matcher. */
const BAND = `ui.render ${JSON.stringify({ component: "AbovePrompt" })}`;

/** The events AskBoard's mod hooks, which the host emits when the suite says, the band included. */
const EMITTED = new Set(["session.start", "turn.start", "turn.step", "turn.complete", BAND]);

export type ModHostOptions = Omit<ApiOptions, "root"> & {
  /** The mod: the built module by default. */
  readonly module?: ModModule;
  /** `$.plugin.root`: this checkout by default. */
  readonly root?: string;
  /** The agent list `$.agent.list()` gives until `setAgents` changes it. */
  readonly agents?: readonly HostedAgent[];
  /** The surfaces `$.session.surfaces()` gives until `setSurfaces` changes them: the terminal. */
  readonly surfaces?: readonly string[];
};

export type ModHost = {
  readonly record: HostRecord;
  setAgents(agents: readonly HostedAgent[]): void;
  setSurfaces(surfaces: readonly string[]): void;
  /** Claude Code's session start: the mod learns its key and starts its poll. */
  sessionStart(): Promise<void>;
  /** A turn of the main conversation, or of the subagent `agentId` names. */
  turnStart(agentId?: string): Promise<void>;
  /** One model request of the agent's running turn, its stream read to its end. */
  turnStep(agentId?: string): Promise<void>;
  turnComplete(agentId?: string, isAborted?: boolean): Promise<void>;
  /**
   * Draws the band above the prompt through the mod's `ui.render` hook on `AbovePrompt`, on a
   * terminal 200 cells wide unless `props` or `surface` say otherwise: its rows, as a terminal shows
   * them, or `undefined` when the hook passed to the plugins beneath (or the mod has none).
   */
  drawBand(props?: Partial<BandProps>, surface?: string): Promise<string[] | undefined>;
  /** Waits until `probe`, which may be asynchronous, finds something in the record. */
  until<T>(
    probe: (record: HostRecord) => T | undefined | Promise<T | undefined>,
    what: string,
    ms?: number,
  ): Promise<T>;
  /** Cancels the mod's timers, ends the processes it started, and waits for them. Idempotent. */
  stop(): Promise<void>;
};

type Events = Pick<ModHost, "sessionStart" | "turnStart" | "turnStep" | "turnComplete">;

/**
 * Loads the mod and keeps the hooks its `register` gives, each under its event and its matcher,
 * reporting one the host never emits.
 */
const registered = async (
  module: ModModule | undefined,
  problems: string[],
): Promise<Map<string, ModHook[]>> => {
  const loaded = module ?? ((await import(pathToFileURL(MOD_MODULE).href)) as ModModule);
  const hooks = new Map<string, ModHook[]>();
  loaded.register((event: string, ...rest: readonly unknown[]) => {
    const [matcher, hook] = rest.length > 1 ? rest : [undefined, rest[0]];
    const key = matcher === undefined ? event : `${event} ${JSON.stringify(matcher)}`;
    if (!EMITTED.has(key)) {
      problems.push(`the mod hooks ${key}, which the stand-in host never emits`);
    }
    hooks.set(key, [...(hooks.get(key) ?? []), hook as ModHook]);
  });
  return hooks;
};

type Emit = (event: string, input: unknown, base: Next) => unknown;

/** Emits an event through the mod's hooks, each calling the next, the last one calling `base`. */
const emitterOf =
  (hooks: Map<string, ModHook[]>, $: HostApi): Emit =>
  (event, input, base) => {
    const list = hooks.get(event) ?? [];
    const call = (at: number, e: unknown): unknown => {
      const hook = list[at];
      return hook === undefined ? base(e) : hook($, e, (next) => call(at + 1, next));
    };
    return call(0, input);
  };

/** The events the suite emits, each through the mod's hooks. */
const eventsOf = (emit: Emit, state: HostState): Events => {
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

/** The band drawn through its hooks, each draw with its own request ID; a pass gives no rows. */
const bandOf = (emit: Emit, state: HostState): ModHost["drawBand"] => {
  let draws = 0;
  return async (props = {}, surface = "terminal") => {
    draws += 1;
    const input: AbovePromptInput = {
      surface,
      component: "AbovePrompt",
      requestId: `band-${draws}`,
      props: { ...BAND_PROPS, ...props },
    };
    const drawn = await emit(BAND, input, async () => BENEATH);
    if (drawn === BENEATH) return undefined;
    try {
      return rowsOf(drawn);
    } catch (error) {
      state.record.problems.push((error as Error).message);
      throw error;
    }
  };
};

/** Loads the mod, registers it, and gives the host that runs it. */
export const createModHost = async (options: ModHostOptions): Promise<ModHost> => {
  const { module, agents, surfaces, ...api } = options;
  const state: HostState = {
    options: { ...api, root: options.root ?? PLUGIN_ROOT },
    record: emptyRecord(),
    timers: new Set(),
    children: new Set(),
    agents: agents ?? [],
    surfaces: surfaces ?? ["terminal"],
    stopped: false,
  };
  const $ = hostApi(state);
  const emit = emitterOf(await registered(module, state.record.problems), $);
  return {
    record: state.record,
    setAgents: (next) => {
      state.agents = next;
    },
    setSurfaces: (next) => {
      state.surfaces = next;
    },
    ...eventsOf(emit, state),
    drawBand: bandOf(emit, state),
    until: async (probe, what, ms = WAIT_MS) => {
      const until = Date.now() + ms;
      for (;;) {
        const found = await probe(state.record);
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
