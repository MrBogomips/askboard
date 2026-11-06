// The session side over the built session process (task 9.3, design decision 11): the same
// `BoardSession` the test server gives, so that the browser tests run unchanged against
// `dist/askboard.mjs` serving `dist/view/`.
//
// - Start: the bundle runs on Bun (or Node 24) as a child over stdio, with `BROWSER` naming the
//   link recorder and silent notifier stand-ins first on `PATH`, so that no system notification
//   shows (push delivery); `@modelcontextprotocol/client` calls `ask` with the scenario's ask, and
//   the board link is the one `ask` returned, which the recorder must have received alone.
// - The browser reaches the board through a proxy (`proxy.ts`), which gives `drop`, `restore` and
//   `requests`; the tests' link is the ask's link on the proxy's port.
// - `collected` calls `collect` after the last cursor and expects exactly one new answer event.
// - `exit` ends the process's input (design decision 4), which discards the ask and must end the
//   process with exit code 0.
// - `restart` is a crash and a new session: the process is killed, so no discard reaches the
//   board, and a new one asks the same ask, which opens it under a new token, so the old token
//   opens nothing (Track 0's restart transcript). An ended session sends `discarded`, which
//   `exit` covers.
// - With an asker (push delivery, task 8.5), the process runs in the asker's own git project, and
//   before each `ask` and the waiting `collect` of `agentWaits` the agent records its hooks would
//   send reach the local API (`asker-project.ts`); the ask carries the asker's agent name and
//   expected user.

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { Agent } from "./agent.ts";
import type { Asker } from "./asker.ts";
import {
  type AskerPlace,
  findLocalApi,
  type LocalApi,
  postRecord,
  prepareProject,
  recordsFor,
} from "./asker-project.ts";
import { type BoardLink, linkThrough, parseBoardLink } from "./board-link.ts";
import {
  type Child,
  type ChildExit,
  ChildTransport,
  describeExit,
  type SpawnChild,
  spawnChild,
} from "./child.ts";
import { LINK_RECORDER, LINKS_VARIABLE, waitForOpened } from "./link-recorder.ts";
import { type BoardProxy, startProxy } from "./proxy.ts";
import { type AskInput, askInputFor, questionTexts } from "./scenario-ask.ts";
import type { BoardSession, ProjectFile, Scenario } from "./session.ts";
import { type Stage, stageSession } from "./session-stage.ts";
import { type Runtime, runtimeFrom } from "./target.ts";

export type SessionProcessOptions = {
  /** Bun by default, or `ASKBOARD_E2E_RUNTIME`. */
  readonly runtime?: Runtime;
  /** `dist/askboard.mjs` by default. */
  readonly bundle?: string;
  /** Starts the process; a fake in unit tests. */
  readonly spawn?: SpawnChild;
  /** Starts the proxy to the board listener at a port; a failing one in unit tests. */
  readonly startProxy?: (upstreamPort: number) => Promise<BoardProxy>;
  /** The approved plain-choice ask; the contract's fixture by default. */
  readonly approvedAsk?: string;
  /** How long the board may take to reach `BROWSER` after `ask` returns. */
  readonly openTimeoutMs?: number;
  /** How long the process may take to exit once its input ends; the design's bound is 1 s. */
  readonly exitTimeoutMs?: number;
  /**
   * The user configuration file, written under the process's own `XDG_CONFIG_HOME` before it starts
   * (settings-languages, design decision 14): a value as JSON, a string as it is.
   */
  readonly userConfig?: unknown;
  /** The project configuration file, `.askboard/config.json`, written in the same way. */
  readonly projectConfig?: unknown;
};

const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");
/** `osascript` and `notify-send` stand-ins that show nothing. */
const NOTIFIER_STAND_INS = join(import.meta.dir, "..", "fixtures", "notifier");
const OPEN_TIMEOUT_MS = 5_000;
const EXIT_TIMEOUT_MS = 5_000;
const STDERR_TAIL_CHARS = 1_000;

/** One life of the session process, from its start to its end. */
type Life = {
  readonly child: Child;
  readonly agent: Agent;
  readonly link: BoardLink;
  /** The local API the asker's records go to; none without an asker. */
  readonly api?: LocalApi;
  cursor: string;
  stderr: { text: string };
  state: { ending: boolean; exit?: ChildExit };
};

/** The process's end, or undefined when it has not ended within the bound. */
const within = async (exited: Promise<ChildExit>, ms: number): Promise<ChildExit | undefined> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  const exit = await Promise.race([exited, late]);
  clearTimeout(timer);
  return exit;
};

// The ask's one question, which a waiting collect waits for.
const questionIdOf = (input: AskInput): string => {
  const [item] = Array.isArray(input.items) ? (input.items as { id?: unknown }[]) : [];
  if (typeof item?.id !== "string") throw new Error("the scenario's ask holds no question");
  return item.id;
};

const stderrNote = (stderr: { text: string }): string => {
  const tail = stderr.text.slice(-STDERR_TAIL_CHARS).trim();
  return tail === "" ? "" : `; its stderr: ${tail}`;
};

/** Ends a life as a crash does, with no discard: kills the process, then closes its MCP client. */
const killLife = async (life: Pick<Life, "child" | "state"> & { agent?: Agent }): Promise<void> => {
  life.state.ending = true;
  life.child.kill("SIGKILL");
  await life.child.exited;
  await life.agent?.close();
};

class ProcessSession implements BoardSession {
  readonly link: string;
  readonly userConfigPath: string;
  readonly #lives: Life[];
  readonly #proxy: BoardProxy;
  readonly #launch: (n: number) => Promise<Life>;
  readonly #secrets: readonly string[];
  readonly #problems: string[];
  readonly #cleanup: () => Promise<void>;
  readonly #exitTimeoutMs: number;
  readonly #input: AskInput;
  readonly #asker: { readonly asker: Asker; readonly place: AskerPlace } | undefined;
  // The agent's waiting collects, which end with the user's answer or the session.
  readonly #waits: Promise<unknown>[] = [];
  #closing: Promise<void> | undefined;

  constructor(parts: {
    first: Life;
    proxy: BoardProxy;
    launch: (n: number) => Promise<Life>;
    input: AskInput;
    problems: string[];
    cleanup: () => Promise<void>;
    exitTimeoutMs: number;
    asker?: { readonly asker: Asker; readonly place: AskerPlace };
    userConfigPath: string;
  }) {
    this.#lives = [parts.first];
    this.#proxy = parts.proxy;
    this.#launch = parts.launch;
    this.#secrets = questionTexts(parts.input);
    this.#problems = parts.problems;
    this.#cleanup = parts.cleanup;
    this.#exitTimeoutMs = parts.exitTimeoutMs;
    this.#input = parts.input;
    this.#asker = parts.asker;
    this.link = linkThrough(parts.first.link, parts.proxy.port);
    this.userConfigPath = parts.userConfigPath;
  }

  latestLink(): string {
    return linkThrough(this.#current.link, this.#proxy.port);
  }

  get #current(): Life {
    const life = this.#lives.at(-1);
    if (life === undefined) throw new Error("the session process never started");
    return life;
  }

  async collected(): Promise<void> {
    const life = this.#current;
    const { askId } = life.link;
    const collected = await life.agent.collect(askId, life.cursor);
    const answers = collected.events.filter((event) => event.type === "answer").length;
    if (answers !== 1) {
      this.#problems.push(
        `collect after ${life.cursor} returned ${answers} answer events for the ask, not 1`,
      );
    }
    life.cursor = collected.cursor;
  }

  async collect(): Promise<{ state: string; events: readonly Record<string, unknown>[] }> {
    const life = this.#current;
    const collected = await life.agent.collect(life.link.askId, life.cursor);
    life.cursor = collected.cursor;
    return { state: collected.state, events: collected.events };
  }

  snapshot(): Promise<{ readonly path: string; readonly state: string }> {
    const life = this.#current;
    return life.agent.snapshot(life.link.askId);
  }

  update(actions: readonly unknown[]): Promise<unknown> {
    const life = this.#current;
    return life.agent.update(life.link.askId, actions);
  }

  async agentWaits(): Promise<void> {
    const life = this.#current;
    const { askId } = life.link;
    if (this.#asker !== undefined && life.api !== undefined) {
      const { asker, place } = this.#asker;
      for (const record of recordsFor(asker, "collect", askId, place.cwd)) {
        await postRecord(life.api, record);
      }
    }
    const waiting = life.agent.collectWaiting(askId, life.cursor, questionIdOf(this.#input));
    this.#waits.push(
      waiting.then(
        (collected) => {
          life.cursor = collected.cursor;
        },
        () => undefined,
      ),
    );
  }

  async exit(): Promise<void> {
    const exit = await this.#endThroughInput(this.#current);
    if (exit === undefined) {
      this.#problems.push(
        `the session process did not exit within ${this.#exitTimeoutMs / 1000} s of its input ending`,
      );
    } else if (exit.code !== 0 || exit.signal !== null) {
      this.#problems.push(
        `the session process ended with ${describeExit(exit)} when its input ended, not exit code 0`,
      );
    }
  }

  async drop(): Promise<void> {
    this.#proxy.drop();
  }

  async restore(): Promise<void> {
    this.#proxy.restore();
  }

  async restart(): Promise<void> {
    const old = this.#current;
    // The board is cut off until the new process listens, so that it cannot reach another
    // session process that takes the old port meanwhile.
    this.#proxy.drop();
    await killLife(old);
    const next = await this.#launch(this.#lives.length + 1);
    this.#lives.push(next);
    if (next.link.token === old.link.token) {
      this.#problems.push(
        "the restarted session process gave the ask the old token: it must open nothing",
      );
    }
    this.#proxy.retarget(next.link.port);
    this.#proxy.restore();
  }

  requests(): readonly string[] {
    return this.#proxy.requests();
  }

  problems(): readonly string[] {
    return [...this.#problems, ...this.#lives.flatMap((life) => this.#stderrProblems(life))];
  }

  close(): Promise<void> {
    this.#closing ??= (async () => {
      const life = this.#current;
      if (life.state.exit === undefined) await this.#endThroughInput(life);
      await this.#proxy.close();
      await this.#cleanup();
    })();
    return this.#closing;
  }

  // Diagnostics hold no token and no question text (mcp-adapter spec, "Exit"; AD-11).
  #stderrProblems(life: Life): string[] {
    const { text } = life.stderr;
    return [
      ...(text.includes(life.link.token)
        ? ["the session process's stderr held the board's token"]
        : []),
      ...(this.#secrets.some((secret) => text.includes(secret))
        ? ["the session process's stderr held a question's text"]
        : []),
    ];
  }

  async #endThroughInput(life: Life): Promise<ChildExit | undefined> {
    life.state.ending = true;
    life.child.endInput();
    const exit = await within(life.child.exited, this.#exitTimeoutMs);
    if (exit === undefined) {
      life.child.kill("SIGKILL");
      await life.child.exited;
    }
    await life.agent.close();
    return exit;
  }
}

type LaunchContext = {
  readonly asker?: { readonly asker: Asker; readonly place: AskerPlace };
  readonly spawn: SpawnChild;
  readonly command: string;
  readonly entry: string;
  readonly env: Record<string, string>;
  readonly linksFile: string;
  readonly input: AskInput;
  readonly askId: string;
  readonly openTimeoutMs: number;
  readonly problems: string[];
};

// The ask's board must reach `BROWSER` once, as its one argument (board-host spec, "Opening a
// board in the browser").
const checkOpened = async (context: LaunchContext, n: number, board: string): Promise<void> => {
  const opened = await waitForOpened(context.linksFile, n, context.openTimeoutMs);
  const call = opened[n - 1];
  if (call !== undefined && call.args !== 1) {
    throw new Error(
      `BROWSER was started with ${call.args} argument(s), not the ask result's link alone`,
    );
  }
  if (call?.link !== board) {
    throw new Error(`BROWSER was started with ${call?.link}, not the ask result's link ${board}`);
  }
};

/**
 * With an asker, the records its hooks send before the `ask`, once a first request has started the
 * local API (AD-2); the local API they went to.
 */
const recordAsk = async (context: LaunchContext, agent: Agent): Promise<LocalApi | undefined> => {
  if (context.asker === undefined) return undefined;
  const { asker, place } = context.asker;
  await agent.listTools();
  const api = await findLocalApi(context.env, process.getuid?.() ?? 0, place.projectDir);
  for (const record of recordsFor(asker, "ask", context.askId, place.cwd)) {
    await postRecord(api, record);
  }
  return api;
};

/** Starts the n-th life of the session process and asks the scenario's ask on it. */
const launch = async (context: LaunchContext, n: number): Promise<Life> => {
  const child = context.spawn(context.command, [context.entry], { env: context.env, cwd: ROOT });
  const stderr = { text: "" };
  const state: Life["state"] = { ending: false };
  child.onErrorOutput((chunk) => {
    stderr.text += Buffer.from(chunk).toString();
  });
  void child.exited.then((exit) => {
    state.exit = exit;
    if (!state.ending) {
      context.problems.push(
        `the session process ended on its own with ${describeExit(exit)}${stderrNote(stderr)}`,
      );
    }
  });
  let agent: Agent | undefined;
  try {
    agent = await Agent.connect(new ChildTransport(child));
    const api = await recordAsk(context, agent);
    const result = await agent.ask(context.input);
    if (result.askId !== context.askId) {
      throw new Error(
        `the ask result names ask ${result.askId}, not the scenario's ${context.askId}`,
      );
    }
    const link = parseBoardLink(result.board);
    await checkOpened(context, n, result.board);
    return {
      child,
      agent,
      link,
      ...(api === undefined ? {} : { api }),
      cursor: result.cursor,
      stderr,
      state,
    };
  } catch (error) {
    await killLife({ child, agent, state });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${stderrNote(stderr)}`, { cause: error });
  }
};

const cleanupOf =
  (stage: Stage, dir: string, place?: AskerPlace, plain?: { cleanup(): Promise<void> }) =>
  async () => {
    await stage.cleanup();
    await rm(dir, { recursive: true, force: true });
    await place?.cleanup();
    await plain?.cleanup();
  };

// A project with no git and no asker, only to hold a scenario's files.
const plainProject = async (): Promise<{ projectDir: string; cleanup(): Promise<void> }> => {
  const projectDir = await mkdtemp(join(tmpdir(), "askboard-e2e-files-"));
  return { projectDir, cleanup: () => rm(projectDir, { recursive: true, force: true }) };
};

const writeFiles = async (
  root: string,
  files: Readonly<Record<string, ProjectFile>>,
): Promise<void> => {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    if (typeof content === "object" && "link" in content)
      await symlink(content.link, join(root, path));
    else await writeFile(join(root, path), content);
  }
};

// A configuration file a scenario gives, written before the process starts.
const writeConfig = async (file: string, value: unknown): Promise<void> => {
  if (value === undefined) return;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * The process's own home, configuration folder and project, inside `dir`, holding the scenario's
 * configuration files, so that no developer's configuration reaches it (settings-languages, design
 * decision 14); an asker's project stands in for the project.
 */
const isolated = async (
  dir: string,
  options: SessionProcessOptions,
  projectDir?: string,
  withoutProject = false,
) => {
  const home = join(dir, "home");
  const configHome = join(dir, "config");
  const project = projectDir ?? join(dir, "project");
  await Promise.all(
    [home, configHome, project].map((folder) => mkdir(folder, { recursive: true })),
  );
  await writeConfig(join(configHome, "askboard", "config.json"), options.userConfig);
  await writeConfig(join(project, ".askboard", "config.json"), options.projectConfig);
  return {
    HOME: home,
    XDG_CONFIG_HOME: configHome,
    ...(withoutProject ? {} : { CLAUDE_PROJECT_DIR: project }),
  };
};

// The ask with the asker's agent name and expected user.
const withAsker = <T extends object>(input: T, asker: Asker | undefined): T => ({
  ...input,
  ...(asker?.agentName === undefined ? {} : { agentName: asker.agentName }),
  ...(asker?.expectedUser === undefined ? {} : { expectedUser: asker.expectedUser }),
});

/** The first life and the proxy in front of it; a failure leaves nothing running or staged. */
const startFirst = async (
  context: LaunchContext,
  proxyTo: (upstreamPort: number) => Promise<BoardProxy>,
  cleanup: () => Promise<void>,
): Promise<{ first: Life; proxy: BoardProxy }> => {
  let first: Life | undefined;
  try {
    first = await launch(context, 1);
    return { first, proxy: await proxyTo(first.link.port) };
  } catch (error) {
    // A failed launch has ended its own process already.
    if (first !== undefined) await killLife(first);
    await cleanup();
    throw error;
  }
};

/** A `BoardSession` over a new session process that has asked the scenario's ask. */
export const startSessionProcess = async (
  { transcript, view, ask, asker, files, projectDir: given, config, withoutProject }: Scenario,
  extra: SessionProcessOptions = {},
): Promise<BoardSession> => {
  const options: SessionProcessOptions = {
    ...(config?.user === undefined ? {} : { userConfig: config.user }),
    ...(config?.project === undefined ? {} : { projectConfig: config.project }),
    ...extra,
  };
  const input = withAsker(ask ?? (await askInputFor(transcript, options.approvedAsk)), asker);
  const runtime = options.runtime ?? runtimeFrom(process.env.ASKBOARD_E2E_RUNTIME);
  const stage = await stageSession(view, options.bundle);
  const dir = await mkdtemp(join(tmpdir(), "askboard-e2e-links-"));
  const place = asker === undefined ? undefined : await prepareProject(asker);
  const plain =
    place === undefined && given === undefined && files !== undefined
      ? await plainProject()
      : undefined;
  const projectDir = place?.projectDir ?? given ?? plain?.projectDir;
  if (projectDir !== undefined && files !== undefined) await writeFiles(projectDir, files);
  const cleanup = cleanupOf(stage, dir, place, plain);
  const linksFile = join(dir, "links");
  const folders = await isolated(dir, options, projectDir, withoutProject);
  const problems: string[] = [];
  const context: LaunchContext = {
    ...(asker === undefined || place === undefined ? {} : { asker: { asker, place } }),
    spawn: options.spawn ?? spawnChild,
    command: runtime === "node" ? "node" : process.execPath,
    entry: stage.entry,
    // The SDK stdio transport's default inheritance: the developer's SSH or CI variables do not
    // reach the detection rule (AD-18), and BROWSER shows the board wherever the tests run.
    env: {
      ...getDefaultEnvironment(),
      PATH: `${NOTIFIER_STAND_INS}:${getDefaultEnvironment().PATH ?? ""}`,
      BROWSER: LINK_RECORDER,
      [LINKS_VARIABLE]: linksFile,
      ...folders,
    },
    linksFile,
    input,
    askId: input.askId,
    openTimeoutMs: options.openTimeoutMs ?? OPEN_TIMEOUT_MS,
    problems,
  };
  const { first, proxy } = await startFirst(context, options.startProxy ?? startProxy, cleanup);
  return new ProcessSession({
    first,
    proxy,
    launch: (n) => launch(context, n),
    input,
    problems,
    cleanup,
    exitTimeoutMs: options.exitTimeoutMs ?? EXIT_TIMEOUT_MS,
    userConfigPath: join(folders.XDG_CONFIG_HOME, "askboard", "config.json"),
    ...(context.asker === undefined ? {} : { asker: context.asker }),
  });
};
