// The session side over the built session process (task 9.3, design decision 11): the same
// `BoardSession` the test server gives, so that the browser tests run unchanged against
// `dist/askboard.mjs` serving `dist/view/`.
//
// - Start: the bundle runs on Bun (or Node 24) as a child over stdio, with `BROWSER` naming the
//   link recorder; `@modelcontextprotocol/client` calls `ask` with the scenario's ask, and the
//   board link is the one `ask` returned, which the recorder must have received alone.
// - The browser reaches the board through a proxy (`proxy.ts`), which gives `drop`, `restore` and
//   `requests`; the tests' link is the ask's link on the proxy's port.
// - `collected` calls `collect` after the last cursor and expects exactly one new answer event.
// - `exit` ends the process's input (design decision 4), which discards the ask and must end the
//   process with exit code 0.
// - `restart` is a crash and a new session: the process is killed, so no discard reaches the
//   board, and a new one asks the same ask, which opens it under a new token, so the old token
//   opens nothing (Track 0's restart transcript). An ended session sends `discarded`, which
//   `exit` covers.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { Agent } from "./agent.ts";
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
import type { BoardSession, Scenario } from "./session.ts";
import { type Stage, stageSession } from "./session-stage.ts";
import { type Runtime, runtimeFrom } from "./target.ts";

export type SessionProcessOptions = {
  /** Bun by default, or `ASKBOARD_E2E_RUNTIME`. */
  readonly runtime?: Runtime;
  /** `dist/askboard.mjs` by default. */
  readonly bundle?: string;
  /** Starts the process; a fake in unit tests. */
  readonly spawn?: SpawnChild;
  /** The approved plain-choice ask; the contract's fixture by default. */
  readonly approvedAsk?: string;
  /** How long the board may take to reach `BROWSER` after `ask` returns. */
  readonly openTimeoutMs?: number;
  /** How long the process may take to exit once its input ends; the design's bound is 1 s. */
  readonly exitTimeoutMs?: number;
};

const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");
const OPEN_TIMEOUT_MS = 5_000;
const EXIT_TIMEOUT_MS = 5_000;
const STDERR_TAIL_CHARS = 1_000;

/** One life of the session process, from its start to its end. */
type Life = {
  readonly child: Child;
  readonly agent: Agent;
  readonly link: BoardLink;
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

const stderrNote = (stderr: { text: string }): string => {
  const tail = stderr.text.slice(-STDERR_TAIL_CHARS).trim();
  return tail === "" ? "" : `; its stderr: ${tail}`;
};

class ProcessSession implements BoardSession {
  readonly link: string;
  readonly #lives: Life[];
  readonly #proxy: BoardProxy;
  readonly #launch: (n: number) => Promise<Life>;
  readonly #secrets: readonly string[];
  readonly #problems: string[];
  readonly #cleanup: () => Promise<void>;
  readonly #exitTimeoutMs: number;
  #closing: Promise<void> | undefined;

  constructor(parts: {
    first: Life;
    proxy: BoardProxy;
    launch: (n: number) => Promise<Life>;
    input: AskInput;
    problems: string[];
    cleanup: () => Promise<void>;
    exitTimeoutMs: number;
  }) {
    this.#lives = [parts.first];
    this.#proxy = parts.proxy;
    this.#launch = parts.launch;
    this.#secrets = questionTexts(parts.input);
    this.#problems = parts.problems;
    this.#cleanup = parts.cleanup;
    this.#exitTimeoutMs = parts.exitTimeoutMs;
    this.link = linkThrough(parts.first.link, parts.proxy.port);
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
    old.state.ending = true;
    old.child.kill("SIGKILL");
    await old.child.exited;
    await old.agent.close();
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
    const result = await agent.ask(context.input);
    if (result.askId !== context.askId) {
      throw new Error(
        `the ask result names ask ${result.askId}, not the scenario's ${context.askId}`,
      );
    }
    const link = parseBoardLink(result.board);
    await checkOpened(context, n, result.board);
    return { child, agent, link, cursor: result.cursor, stderr, state };
  } catch (error) {
    state.ending = true;
    child.kill("SIGKILL");
    await child.exited;
    await agent?.close();
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${stderrNote(stderr)}`, { cause: error });
  }
};

const cleanupOf = (stage: Stage, dir: string) => async () => {
  await stage.cleanup();
  await rm(dir, { recursive: true, force: true });
};

/** A `BoardSession` over a new session process that has asked the scenario's ask. */
export const startSessionProcess = async (
  { transcript, view }: Scenario,
  options: SessionProcessOptions = {},
): Promise<BoardSession> => {
  const input = await askInputFor(transcript, options.approvedAsk);
  const runtime = options.runtime ?? runtimeFrom(process.env.ASKBOARD_E2E_RUNTIME);
  const stage = await stageSession(view, options.bundle);
  const dir = await mkdtemp(join(tmpdir(), "askboard-e2e-links-"));
  const cleanup = cleanupOf(stage, dir);
  const linksFile = join(dir, "links");
  const problems: string[] = [];
  const context: LaunchContext = {
    spawn: options.spawn ?? spawnChild,
    command: runtime === "node" ? "node" : process.execPath,
    entry: stage.entry,
    // The SDK stdio transport's default inheritance: the developer's SSH or CI variables do not
    // reach the detection rule (AD-18), and BROWSER shows the board wherever the tests run.
    env: { ...getDefaultEnvironment(), BROWSER: LINK_RECORDER, [LINKS_VARIABLE]: linksFile },
    linksFile,
    input,
    askId: transcript.askId,
    openTimeoutMs: options.openTimeoutMs ?? OPEN_TIMEOUT_MS,
    problems,
  };
  let first: Life;
  try {
    first = await launch(context, 1);
  } catch (error) {
    await cleanup();
    throw error;
  }
  const proxy = await startProxy(first.link.port);
  return new ProcessSession({
    first,
    proxy,
    launch: (n) => launch(context, n),
    input,
    problems,
    cleanup,
    exitTimeoutMs: options.exitTimeoutMs ?? EXIT_TIMEOUT_MS,
  });
};
