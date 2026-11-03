// A fake of the mod API subset (`src/mod-api.ts`) for the mod's tests: every call is recorded, the
// file system is a map, the clock is the test's, and each call the mod makes on Claude Code
// (process runs, fetches, appends, sends, submits, the agent list) goes to a handler the test can
// replace.
// A `find` run, the mod's check of the session folder and file, is answered from the fake's file
// system, with each path's owner and mode, as BSD and GNU `find` answer it, and recorded apart from
// the other runs. `fakeOn` stands for the engine's `on`: it keeps each hook and fires it as the
// engine would, and draws the band through the mod's `ui.render` hook as text rows (`fake-band.ts`).

import type {
  AbovePromptHook,
  AbovePromptInput,
  AgentInfo,
  HttpInit,
  HttpResponse,
  ModApi,
  ModHooks,
  On,
  ProcessRunInit,
  ProcessRunResult,
  PromptSubmitArgs,
  PromptSubmitResult,
  RenderElement,
  SessionAppendArgs,
  SessionAppendResult,
  SessionSendArgs,
  SessionSendResult,
  TurnCompleteInput,
  TurnStartInput,
  TurnStepInput,
} from "../src/mod-api.ts";
import { BENEATH, FAKE_ELEMENTS, rowsOf } from "./fake-band.ts";

/** The command the mod runs once at session start for the Claude Code PID and the uid. */
export const PID_COMMAND = ["sh", "-c", `printf '%s %s' "$PPID" "$(id -u)"`];

export type FakeOptions = {
  readonly pid?: number;
  readonly uid?: number;
  readonly env?: { readonly XDG_RUNTIME_DIR?: string; readonly TMPDIR?: string };
  readonly root?: string;
  readonly version?: string;
};

export type Fetched = { readonly url: string; readonly init: HttpInit | undefined };
export type Ran = { readonly argv: readonly string[]; readonly init: ProcessRunInit | undefined };

/** What the mod did, call by call, in order. */
export type Calls = {
  readonly env: string[];
  /** The process runs but `find`'s. */
  readonly run: Ran[];
  /** The `find` runs, each answered from the fake's file system. */
  readonly find: Ran[];
  readonly fetch: Fetched[];
  readonly append: SessionAppendArgs[];
  readonly send: SessionSendArgs[];
  readonly submit: PromptSubmitArgs[];
  readonly status: (string | undefined)[];
  readonly toast: string[];
  /** Each `$.ui.invalidate` call's event. */
  readonly invalidate: string[];
  readonly log: string[];
  agentLists: number;
  /** The names of every `$` member the mod reached, such as `session.append`. */
  readonly reached: string[];
};

export type Handlers = {
  /** A command other than the PID command. */
  run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>;
  fetch: (url: string, init?: HttpInit) => Promise<HttpResponse>;
  append: (args: SessionAppendArgs) => Promise<SessionAppendResult>;
  /** A message to an agent: delivered unless the test says otherwise. */
  send: (args: SessionSendArgs) => Promise<SessionSendResult>;
  submit: (args: PromptSubmitArgs) => Promise<PromptSubmitResult>;
  agents: () => Promise<readonly AgentInfo[]>;
  /** The surfaces the session draws on: the terminal alone unless the test says otherwise. */
  surfaces: () => Promise<readonly string[]>;
};

type Interval = { readonly ms: number; readonly fn: () => unknown; cancelled: boolean };

const missing = (path: string): Error =>
  Object.assign(new Error(`ENOENT: no such file or directory, ${path}`), { code: "ENOENT" });

const unexpected = (what: string) => async (): Promise<never> => {
  throw new Error(`the test gave no handler for ${what}`);
};

/** What `find <path> -maxdepth 0 -type <t> -uid <uid> -perm <mode>` sees of one path. */
type Found = { readonly type: "d" | "f" | "l"; readonly owner: number; readonly mode: number };

// `find` as the mod runs it: the path when it passes every test, nothing when it fails one, and a
// failure when it does not exist. Any other form of the command is a mistake of the test or the mod.
const answerFind = (argv: readonly string[], found: Found | undefined): ProcessRunResult => {
  const [, path, ...tests] = argv;
  const given = new Map<string, string>();
  for (let index = 0; index < tests.length; index += 2) {
    given.set(tests[index] as string, tests[index + 1] as string);
  }
  const shape = ["-maxdepth", "-type", "-uid", "-perm"];
  if (
    path === undefined ||
    tests.length !== 8 ||
    tests.some((t, i) => i % 2 === 0 && t !== shape[i / 2])
  ) {
    throw new Error(`the fake runs find only as the mod's check, not ${JSON.stringify(argv)}`);
  }
  if (found === undefined) {
    return { exitCode: 1, stdout: "", stderr: `find: ${path}: No such file or directory\n` };
  }
  const passes =
    given.get("-maxdepth") === "0" &&
    found.type === given.get("-type") &&
    String(found.owner) === given.get("-uid") &&
    found.mode === Number.parseInt(given.get("-perm") ?? "", 8);
  return { exitCode: 0, stdout: passes ? `${path}\n` : "", stderr: "" };
};

export type Fake = ReturnType<typeof fakeModApi>;

/** A fake `$`, its records and its controls. */
export const fakeModApi = (options: FakeOptions = {}) => {
  const pid = options.pid ?? 48213;
  const uid = options.uid ?? 501;
  const env: Readonly<Record<string, string | undefined>> = options.env ?? {
    XDG_RUNTIME_DIR: "/run/user/501",
  };
  const calls: Calls = {
    env: [],
    run: [],
    find: [],
    fetch: [],
    append: [],
    send: [],
    submit: [],
    status: [],
    toast: [],
    invalidate: [],
    log: [],
    agentLists: 0,
    reached: [],
  };
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const links = new Set<string>();
  /** Each path's owner, when it is not the fake's uid. */
  const owners = new Map<string, number>();
  /** Each path's mode, when it is not 0700 for a folder or 0600 for a file. */
  const modes = new Map<string, number>();
  const intervals: Interval[] = [];
  const foundOf = (path: string): Found | undefined => {
    const type = links.has(path) ? "l" : dirs.has(path) ? "d" : files.has(path) ? "f" : undefined;
    if (type === undefined) return undefined;
    const mode = modes.get(path) ?? (type === "f" ? 0o600 : 0o700);
    return { type, owner: owners.get(path) ?? uid, mode };
  };
  let time = 1_000_000;
  const handlers: Handlers = {
    run: unexpected("a process run"),
    fetch: unexpected("a fetch"),
    append: async () => ({ uuid: `row-${calls.append.length}` }),
    send: async () => ({ isDelivered: true }),
    submit: async ({ text }) => ({ text }),
    agents: async () => [],
    surfaces: async () => ["terminal"],
  };
  const reach = (name: string) => calls.reached.push(name);

  const api: ModApi = {
    plugin: { name: "askboard", root: options.root ?? "/plugins/askboard" },
    ui: {
      log: (text) => {
        reach("ui.log");
        calls.log.push(text);
      },
      toast: (text) => {
        reach("ui.toast");
        calls.toast.push(text);
      },
      status: (text) => {
        reach("ui.status");
        calls.status.push(text);
      },
      invalidate: (event) => {
        reach("ui.invalidate");
        calls.invalidate.push(event);
      },
      resolve: () => {
        reach("ui.resolve");
        return FAKE_ELEMENTS;
      },
    },
    session: {
      version: async () => {
        reach("session.version");
        return { version: options.version ?? "2.1.314", base: "2.1.314" };
      },
      append: (args) => {
        reach("session.append");
        calls.append.push(args);
        return handlers.append(args);
      },
      surfaces: () => {
        reach("session.surfaces");
        return handlers.surfaces();
      },
      send: (args) => {
        reach("session.send");
        calls.send.push(args);
        return handlers.send(args);
      },
    },
    prompt: {
      submit: (args) => {
        reach("prompt.submit");
        calls.submit.push(args);
        return handlers.submit(args);
      },
    },
    agent: {
      list: () => {
        reach("agent.list");
        calls.agentLists += 1;
        return handlers.agents();
      },
    },
    fs: {
      read: async (path) => {
        reach("fs.read");
        const text = files.get(path);
        if (text === undefined) throw missing(path);
        return text;
      },
      stat: async (path) => {
        reach("fs.stat");
        const isLink = links.has(path);
        if (dirs.has(path)) return { kind: "dir", size: 0, mtimeMs: 0, isLink };
        const text = files.get(path);
        if (text === undefined) throw missing(path);
        return { kind: "file", size: text.length, mtimeMs: time, isLink };
      },
    },
    clock: {
      now: async () => {
        reach("clock.now");
        time += 1;
        return time;
      },
      every: (ms, fn) => {
        reach("clock.every");
        const interval: Interval = { ms, fn, cancelled: false };
        intervals.push(interval);
        return {
          cancel: () => {
            interval.cancelled = true;
          },
        };
      },
    },
    http: {
      fetch: (url, init) => {
        reach("http.fetch");
        calls.fetch.push({ url, init });
        return handlers.fetch(url, init);
      },
    },
    process: {
      run: async (argv, init) => {
        reach("process.run");
        if (argv[0] === "find") {
          calls.find.push({ argv, init });
          return answerFind(argv, foundOf(argv[1] ?? ""));
        }
        calls.run.push({ argv, init });
        if (JSON.stringify(argv) === JSON.stringify(PID_COMMAND)) {
          return { exitCode: 0, stdout: `${pid} ${uid}`, stderr: "" };
        }
        return handlers.run(argv, init);
      },
    },
    env: {
      get: async (name) => {
        reach("env.get");
        calls.env.push(name);
        return env[name];
      },
    },
  };

  return {
    api,
    calls,
    handlers,
    files,
    dirs,
    links,
    owners,
    modes,
    intervals,
    pid,
    uid,
    /** Moves the clock on by `ms`. */
    advance: (ms: number) => {
      time += ms;
    },
    /** Runs every live interval once, as a period of each would, and waits for what it returned. */
    tick: async () => {
      for (const interval of intervals.filter((each) => !each.cancelled)) await interval.fn();
    },
  };
};

/** Lets every promise chain the mod left running settle: the fake never waits on a timer. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type Registered = { -readonly [N in keyof ModHooks]?: ModHooks[N][] } & {
  "ui.render"?: AbovePromptHook[];
};

/** Stands for the engine's `on`: keeps each hook, and fires an event through its hooks. */
export const fakeOn = (api: ModApi) => {
  const hooks: Registered = {};
  let last: RenderElement = BENEATH;
  const on = ((event: keyof Registered, ...rest: readonly unknown[]) => {
    const [matcher, hook] = rest.length === 2 ? rest : [undefined, rest[0]];
    if (event === "ui.render" && JSON.stringify(matcher) !== '{"component":"AbovePrompt"}') {
      throw new Error(`the fake draws only the band, not ${JSON.stringify(matcher)}`);
    }
    const list = (hooks[event] ?? []) as unknown[];
    hooks[event] = [...list, hook] as never;
    return undefined;
  }) as On;
  const only = <N extends keyof ModHooks>(event: N): ModHooks[N] | undefined => {
    const list = hooks[event] ?? [];
    if (list.length > 1) throw new Error(`more than one ${event} hook`);
    return list[0] as ModHooks[N] | undefined;
  };
  return {
    on,
    hooks,
    events: () => Object.keys(hooks).sort(),
    sessionStart: async () => {
      const e = { cwd: "/project", isInteractive: true };
      const hook = only("session.start");
      return hook === undefined ? { cwd: e.cwd } : hook(api, e, async (x) => ({ cwd: x.cwd }));
    },
    turnStart: async (e: Partial<TurnStartInput> = {}) => {
      const input: TurnStartInput = { text: "", turnId: "turn", ...e };
      const hook = only("turn.start");
      const next = async (x: TurnStartInput) => ({ turnId: x.turnId });
      return hook === undefined ? next(input) : hook(api, input, next);
    },
    /** One model request: the hook's stream is read to its end, as the engine reads it. */
    turnStep: async (e: Partial<TurnStepInput> = {}) => {
      const input: TurnStepInput = { turnId: "turn", index: 0, ...e };
      const hook = only("turn.step");
      // biome-ignore lint/correctness/useYield: the engine's stream here has no chunk to give.
      const next = async function* (_x: TurnStepInput) {
        return "step-result";
      };
      if (hook === undefined) return "step-result";
      const stream = hook(api, input, next);
      for (;;) {
        const step = await stream.next();
        if (step.done) return step.value;
      }
    },
    turnComplete: async (e: Partial<TurnCompleteInput> = {}) => {
      const input: TurnCompleteInput = { turnId: "turn", isAborted: false, ...e };
      const hook = only("turn.complete");
      const next = async (_x: TurnCompleteInput) => ({ text: "" });
      return hook === undefined ? next(input) : hook(api, input, next);
    },
    /**
     * Draws the band above the prompt on a terminal 200 cells wide unless `props` says otherwise:
     * its rows, or undefined when the hook passed to the plugins beneath.
     */
    drawBand: async (
      props: Partial<AbovePromptInput["props"]> = {},
      surface = "terminal",
    ): Promise<string[] | undefined> => {
      const list = hooks["ui.render"] ?? [];
      if (list.length > 1) throw new Error("more than one ui.render hook");
      const input: AbovePromptInput = {
        surface,
        component: "AbovePrompt",
        requestId: "band",
        props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 200, ...props },
      };
      const [hook] = list;
      const drawn = hook === undefined ? BENEATH : await hook(api, input, async () => BENEATH);
      last = drawn;
      return drawn === BENEATH ? undefined : rowsOf(drawn);
    },
    /** The tree the band's last drawing returned. */
    lastBand: (): RenderElement => last,
  };
};
