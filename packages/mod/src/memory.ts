// The mod's memory, one per loaded module (design decision 7): where the session file is, the
// session process it found, how it reaches it, what it pushed in the current epoch, the delivery
// reports to send, the main conversation's turn and each subagent's, each agent's turn as reported
// (design decision 12) and the pending asks it showed. A module reload starts it over, as it does
// the poll.

import type { PollContinuation, SessionFile } from "@askboard/contract";
import type { PushedAsk } from "./push-message.ts";

/** The session file's place, learned once at the session's start. */
export type Location = {
  /** The Claude Code process's PID, which names the file. */
  readonly key: number;
  /** The user's uid, who must own the folder and the file. */
  readonly uid: number;
  readonly folder: string;
  readonly file: string;
};

/** A push appended to an agent's conversation during its turn, which no request carried yet. */
export type Appended = {
  readonly asks: readonly PushedAsk[];
  /** The first of the turn's requests that carries the row (carried.ts). */
  readonly carriedFrom: number;
};

/** The main conversation's turn (only events without `agentId`). */
export type MainTurn = {
  readonly running: boolean;
  /** The model requests of the running turn. */
  readonly steps: number;
  readonly appended: readonly Appended[];
  /** Pushes Claude Code dropped (after an interrupt), kept for the next main turn. */
  readonly dropped: readonly PushedAsk[];
};

/** A subagent's turn, as its requests and its completion show it (subagent-turns.ts). */
export type SubagentTurn = {
  /** Tells this turn from the subagent's next one, which a completion starts. */
  readonly serial: number;
  /** The model requests of the turn. */
  readonly steps: number;
  /** Its appends that no request carried yet: each is reported once one does. */
  readonly appended: readonly Appended[];
};

export type DeliveryReport = {
  readonly askId: string;
  readonly cursor: string;
  readonly via: "append" | "submit";
};

export type Memory = {
  location: Location | undefined;
  starting: boolean;
  polling: boolean;
  /** Polls started since the module loaded. */
  polls: number;
  /** The session file of the session process the mod talks to. */
  session: SessionFile | undefined;
  /** The poll at which the session folder and file last passed the check; none after a failure. */
  checkedAtPoll: number | undefined;
  /** `client` once `$.http.fetch` is taken as refused: for the rest of the session (AD-5). */
  transport: "fetch" | "client";
  /** Requests in a row to one session process whose fetch failed while the client reached it. */
  refusedFetches:
    | { readonly pid: number; readonly epoch: string; readonly count: number }
    | undefined;
  /** The first poll at which a failed fetch may be tried through the client again. */
  probeAfter: number;
  helloSaid: boolean;
  /** The events pushed in this epoch, by `eventKey`. */
  pushed: Set<string>;
  /**
   * Delivery reports the next poll sends, one per ask: those that got no answer, and those made in
   * a hook, which never waits for a report.
   */
  unreported: Map<string, DeliveryReport>;
  /** Where the next poll continues a page cut at the response limit. */
  continuation: PollContinuation | undefined;
  main: MainTurn;
  /** Each subagent's turn the mod has seen a request of, or appended to, by agent ID. */
  subagents: Map<string, SubagentTurn>;
  /** The subagent turns tracked so far, which gives each its serial. */
  subagentTurns: number;
  /** The status entry's text as last set; undefined when cleared. */
  status: string | undefined;
  /** The subagents' asks a toast showed in this epoch. */
  toasted: Set<string>;
  /** The diagnostics written once in this epoch. */
  logged: Set<string>;
  /** Each agent's turn as last seen, running or not; the main conversation's under "". */
  turns: Map<string, boolean>;
  /** Turn reports that got no answer, one per agent, tried once more at the next poll. */
  unsentTurns: Map<string, boolean>;
  /** The turn reports in flight, which go one after another, in order. */
  turnReports: Promise<void>;
};

export const createMemory = (): Memory => ({
  location: undefined,
  starting: false,
  polling: false,
  polls: 0,
  session: undefined,
  checkedAtPoll: undefined,
  transport: "fetch",
  refusedFetches: undefined,
  probeAfter: 0,
  helloSaid: false,
  pushed: new Set(),
  unreported: new Map(),
  continuation: undefined,
  main: { running: false, steps: 0, appended: [], dropped: [] },
  subagents: new Map(),
  subagentTurns: 0,
  status: undefined,
  toasted: new Set(),
  logged: new Set(),
  turns: new Map(),
  unsentTurns: new Map(),
  turnReports: Promise.resolve(),
});

/**
 * Takes the session file read at a poll. Another session process, by its PID or its epoch, makes
 * the mod forget what it knew of the old one: what it pushed, its reports, its pages, its toasts and
 * every agent's pushes in flight; the hello goes again (AD-5).
 */
export const adopt = (memory: Memory, session: SessionFile): void => {
  const known = memory.session;
  memory.session = session;
  if (known !== undefined && known.pid === session.pid && known.epoch === session.epoch) return;
  memory.helloSaid = false;
  memory.pushed = new Set();
  memory.unreported = new Map();
  memory.continuation = undefined;
  memory.toasted = new Set();
  memory.logged = new Set();
  memory.main = { ...memory.main, appended: [], dropped: [] };
  for (const [agentId, turn] of memory.subagents) {
    memory.subagents.set(agentId, { ...turn, appended: [] });
  }
};
