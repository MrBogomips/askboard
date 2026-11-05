// The session side the browser tests talk to, behind one small interface (design decision 11).
// Two targets give it: the test server, which serves the view build under the contract's routes
// and replays the host's half of a transcript, and the built session process (task 9.3), which
// `ASKBOARD_E2E_TARGET=session-process` selects (the runner's `--target`). The tests stay as they
// are.

import type { Asker } from "./asker.ts";
import { startSessionProcess } from "./session-process.ts";
import { targetFrom } from "./target.ts";
import { startTestServer } from "./test-server.ts";
import type { ReplayTranscript } from "./transcripts.ts";
import type { ViewBuild } from "./view-build.ts";

export type Scenario = {
  /**
   * The session the test plays: the ask is its board document, and the session-side steps a test
   * triggers come in its order. The test server replays its host half; the session process is
   * asked the ask that gives its board document.
   */
  readonly transcript: ReplayTranscript;
  /**
   * The view build the session side serves: `dist/view/`, or a test-only variant of it, which the
   * session process serves from a copy of its bundle beside it.
   */
  readonly view: ViewBuild;
  /**
   * An ask of the lifecycle (ask-lifecycle), sent as it is: its scenarios need ask-core's own
   * behaviour, which no transcript records, so they run on the session process whatever the
   * target, and the transcript only names the ask.
   */
  readonly ask?: { readonly askId: string } & Readonly<Record<string, unknown>>;
  /**
   * Who asks and from where (push delivery, task 8.5): the session process is given the project,
   * the worktree and the agent records that make it; the transcript holds the header messages the
   * test server replays for it (`asker.ts`). Without it, an unchecked ask from the checkout.
   */
  readonly asker?: Asker;
  /**
   * Files of the session project, by path under it (excerpts): the session process runs with
   * `CLAUDE_PROJECT_DIR` naming a temporary folder that holds them, or the asker's project when
   * there is one. The test server serves a transcript and needs none.
   */
  readonly files?: Readonly<Record<string, ProjectFile>>;
  /**
   * The folder to use as the session project when the test needs to change its files while the
   * board is open: the harness writes `files` into it and leaves it alone afterwards, so the test
   * owns it. Without it, a temporary folder is made and removed.
   */
  readonly projectDir?: string;
};

/** A file of the session project: its text or bytes, or a symbolic link to a target path. */
export type ProjectFile = string | Uint8Array | { readonly link: string };

export type BoardSession = {
  /** The board link, as the `ask` result gives it: `http://127.0.0.1:<port>/b/<askId>?t=<token>`. */
  readonly link: string;
  /** The agent's `collect` returns the answer, so the board is told it was delivered. */
  collected(): Promise<void>;
  /** The agent's `collect` after the last cursor: every new event, with the ask's state. */
  collect(): Promise<{
    readonly state: string;
    readonly events: readonly Record<string, unknown>[];
  }>;
  /** The agent's `update` of the ask with these actions: its result. */
  update(actions: readonly unknown[]): Promise<unknown>;
  /**
   * The agent calls `collect` with `wait` on the ask's question (push delivery): it returns once
   * the call is made, and the call returns when the user answers.
   */
  agentWaits(): Promise<void>;
  /** The session process exits with the board open; every open ask is discarded. */
  exit(): Promise<void>;
  /** The board's connection drops with no close frame; the network stays down until `restore`. */
  drop(): Promise<void>;
  /** The network is back after `drop`: the board page's next reconnect gets through. */
  restore(): Promise<void>;
  /** The session process restarts: the board's connection ends, and its token opens nothing. */
  restart(): Promise<void>;
  /** Every HTTP request that reached the session side, as `METHOD /path`, without the query. */
  requests(): readonly string[];
  /** What the session side saw go wrong, such as page messages off the transcript. */
  problems(): readonly string[];
  /** Stops the session side and closes its connections; safe to call more than once. */
  close(): Promise<void>;
};

export type StartSession = (scenario: Scenario) => Promise<BoardSession>;

const TARGET = targetFrom(process.env.ASKBOARD_E2E_TARGET);

/** The session side the browser tests use: the target the environment names. */
export const startSession: StartSession = (scenario) =>
  TARGET === "session-process" || scenario.ask !== undefined
    ? startSessionProcess(scenario)
    : startTestServer(scenario);
