// The session side the browser tests talk to, behind one small interface (design decision 11).
// Until Integration, the test server stands in for the session process: it serves the view build
// under the contract's routes and replays the host's half of a transcript. Task 9.3 implements
// `StartSession` over the built session process and points `startSession` at it; the tests stay
// as they are.

import { startTestServer } from "./test-server.ts";
import type { ReplayTranscript } from "./transcripts.ts";
import type { ViewBuild } from "./view-build.ts";

export type Scenario = {
  /**
   * The session the test plays: the ask is its board document, and the session-side steps a test
   * triggers come in its order. The test server replays its host half.
   */
  readonly transcript: ReplayTranscript;
  /** The view build the session side serves: `dist/view/`, or a test-only variant of it. */
  readonly view: ViewBuild;
};

export type BoardSession = {
  /** The board link, as the `ask` result gives it: `http://127.0.0.1:<port>/b/<askId>?t=<token>`. */
  readonly link: string;
  /** The agent's `collect` returns the answer, so the board is told it was delivered. */
  collected(): Promise<void>;
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

/** The session side the browser tests use. */
export const startSession: StartSession = startTestServer;
