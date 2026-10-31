// The board protocol (owner `board-host`, AD-7): the messages between the board page and
// `board-host` over the board's WebSocket. Each message names the protocol version, whose shared
// schema holds the minor-version rule; a receiver looks a message's schema up by direction and
// `type`, since no schema has a root combinator. E3's minor appends act commands with action IDs,
// the draft record, done and closed, and widens the state, refusals and discards (ask-lifecycle,
// design decisions 2 and 8): a new message's name goes at the end of its direction's list.

import type { SchemaSet } from "../../versions.ts";
import type { BoardDocument, LifecycleBoardDocument } from "../board-document/index.ts";
import act from "./act.json" with { type: "json" };
import answer from "./answer.json" with { type: "json" };
import board from "./board.json" with { type: "json" };
import boardState from "./board-state.json" with { type: "json" };
import closed from "./closed.json" with { type: "json" };
import connect from "./connect.json" with { type: "json" };
import discarded from "./discarded.json" with { type: "json" };
import done from "./done.json" with { type: "json" };
import draft from "./draft.json" with { type: "json" };
import draftRecord from "./draft-record.json" with { type: "json" };
import moved from "./moved.json" with { type: "json" };
import receipt from "./receipt.json" with { type: "json" };
import refused from "./refused.json" with { type: "json" };
import state from "./state.json" with { type: "json" };
import time from "./time.json" with { type: "json" };
import version from "./version.json" with { type: "json" };

export const BOARD_PROTOCOL_VERSION = "1.1";

export const boardProtocol: SchemaSet = {
  name: "board-protocol",
  title: "board protocol",
  owner: "board-host",
  version: BOARD_PROTOCOL_VERSION,
  schemas: [
    version,
    time,
    boardState,
    connect,
    answer,
    board,
    state,
    receipt,
    discarded,
    moved,
    refused,
    draftRecord,
    act,
    draft,
    done,
    closed,
  ],
};

const schemaId = (type: string) => `urn:askboard:board-protocol:${type}`;

/** Each direction's message types, with the `$id` of each type's schema. */
export const BOARD_PROTOCOL_MESSAGES = {
  /** Sent by the board page, received by `board-host`. */
  toHost: {
    connect: schemaId("connect"),
    answer: schemaId("answer"),
    act: schemaId("act"),
    draft: schemaId("draft"),
  },
  /** Sent by `board-host`, received by the board page. */
  toPage: {
    board: schemaId("board"),
    state: schemaId("state"),
    receipt: schemaId("receipt"),
    discarded: schemaId("discarded"),
    moved: schemaId("moved"),
    refused: schemaId("refused"),
    done: schemaId("done"),
    draft: schemaId("draft"),
    closed: schemaId("closed"),
  },
} as const;

export type BoardMessageDirection = keyof typeof BOARD_PROTOCOL_MESSAGES;

/** The first message on every board WebSocket. */
export type ConnectMessage = {
  readonly version: string;
  readonly type: "connect";
  readonly token: string;
};

/** The user's explicit answer: one label unless the question is `multiSelect` (AD-10). */
export type AnswerCommand = {
  readonly version: string;
  readonly type: "answer";
  readonly itemId: string;
  readonly rev: number;
  readonly choice: readonly string[];
  /** RFC 3339 UTC, stamped by the board when the user acted (FR-19). */
  readonly when: string;
};

/**
 * What E1's board page sends. Protocol 1.1 adds act commands and draft records,
 * `LifecyclePageMessage`; this type keeps E1's union until board-host reads them.
 */
export type PageMessage = ConnectMessage | AnswerCommand;

/** "not sent yet" is the board's own receipt, for an answer still queued on the page. */
export type Receipt = "sent" | "delivered";

export type LoggedAnswer = {
  readonly choice: readonly string[];
  readonly when: string;
  readonly receipt: Receipt;
};

export type QuestionStatus =
  | { readonly itemId: string; readonly rev: number; readonly state: "open" }
  | {
      readonly itemId: string;
      readonly rev: number;
      readonly state: "answered";
      readonly answer: LoggedAnswer;
    };

/** E1's board state: one question, waiting or answered. Protocol 1.1's is `LifecycleBoardState`. */
export type BoardState = {
  readonly ask: "waiting" | "answered";
  readonly questions: readonly [QuestionStatus];
};

export type BoardMessage = {
  readonly version: string;
  readonly type: "board";
  readonly document: BoardDocument;
};

export type StateMessage = {
  readonly version: string;
  readonly type: "state";
  readonly state: BoardState;
};

export type ReceiptMessage = {
  readonly version: string;
  readonly type: "receipt";
  readonly itemId: string;
  readonly receipt: "delivered";
};

export type DiscardedMessage = {
  readonly version: string;
  readonly type: "discarded";
  /** `board-closed`: no board reconnected within the grace period (AD-21). */
  readonly reason: "session-exit" | "board-closed";
};

export type MovedMessage = { readonly version: string; readonly type: "moved" };

export type RefusalReason = "token" | "message" | "version" | "answer" | "act" | "closed";

export type RefusedMessage = {
  readonly version: string;
  readonly type: "refused";
  readonly reason: RefusalReason;
  readonly detail: string;
  /** The item of a refused answer command, or of the refused act of an act command. */
  readonly itemId?: string;
  /** The refused act command's action ID: with the reasons `act` and `closed`. */
  readonly actionId?: string;
  /** The index of the act that refused the whole command: with the reason `act`. */
  readonly index?: number;
};

/**
 * What E1's board-host sends. Protocol 1.1's board and state hold several questions, and it adds
 * done, draft and closed, `LifecycleHostMessage`; this type keeps E1's union until the board page
 * reads them.
 */
export type HostMessage =
  | BoardMessage
  | StateMessage
  | ReceiptMessage
  | DiscardedMessage
  | MovedMessage
  | RefusedMessage;

// Board protocol 1.1 (ask-lifecycle, design decisions 2 and 8).

type QuestionAct = { readonly itemId: string; readonly rev: number };

/** An answer: its content fields each optional, since ask-core checks that one is there. */
export type AnswerAct = QuestionAct & {
  readonly type: "answer";
  readonly choice?: readonly string[];
  readonly other?: string;
  readonly optionNotes?: Readonly<Record<string, string>>;
  readonly note?: string;
  /** RFC 3339 UTC, stamped by the board when the user acted (FR-19). */
  readonly when: string;
};

export type DeclineAct = QuestionAct & {
  readonly type: "decline";
  /** The reason, from the open prompt. */
  readonly note?: string;
  readonly when: string;
};

export type PostponeAct = QuestionAct & { readonly type: "postpone" };

/** Undoes a sent postpone or decline (FR-4). */
export type ReopenAct = { readonly type: "reopen"; readonly itemId: string };

export type NoteAct = QuestionAct & {
  readonly type: "note";
  readonly note: string;
  readonly when: string;
};

export type FollowUpAct = QuestionAct & {
  readonly type: "follow-up";
  readonly text: string;
  readonly when: string;
};

/** What the user chose about an agent change to a question with unsent work (FR-6, AD-20). */
export type EditChoiceAct = QuestionAct & { readonly type: "edit-choice" } & (
    | { readonly edit: "reload" }
    | { readonly edit: "ignore"; readonly keptRev: number }
  );

export type Act =
  | AnswerAct
  | DeclineAct
  | PostponeAct
  | ReopenAct
  | NoteAct
  | FollowUpAct
  | EditChoiceAct;

/** One command of acts, applied once per action ID and atomically (AD-20). */
export type ActCommand = {
  readonly version: string;
  readonly type: "act";
  /** 22 base64url characters the board page draws; a resend keeps it. */
  readonly actionId: string;
  readonly acts: readonly [Act, ...Act[]];
};

/**
 * An act held for Submit, in the order the user made it ready: an answer, a decline, a postpone, a
 * note alone, or the undo of a sent postpone or decline (`reopen`).
 */
export type HeldAct = {
  readonly act: "answer" | "decline" | "postpone" | "note" | "reopen";
  readonly order: number;
  /** Made by "Select recommended". */
  readonly byRecommended?: true;
};

/** A question's unsent work, on the revision it was made on. */
export type DraftQuestion = {
  readonly rev: number;
  /** Each item's value, by item ID, as the view's draft store holds it. */
  readonly values?: Readonly<Record<string, unknown>>;
  readonly other?: string;
  readonly optionNotes?: Readonly<Record<string, string>>;
  /** The open prompt's text. */
  readonly note?: string;
  /** The follow-up composer's text. */
  readonly composer?: string;
  readonly held?: HeldAct;
};

/** The board's unsent work (AD-20), held apart from the log; never sent to the agent. */
export type DraftRecord = {
  readonly delivery: "immediate" | "submitted";
  /** The question in view. */
  readonly inView?: string;
  /** By question ID; read as own properties only. */
  readonly questions: Readonly<Record<string, DraftQuestion>>;
};

/** Both directions: the whole draft record. */
export type DraftMessage = {
  readonly version: string;
  readonly type: "draft";
  readonly record: DraftRecord;
};

export type LifecyclePageMessage = PageMessage | ActCommand | DraftMessage;

/** A question's current answer as the board shows it, with its receipt (FR-22). */
export type CurrentAnswer = {
  readonly choice?: readonly string[];
  readonly other?: string;
  readonly optionNotes?: Readonly<Record<string, string>>;
  readonly note?: string;
  readonly declined?: true;
  readonly when: string;
  readonly receipt: Receipt;
  /** The agent recorded it (FR-6, FR-19). */
  readonly recorded?: true;
};

export type ThreadReply = { readonly text: string; readonly when: string };

/** A follow-up the user wrote, with the agent's replies under it (FR-10). */
export type ThreadEntry = {
  /** The follow-up event's cursor. */
  readonly cursor: string;
  readonly who: string;
  readonly when: string;
  readonly text: string;
  readonly replies: readonly ThreadReply[];
};

type StatusExtras = {
  readonly itemId: string;
  readonly rev: number;
  /** The answer before a reopen. */
  readonly previous?: CurrentAnswer;
  readonly thread?: readonly [ThreadEntry, ...ThreadEntry[]];
};

export type LifecycleQuestionStatus = StatusExtras &
  (
    | { readonly state: "open" | "postponed" }
    | { readonly state: "answered" | "declined"; readonly answer: CurrentAnswer }
  );

export type LifecycleBoardState = {
  readonly ask: "waiting" | "partly-answered" | "answered" | "closed";
  readonly questions: readonly [LifecycleQuestionStatus, ...LifecycleQuestionStatus[]];
};

export type LifecycleBoardMessage = {
  readonly version: string;
  readonly type: "board";
  readonly document: LifecycleBoardDocument;
};

export type LifecycleStateMessage = {
  readonly version: string;
  readonly type: "state";
  readonly state: LifecycleBoardState;
};

/** The act command with this action ID is applied, once. */
export type DoneMessage = {
  readonly version: string;
  readonly type: "done";
  readonly actionId: string;
};

/** Why an ask closed: E3 closes only for the agent; a later minor extends it. */
export type ClosedReason = "agent";

export type ClosedMessage = {
  readonly version: string;
  readonly type: "closed";
  readonly reason: ClosedReason;
};

export type LifecycleHostMessage =
  | LifecycleBoardMessage
  | LifecycleStateMessage
  | ReceiptMessage
  | DiscardedMessage
  | MovedMessage
  | RefusedMessage
  | DoneMessage
  | DraftMessage
  | ClosedMessage;
