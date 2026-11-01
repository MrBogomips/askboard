// The ports push delivery adds to ask-core (design decisions 4 and 5), and what its new commands
// return. Both ports are optional members of `CorePorts`: without them ask-core behaves as in E1,
// with every ask unchecked and no notification.

import type { AskState, CollectAskEntry, OpenAsk, OutputEvent } from "@askboard/contract";

/** One tool call as `mcp-tools` names it, so that the record table can bind it (AD-5). */
export type CallIdentity = {
  /** The request's `_meta["claudecode/toolUseId"]`, when it carries one. */
  readonly toolUseId?: string;
  /** The tool's listed name, such as `ask` or `collect`. */
  readonly tool: string;
  /** The ask IDs the call names, in its order. */
  readonly askIds: readonly string[];
};

/**
 * Where an owned ask came from (AD-5, AD-12), as the record table resolves it at the first bind of
 * an `ask`. ask-core keeps it as given and never reads a Claude Code identifier from it.
 */
export type Origin = {
  /** "Main agent" or "Subagent <type>". */
  readonly label: string;
  /** The number of the second and later subagent of one type (design decision 12, task 8.1). */
  readonly ordinal?: number;
  /** The agent's working folder. */
  readonly cwd: string;
  /**
   * The git worktree of `cwd` when it is the project's repository, else the session project root;
   * absent when the session has no project root (AD-12).
   */
  readonly root?: string;
  /**
   * `cwd` relative to the root, as the context header shows it: "." at the root, relative inside
   * it, absolute outside it; absent without a root.
   */
  readonly directory?: string;
  /** git's `--abbrev-ref HEAD`, when git could tell. */
  readonly branch?: string;
  /** The folder name of the worktree's top level, when git could tell. */
  readonly worktree?: string;
};

/** A call bound to its agent record: the agent behind it, as ask-core may know it. */
export type Binding = {
  /** Opaque: the record table maps it to Claude Code's agent ID; ask-core only compares it. */
  readonly ownerKey: string;
  /** Present when the call is an `ask`: the origin the first bound `ask` gives its ask. */
  readonly origin?: Origin;
};

/** `board-host`'s record table (design decision 4), which alone holds Claude Code identifiers. */
export type AgentRecords = {
  /**
   * Binds the call to its record: the one with the call's `tool_use_id`, whatever its age, else,
   * for a call without one, the oldest unbound record of the same tool and ask IDs within the
   * record timeout. A record binds once. Resolves undefined when no record matches.
   */
  bind(call: CallIdentity): Promise<Binding | undefined>;
};

/** What a new ask's system notification shows (FR-23, design decision 9). */
export type Notice = {
  readonly askId: string;
  readonly title: string;
  readonly link: string;
  /** How many questions the ask holds. */
  readonly questions: number;
  /** The ask's `agentName`, when the request named one. */
  readonly agentName?: string;
  /** Absent for an unchecked ask. */
  readonly origin?: Origin;
};

/**
 * Where ask-core writes a diagnostic that is not a failure, such as an unknown Claude Code version:
 * AskBoard's own fixed text, never agent content (AD-11).
 */
export type Diagnose = (text: string) => void;

/**
 * The context header's data (design decision 12): with these, ask-core works out the expected
 * answerer, asking the machine's git user name when an ask names an expected user, and counts a
 * main-conversation wait as waiting only until Claude Code's background threshold, on the core's
 * clock (`CorePorts.clock`). Without them, as in E1, it asks the machine nothing more and no wait
 * ends on a timer.
 */
export type HeaderPorts = {
  /** How long a main-conversation call runs before Claude Code moves it to the background; absent: never. */
  readonly backgroundThresholdMs?: number;
};

/** Who asked and for whom, for the context header's first row (design decision 12). */
export type WhoAsked = {
  /** The owner's origin; absent for an unchecked ask. */
  readonly origin?: Origin;
  /** The ask's `agentName`, when the request named one. */
  readonly agentName?: string;
  /** The expected answerer, only when the header shows "For:". */
  readonly forUser?: string;
};

/** `notifier`: the system notification of a new ask. */
export type Notices = {
  /** Starts the notification and returns at once; it never throws for a failed start. */
  notify(notice: Notice): void;
};

/** Why a call may not act on an owned ask (AD-5): another agent owns it, or the call has no record. */
export type OwnerRefusal = "other-owner" | "no-record";

/** The `ask` outcomes push delivery adds to E1's. */
export type PushAskOutcome =
  /** An identical resend of an owned ask, from a call with no agent record: it may be retried. */
  | { readonly kind: "no-record"; readonly askId: string }
  /**
   * An identical resend of an owned ask, from another agent: the ID is in use by that agent's ask,
   * and resending cannot change that (AD-6).
   */
  | { readonly kind: "other-owner"; readonly askId: string }
  /** The client is a Claude Code older than the contract's minimum (AD-18): nothing was created. */
  | {
      readonly kind: "unsupported-version";
      readonly askId: string;
      readonly version: string;
      readonly minimum: string;
    };

/** The read outcome of a call that may not read an owned ask; it reveals nothing of the ask. */
export type PushReadOutcome = { readonly kind: OwnerRefusal; readonly askId: string };

/** The mod's delivery report (AD-3): `received` raised, already there, or a report to ignore. */
export type DeliveredOutcome = "raised" | "unchanged" | "refused";

/** What a stop block carries. */
export type StopBlock = {
  /** Open asks with events above `received`, in order, each as `collect` returns it. */
  readonly asks: readonly CollectAskEntry[];
  /** The owner's open asks, with their states and latest cursors. */
  readonly openAsks: readonly OpenAsk[];
};

/**
 * An open ask's part of what a stop block may carry: its entry as `collect` returns it, with every
 * event above `received`, and each event's command group in the order of `events`. One board
 * command's events share a group, which a block never splits and which never reaches the wire
 * (AD-20).
 */
export type StopAsk = {
  readonly entry: CollectAskEntry;
  readonly groups: readonly number[];
};

/** What the stop guard hands its fit: every event a block may carry, and every open ask. */
export type StopCandidates = {
  /** Open asks with events above `received`, in order. */
  readonly asks: readonly StopAsk[];
  /** The owner's open asks, with their states and latest cursors. */
  readonly openAsks: readonly OpenAsk[];
};

/**
 * The part of a stop block that fits the caller's response (board-host spec, Stop decisions):
 * given the candidates, the block to send, whose asks hold a leading part of their events, cut
 * only between board commands (AD-20). ask-core raises `received` only to the last event of each
 * ask it returns, and a block cut inside a command is a bug, which throws.
 */
export type StopFit = (candidates: StopCandidates) => StopBlock;

/** The stop guard's decision on an owner's stop (AD-10), already acted on when it returns. */
export type StopOutcome =
  | { readonly decision: "allow" }
  /** `received` now passes the events the block carries, and only those. */
  | ({ readonly decision: "block" } & StopBlock);

/** Where the client version came from: the protocol's client information, or the mod (AD-18). */
export type ClientVersionSource = "client-info" | "mod";

/**
 * An ask of the epoch as the local API reads it (design decision 2): for the mod's poll, the
 * pending-asks list (EXPERIENCE, Counting) and the terminal link's title.
 */
export type AskOverview = {
  readonly askId: string;
  readonly state: AskState;
  readonly title: string;
  readonly link: string;
  /** The ask's `agentName`, when the request named one. */
  readonly agentName?: string;
  /** The owner key and origin; absent for an unchecked ask. */
  readonly owner?: Binding;
  /** The ask's latest cursor. */
  readonly cursor: string;
  /** The events above `received`, in order, each carrying its cursor. */
  readonly unreceived: readonly OutputEvent[];
  /**
   * Each event's command group, in the order of `unreceived`: one board command's events share a
   * number, which the poll's pages never split and which never reaches the wire (AD-20).
   */
  readonly groups: readonly number[];
  /** The questions for which the agent has received neither an answer nor a decline. */
  readonly openQuestions: number;
};
