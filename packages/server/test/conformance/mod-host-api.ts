// The `$` the stand-in mod host gives a mod (push delivery, tasks 9.1 and 15.2): the part of Claude
// Code's mod API AskBoard's mod uses, declared here after `packages/mod/src/mod-api.ts`, since the
// import rules (AD-1) keep the server package, its tests included, from importing `mod`. What
// reaches the machine is real: process runs, the clock and its timers, fetches over a Unix socket,
// the files. What would act on Claude Code is recorded: the agent list, appends, submits, toasts,
// the status entry, the band's redraw requests (`$.ui.invalidate`) and logs. `$.ui.resolve` gives
// the band's element constructors (mod-host-band.ts), and `$.session.surfaces` the surfaces the
// test gives, the terminal alone by default. An append to an agent the list does not show, or
// shows as finished, is refused as the engine refuses it ("one that names no running loop is
// refused"). Any other member is a problem in the record and a throw for the mod.

import { lstat, readFile, stat } from "node:fs/promises";
import { request } from "node:http";
import { type AbovePromptInput, BAND_ELEMENTS, type BandElements } from "./mod-host-band.ts";

/** `$.process.run`'s bound when the call gives none, and `$.http.fetch`'s (design decision 2). */
const RUN_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = 30_000;

/** The refusal a policy mod gives a fetch (the mod delivery spike's `probe-fetch-block`). */
export const FETCH_REFUSAL =
  "$.http.fetch: probe-fetch-block: network requests are refused by policy";

type TextBlock = { readonly type: "text"; readonly text: string };
type AppendArgs = {
  readonly message: { readonly type: "user"; readonly content: readonly TextBlock[] };
  readonly agentId?: string;
};
export type SubmitResult = { readonly text: string } | { readonly drop: string };
type HttpInit = {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly socketPath?: string;
};
type HttpResponse = {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: string;
};
type RunInit = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly stdin?: string;
  readonly timeoutMs?: number;
};
type RunResult = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };
type FsStat = {
  readonly kind: "file" | "dir" | "other";
  readonly size: number;
  readonly mtimeMs: number;
  readonly isLink: boolean;
};

/** An agent as `$.agent.list()` gives it. */
export type HostedAgent = {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly status: "pending" | "running" | "waiting" | "idle" | "completed" | "failed" | "killed";
};

/** The statuses of an agent whose loop no longer runs: an append to it is refused. */
const FINISHED: ReadonlySet<HostedAgent["status"]> = new Set(["completed", "failed", "killed"]);

/** The `$` the host gives a mod's hooks. */
export type HostApi = {
  readonly plugin: { readonly name: string; readonly root: string };
  readonly ui: {
    log(text: string, options?: { readonly to?: "transcript" | "debug" }): void;
    toast(text: string, options?: { readonly timeoutMs?: number }): void;
    status(text: string | undefined): void;
    /** Asks for the band to be drawn again. */
    invalidate(event: "ui.render"): void;
    /** The element constructors of the surface a `ui.render` input is drawn on. */
    resolve(e: AbovePromptInput): BandElements;
  };
  readonly session: {
    version(): Promise<{ readonly version: string; readonly base?: string }>;
    append(args: AppendArgs): Promise<{ readonly uuid: string } | { readonly deny: string }>;
    /** The surfaces the session draws on. */
    surfaces(): Promise<readonly string[]>;
  };
  readonly prompt: { submit(args: { readonly text: string }): Promise<SubmitResult> };
  readonly agent: { list(): Promise<readonly HostedAgent[]> };
  readonly fs: { read(path: string): Promise<string>; stat(path: string): Promise<FsStat> };
  readonly clock: {
    now(): Promise<number>;
    every(ms: number, fn: () => unknown): { cancel(): void };
  };
  readonly http: { fetch(url: string, init?: HttpInit): Promise<HttpResponse> };
  readonly process: { run(argv: readonly string[], init?: RunInit): Promise<RunResult> };
  readonly env: { get(name: string): Promise<string | undefined> };
};

/** A local API request the mod made, by fetch or through the client a process run started. */
export type Exchange = {
  readonly via: "fetch" | "client";
  readonly method: string;
  readonly path: string;
  readonly request?: unknown;
  /** The answer's status; for the client, 200 for exit 0 and the refusal's for exit 3. */
  readonly status?: number;
  /** The answer's JSON, when it was JSON. */
  readonly response?: unknown;
  /** Refused by policy before any request was made. */
  readonly refused?: true;
};

export type Push = {
  readonly via: "append" | "submit";
  readonly agentId?: string;
  readonly text: string;
  /** When the call was made, by the system clock. */
  readonly at: number;
};

/** What the mod did, in order of each kind. */
export type HostRecord = {
  readonly events: { readonly event: string; readonly agentId?: string }[];
  readonly pushes: Push[];
  agentLists: number;
  readonly toasts: string[];
  readonly statuses: (string | undefined)[];
  /** Each `$.ui.invalidate` call's event: the band is drawn again after each. */
  readonly invalidations: string[];
  readonly logs: string[];
  readonly exchanges: Exchange[];
  /** The agent IDs of appends refused: the agent was not listed, or listed as finished. */
  readonly refusedAppends: string[];
  readonly runs: { readonly argv: readonly string[]; result?: RunResult }[];
  readonly reads: string[];
  readonly envReads: string[];
  /** What the mod did that the host cannot stand for, or that no mod of AskBoard's may do. */
  readonly problems: string[];
};

export type ApiOptions = {
  /** Claude Code's environment, the session process's: `$.env` and every process run read it. */
  readonly env: Readonly<Record<string, string>>;
  /** Claude Code's working folder, where processes run: the project. */
  readonly cwd: string;
  /** `$.plugin.root`: the checkout, which holds `dist/askboard.mjs`. */
  readonly root: string;
  /** The Claude Code version `$.session.version()` gives. */
  readonly version?: string;
  /** Refuses every `$.http.fetch`, as an organization's policy or a policy mod does (AD-5). */
  readonly refuseFetch?: boolean;
  /** What a submit resolves to; the turn started, by default. */
  readonly submit?: (text: string) => Promise<SubmitResult>;
};

/**
 * What the host's `$` shares with the host: its record, its timers and processes, its agents and
 * the surfaces the session draws on.
 */
export type HostState = {
  readonly options: ApiOptions;
  readonly record: HostRecord;
  readonly timers: Set<ReturnType<typeof setInterval>>;
  readonly children: Set<ReturnType<typeof Bun.spawn>>;
  agents: readonly HostedAgent[];
  surfaces: readonly string[];
  stopped: boolean;
};

export const emptyRecord = (): HostRecord => ({
  events: [],
  pushes: [],
  agentLists: 0,
  toasts: [],
  statuses: [],
  invalidations: [],
  logs: [],
  exchanges: [],
  refusedAppends: [],
  runs: [],
  reads: [],
  envReads: [],
  problems: [],
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const jsonOf = (text: string | undefined): unknown => {
  if (text === undefined || text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const withJson = <K extends string>(key: K, text: string | undefined) => {
  const value = jsonOf(text);
  return (value === undefined ? {} : { [key]: value }) as Partial<Record<K, unknown>>;
};

/** Refuses any member of `target` the host does not implement, recording it as a problem. */
const strict = <T extends object>(target: T, name: string, problems: string[]): T =>
  new Proxy(target, {
    get(object, key, receiver) {
      if (typeof key === "symbol" || key === "then" || Reflect.has(object, key)) {
        return Reflect.get(object, key, receiver);
      }
      const problem = `the mod reached ${name}.${key}, which the stand-in host does not implement`;
      problems.push(problem);
      throw new Error(problem);
    },
  });

// The client mode's exchange, from its command line and its outcome (packages/hooks/src/client.ts).
const clientExchange = (argv: readonly string[], result: RunResult): Exchange => {
  const [path = "", body] = argv.slice(argv.indexOf("client") + 1);
  const answered = result.exitCode === 0;
  const refusal = result.exitCode === 3 ? (jsonOf(result.stdout) as { status?: number }) : {};
  const status = answered ? 200 : refusal?.status;
  return {
    via: "client",
    method: body === undefined ? "GET" : "POST",
    path,
    ...withJson("request", body),
    ...(status === undefined ? {} : { status }),
    ...(answered ? withJson("response", result.stdout) : {}),
  };
};

/** `$.process.run`: a child of this suite, in Claude Code's environment, ended past its bound. */
const runOf =
  (state: HostState) =>
  async (argv: readonly string[], init: RunInit = {}): Promise<RunResult> => {
    if (state.stopped) throw new Error("the stand-in host has stopped");
    const { env, cwd } = state.options;
    const child = Bun.spawn([...argv], {
      cwd: init.cwd ?? cwd,
      env: { ...env, ...init.env },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    state.children.add(child);
    child.stdin.write(init.stdin ?? "");
    child.stdin.end();
    const timer = setTimeout(() => child.kill("SIGKILL"), init.timeoutMs ?? RUN_TIMEOUT_MS);
    const entry: HostRecord["runs"][number] = { argv };
    state.record.runs.push(entry);
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      // A child ended by a signal reads as 1, as the mod API gives it.
      entry.result = { exitCode: child.signalCode === null ? code : 1, stdout, stderr };
      if (argv.includes("client")) state.record.exchanges.push(clientExchange(argv, entry.result));
      return entry.result;
    } finally {
      clearTimeout(timer);
      state.children.delete(child);
    }
  };

const headersOf = (headers: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      Array.isArray(value) ? value.join(", ") : String(value),
    ]),
  );

// One request over a Unix socket with node:http, as the mod API's fetch makes it.
const overSocket = (url: URL, init: HttpInit, socketPath: string): Promise<HttpResponse> =>
  new Promise((resolve, reject) => {
    const body = init.body;
    const length = body === undefined ? {} : { "Content-Length": String(Buffer.byteLength(body)) };
    const sent = request(
      {
        socketPath,
        host: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: init.method ?? "GET",
        headers: { ...init.headers, ...length },
        timeout: FETCH_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status,
            ok: status >= 200 && status < 300,
            headers: headersOf(response.headers),
            text,
          });
        });
      },
    );
    sent.on("timeout", () => sent.destroy(new Error("$.http.fetch timed out")));
    sent.on("error", reject);
    sent.end(body);
  });

/** `$.http.fetch`: over the session's socket alone, or refused as a policy refuses it. */
const fetchOf =
  ({ options, record }: HostState) =>
  async (url: string, init: HttpInit = {}): Promise<HttpResponse> => {
    const target = new URL(url);
    const method = init.method ?? "GET";
    const path = `${target.pathname}${target.search}`;
    if (options.refuseFetch === true) {
      record.exchanges.push({ via: "fetch", method, path, refused: true });
      throw new Error(FETCH_REFUSAL);
    }
    if (init.socketPath === undefined) {
      record.problems.push(`the mod fetched ${url} over the network, not over a Unix socket`);
      throw new Error("the stand-in host fetches over a Unix socket alone: no socketPath");
    }
    const exchange = { via: "fetch" as const, method, path, ...withJson("request", init.body) };
    try {
      const response = await overSocket(target, init, init.socketPath);
      const answer = { status: response.status, ...withJson("response", response.text) };
      record.exchanges.push({ ...exchange, ...answer });
      return response;
    } catch (error) {
      record.exchanges.push(exchange);
      throw error;
    }
  };

const fsOf = ({ record }: HostState): HostApi["fs"] => ({
  read: async (path) => {
    record.reads.push(path);
    return readFile(path, "utf8");
  },
  stat: async (path) => {
    const link = await lstat(path);
    const found = await stat(path);
    const kind = found.isFile() ? "file" : found.isDirectory() ? "dir" : "other";
    return { kind, size: found.size, mtimeMs: found.mtimeMs, isLink: link.isSymbolicLink() };
  },
});

const clockOf = (state: HostState): HostApi["clock"] => ({
  now: async () => Date.now(),
  every: (ms, fn) => {
    if (state.stopped) return { cancel: () => undefined };
    const timer = setInterval(() => {
      Promise.resolve()
        .then(fn)
        .catch((error: unknown) => {
          state.record.problems.push(`a timer of the mod threw: ${messageOf(error)}`);
        });
    }, ms);
    state.timers.add(timer);
    return {
      cancel: () => {
        clearInterval(timer);
        state.timers.delete(timer);
      },
    };
  },
});

const uiOf = ({ record }: HostState): HostApi["ui"] => ({
  log: (text) => {
    record.logs.push(text);
  },
  toast: (text) => {
    record.toasts.push(text);
  },
  status: (text) => {
    record.statuses.push(text);
  },
  invalidate: (event) => {
    record.invalidations.push(event);
  },
  resolve: () => BAND_ELEMENTS,
});

// Whether an append may join `agentId`'s loop: listed, and not finished.
const runsLoop = (state: HostState, agentId: string): boolean => {
  const listed = state.agents.find((agent) => agent.id === agentId);
  return listed !== undefined && !FINISHED.has(listed.status);
};

const sessionOf = (state: HostState): HostApi["session"] => ({
  version: async () => {
    const version = state.options.version ?? "2.1.314";
    return { version, base: version };
  },
  append: async ({ message, agentId }) => {
    const { record } = state;
    if (agentId !== undefined && !runsLoop(state, agentId)) {
      record.refusedAppends.push(agentId);
      throw new Error(`$.session.append: no running loop is named ${agentId}`);
    }
    const text = message.content.map((block) => block.text).join("");
    const to = agentId === undefined ? {} : { agentId };
    record.pushes.push({ via: "append", ...to, text, at: Date.now() });
    return { uuid: `row-${record.pushes.filter((push) => push.via === "append").length}` };
  },
  surfaces: async () => state.surfaces,
});

const promptOf = ({ options, record }: HostState): HostApi["prompt"] => ({
  submit: async ({ text }) => {
    record.pushes.push({ via: "submit", text, at: Date.now() });
    return options.submit === undefined ? { text } : options.submit(text);
  },
});

/** The `$` of one host: each namespace strict, so a member it lacks is reported. */
export const hostApi = (state: HostState): HostApi => {
  const { options, record } = state;
  const { problems } = record;
  const api: HostApi = {
    plugin: strict({ name: "askboard", root: options.root }, "$.plugin", problems),
    ui: strict(uiOf(state), "$.ui", problems),
    session: strict(sessionOf(state), "$.session", problems),
    prompt: strict(promptOf(state), "$.prompt", problems),
    agent: strict(
      {
        list: async () => {
          record.agentLists += 1;
          return state.agents;
        },
      },
      "$.agent",
      problems,
    ),
    fs: strict(fsOf(state), "$.fs", problems),
    clock: strict(clockOf(state), "$.clock", problems),
    http: strict({ fetch: fetchOf(state) }, "$.http", problems),
    process: strict({ run: runOf(state) }, "$.process", problems),
    env: strict(
      {
        get: async (name: string) => {
          record.envReads.push(name);
          return options.env[name];
        },
      },
      "$.env",
      problems,
    ),
  };
  return strict(api, "$", problems);
};
