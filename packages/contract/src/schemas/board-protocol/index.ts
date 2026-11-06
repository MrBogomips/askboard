// The board protocol (owner `board-host`, AD-7): the messages between the board page and
// `board-host` over the board's WebSocket. Each message names the protocol version, whose shared
// schema holds the minor-version rule; a receiver looks a message's schema up by direction and
// `type`, since no schema has a root combinator. E3's minor appends act commands with action IDs,
// the draft record, done and closed, and widens the state, refusals and discards (ask-lifecycle,
// design decisions 2 and 8): a new message's name goes at the end of its direction's list. E5's
// minor appends the reading panel's and the editor's messages (excerpts, design decision 5), and
// E8's minor appends the settings in effect and a board's write of one presentation key
// (settings-languages, design decision 6).
// E7's the Snapshot request and its two replies (snapshot design decision 2).

import type { EditorOutcome, SourceStatus } from "../../context/resolution.ts";
import type { SchemaSet } from "../../versions.ts";
import type { BoardDocument, LifecycleBoardDocument } from "../board-document/index.ts";
import type {
  ConfigurationKey,
  ConfigurationValues,
  PresentationKey,
} from "../configuration/index.ts";
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
import editorOutcome from "./editor-outcome.json" with { type: "json" };
import moved from "./moved.json" with { type: "json" };
import openEditor from "./open-editor.json" with { type: "json" };
import openSource from "./open-source.json" with { type: "json" };
import receipt from "./receipt.json" with { type: "json" };
import refused from "./refused.json" with { type: "json" };
import setting from "./setting.json" with { type: "json" };
import settings from "./settings.json" with { type: "json" };
import snapshot from "./snapshot.json" with { type: "json" };
import snapshotFailed from "./snapshot-failed.json" with { type: "json" };
import snapshotSaved from "./snapshot-saved.json" with { type: "json" };
import sourceState from "./source-state.json" with { type: "json" };
import state from "./state.json" with { type: "json" };
import time from "./time.json" with { type: "json" };
import version from "./version.json" with { type: "json" };

export const BOARD_PROTOCOL_VERSION = "1.5";

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
    openSource,
    openEditor,
    sourceState,
    editorOutcome,
    // E7 (snapshot, design decision 2): the Snapshot request and its two replies.
    snapshot,
    snapshotSaved,
    snapshotFailed,
    // E8 (settings-languages, design decision 6): the settings in effect and a board's write of one.
    settings,
    setting,
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
    "open-source": schemaId("open-source"),
    "open-editor": schemaId("open-editor"),
    snapshot: schemaId("snapshot"),
    setting: schemaId("setting"),
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
    "source-state": schemaId("source-state"),
    "editor-outcome": schemaId("editor-outcome"),
    "snapshot-saved": schemaId("snapshot-saved"),
    "snapshot-failed": schemaId("snapshot-failed"),
    settings: schemaId("settings"),
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
  /** Since 1.5: each changed widget item's full edited props, by item ID (AD-20). */
  readonly values?: Readonly<Record<string, unknown>>;
  /** Since 1.5: the question's derived values as they stood, by reference (AD-13). */
  readonly derived?: Readonly<Record<string, unknown>>;
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
  /** Where the user placed the question's context, since 1.2; never unsent work (excerpts). */
  readonly context?: "beside" | "inline";
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
  /** Since 1.5: the logged full props of each widget item the answer changed, by item ID. */
  readonly values?: Readonly<Record<string, unknown>>;
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

/**
 * Why an ask closed: the agent closed it, or AskBoard did because the subagent that owns it
 * finished (push delivery, AD-10).
 */
export type ClosedReason = "agent" | "agent-finished";

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

// Board protocol 1.2 (excerpts, design decision 5): the reading panel's and the editor's messages.
// None carries a path the page chose (AD-8).

/** The page asks for a source's state, naming the item only. */
export type OpenSourceCommand = {
  readonly version: string;
  readonly type: "open-source";
  readonly itemId: string;
};

/** The user's click on "Open in editor", naming the item only. */
export type OpenEditorCommand = {
  readonly version: string;
  readonly type: "open-editor";
  readonly itemId: string;
};

/** A source's state now, for the reading panel's header. */
export type SourceStateMessage = {
  readonly version: string;
  readonly type: "source-state";
  readonly itemId: string;
  readonly status: SourceStatus;
  /** An excerpt's range differs from the text the agent sent. */
  readonly changed?: boolean;
  /** The anchor's current first line. */
  readonly line?: number;
  /** An editor is set and the file is available. */
  readonly editor: boolean;
};

export type EditorOutcomeMessage = {
  readonly version: string;
  readonly type: "editor-outcome";
  readonly itemId: string;
  readonly outcome: EditorOutcome;
};

export type ContextPageMessage = OpenSourceCommand | OpenEditorCommand;

export type ContextHostMessage = SourceStateMessage | EditorOutcomeMessage;
// Board protocol 1.4 (settings-languages, design decision 6).

/** Where a key in effect comes from. */
export type SettingSource = "project" | "user" | "default";

/** A configuration file, as a warning or another value names it. */
export type SettingsFileName = "user" | "project";

export type SettingWarningCode =
  | "unknown-key"
  | "project-editor-ignored"
  | "editor-file-writable-by-others"
  | "snapshot-folder-replaced";

export type SettingWarning = {
  readonly code: SettingWarningCode;
  readonly file: SettingsFileName;
  readonly key: string;
  /** The value replaced, for `snapshot-folder-replaced`. */
  readonly value?: string;
};

/** One key in effect; `value` is absent only for `editor` and `defaultMinimumMargin`. */
export type SettingRow<T> = {
  readonly value?: T;
  readonly from: SettingSource;
  /** A presentation key the project does not set. */
  readonly writable: boolean;
  /** The other file's value when both set the key; it is not used. */
  readonly other?: { readonly file: SettingsFileName; readonly value: T };
  readonly warnings?: readonly [SettingWarning, ...SettingWarning[]];
};

export type SettingsRows = {
  readonly [K in ConfigurationKey]: SettingRow<ConfigurationValues[K]>;
};

export type FileProblemCode = "unreadable" | "not-json" | "version" | "schema";

export type FileProblem = {
  readonly code: FileProblemCode;
  /** The JSON pointer of a schema or version failure. */
  readonly pointer?: string;
  /** Ajv's keyword of a schema failure. */
  readonly keyword?: string;
  /** The system's error code of an unreadable file. */
  readonly error?: string;
};

export type SettingsFile =
  | { readonly path?: string; readonly status: "applied" | "absent" }
  | { readonly path?: string; readonly status: "not-applied"; readonly problem: FileProblem };

export type WriteOutcome = {
  readonly key: PresentationKey;
  readonly outcome: "saved" | "refused" | "failed";
  /** `set-by-project` or `file-not-applied` when refused; the error's code when failed. */
  readonly reason?: string;
  readonly path?: string;
};

/** The settings in effect, before the board on every connect and after each write. */
export type SettingsMessage = {
  readonly version: string;
  readonly type: "settings";
  readonly keys: SettingsRows;
  readonly files: { readonly user: SettingsFile; readonly project: SettingsFile };
  /** The warnings no row holds. */
  readonly warnings: readonly SettingWarning[];
  readonly write?: WriteOutcome;
};

/** One presentation key and a value the configuration schema allows for it. */
export type PresentationSetting = {
  readonly [K in PresentationKey]: { readonly key: K; readonly value: ConfigurationValues[K] };
}[PresentationKey];

/** The board page's write of one presentation key. */
export type SettingCommand = {
  readonly version: string;
  readonly type: "setting";
} & PresentationSetting;

// Board protocol 1.3 (snapshot, design decision 2).

/** Board page to `board-host`: take a Snapshot; never resent (FR-26). */
export type SnapshotCommand = {
  readonly version: string;
  readonly type: "snapshot";
  /** 22 base64url characters the board page draws, as an action ID is. */
  readonly requestId: string;
  /** The board held unsent work, which the Snapshot leaves out. */
  readonly unsentWork?: true;
};

/** The Snapshot of that request is written, at this absolute path. */
export type SnapshotSavedMessage = {
  readonly version: string;
  readonly type: "snapshot-saved";
  readonly requestId: string;
  readonly path: string;
};

/** Why no Snapshot was written: only `write-failed` names the Snapshot folder. */
export type SnapshotFailedMessage = {
  readonly version: string;
  readonly type: "snapshot-failed";
  readonly requestId: string;
} & (
  | { readonly reason: "write-failed"; readonly folder: string }
  | { readonly reason: "no-project-root" | "internal-error" | "discarded" }
);

/** What `board-host` answers a Snapshot request with. */
export type SnapshotReply = SnapshotSavedMessage | SnapshotFailedMessage;
