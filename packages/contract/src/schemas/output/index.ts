// The output format (owner `contract`, AD-7): what AskBoard returns to agents inside the tool
// results. E1 defined the answer event of finding F4 with AD-20's generic diff, the discarded event,
// the no-hooks warning and the outcomes `unavailable` and `open`; E3's minor adds the answer's
// "Other…" text, option notes, declines and revisions, the lifecycle events, the states AD-10 lists
// and the outcomes of collect, update and fetch (ask-lifecycle, design decision 2). Push delivery adds
// to that minor the closed event, which ends an ask AskBoard closed because its owning subagent
// finished (task 14.5). Widget-registry's minor adds the annotation and each widget type's result
// schema, and a too-large answer carries no results. It holds no AXFX term (FR-18).

import type { UnresolvedReason } from "../../context/resolution.ts";
import type { FormulaErrorKind } from "../../formula/errors.ts";
import type { SchemaSet } from "../../versions.ts";
import { WIDGET_TYPES } from "../../widgets/registry.ts";
import annotation from "./annotation.json" with { type: "json" };
import answerEvent from "./answer-event.json" with { type: "json" };
import askState from "./ask-state.json" with { type: "json" };
import closedEvent from "./closed-event.json" with { type: "json" };
import cursor from "./cursor.json" with { type: "json" };
import discardedEvent from "./discarded-event.json" with { type: "json" };
import editChoiceEvent from "./edit-choice-event.json" with { type: "json" };
import epoch from "./epoch.json" with { type: "json" };
import followUpEvent from "./follow-up-event.json" with { type: "json" };
import noteEvent from "./note-event.json" with { type: "json" };
import outcome from "./outcome.json" with { type: "json" };
import postponedEvent from "./postponed-event.json" with { type: "json" };
import questionState from "./question-state.json" with { type: "json" };
import reopenedEvent from "./reopened-event.json" with { type: "json" };
import time from "./time.json" with { type: "json" };
import unavailableReason from "./unavailable-reason.json" with { type: "json" };
import warning from "./warning.json" with { type: "json" };

export const OUTPUT_FORMAT_VERSION = "1.4";

export const outputFormat: SchemaSet = {
  name: "output",
  title: "output format",
  owner: "contract",
  version: OUTPUT_FORMAT_VERSION,
  schemas: [
    epoch,
    cursor,
    time,
    askState,
    answerEvent,
    discardedEvent,
    warning,
    outcome,
    unavailableReason,
    questionState,
    postponedEvent,
    reopenedEvent,
    noteEvent,
    followUpEvent,
    editChoiceEvent,
    closedEvent,
    // The annotation widgets' results are made of (widget-registry, design decision 7), then the
    // widget types' changes and result schemas, in registry order (design decisions 4 and 7).
    annotation,
    ...WIDGET_TYPES.flatMap(({ edits, result }) => [
      ...(edits === undefined ? [] : [edits.changes]),
      ...(result === undefined ? [] : [result.schema]),
    ]),
  ],
};

/** AD-10's ask states. */
export type AskState = "waiting" | "partly-answered" | "answered" | "closed" | "discarded";

/**
 * One operation of AD-20's generic diff; a target is a reference without brackets (AD-13). `add`
 * and `move` omit `parent` at the top level and `after` in the first position.
 */
export type Change =
  | {
      readonly op: "add";
      readonly target: string;
      readonly parent?: string;
      readonly after?: string;
      readonly value: unknown;
    }
  | { readonly op: "remove"; readonly target: string }
  | {
      readonly op: "move";
      readonly target: string;
      readonly parent?: string;
      readonly after?: string;
    }
  | { readonly op: "set"; readonly target: string; readonly value: unknown };

export type AnswerEvent = {
  readonly cursor: string;
  readonly type: "answer";
  readonly itemId: string;
  readonly rev: number;
  readonly who: string;
  /** RFC 3339 UTC: when the user acted, as the board stamped it (FR-19). */
  readonly when: string;
  /** The chosen options, by label (finding F5). */
  readonly choice?: readonly string[];
  /** The "Other…" text (FR-3). */
  readonly other?: string;
  /** The user's note on an option, by its label (FR-3). */
  readonly optionNotes?: Readonly<Record<string, string>>;
  /** The open prompt's text, or a decline's reason. */
  readonly note?: string;
  readonly changes?: readonly Change[];
  readonly results?: Readonly<Record<string, unknown>>;
  readonly derived?: Readonly<Record<string, unknown>>;
  /** A decline: it closes the question like an answer, with no content but its reason (FR-4). */
  readonly declined?: true;
  /** The cursor of the answer this revision replaces (FR-22, AD-20). */
  readonly replaces?: string;
  /** Since 1.3: `changes` and `derived` were over `ANSWER_EVENT_MAX_CHARS` and are left out; `fetch` has them. */
  readonly tooLarge?: true;
};

/** One of the six selectors of an annotation (widget-registry, design decision 7). */
export type AnnotationSelector =
  | { readonly type: "element"; readonly id: string }
  | { readonly type: "label"; readonly label: string; readonly occurrence?: number }
  | { readonly type: "region"; readonly value: string }
  | {
      readonly type: "line";
      readonly side: "old" | "new";
      readonly path: string;
      readonly line: number;
    }
  | {
      readonly type: "quote";
      readonly exact: string;
      readonly prefix?: string;
      readonly suffix?: string;
    }
  | { readonly type: "position"; readonly start: number; readonly end: number };

/** A user's note on a place in a widget item's content, as a widget's result holds it. */
export type Annotation = {
  readonly id: string;
  readonly target: { readonly selector: AnnotationSelector };
  readonly body: { readonly text: string };
};

export type DiscardReason = "session-exit" | "board-closed";

export type DiscardedEvent = {
  readonly cursor: string;
  readonly type: "discarded";
  readonly reason: DiscardReason;
};

/**
 * The final event of an ask AskBoard closed because the subagent that owns it finished (push
 * delivery, AD-10): an agent's own close is reported in its call's result and is no event.
 */
export type ClosedEvent = {
  readonly cursor: string;
  readonly type: "closed";
  readonly reason: "agent-finished";
};

export type OutputEvent =
  | AnswerEvent
  | DiscardedEvent
  | PostponedEvent
  | ReopenedEvent
  | NoteEvent
  | FollowUpEvent
  | EditChoiceEvent
  | ClosedEvent;

export type Warning = NoHooksWarning | UnresolvedPointerWarning | FormulaWarning;

export type NoHooksWarning = { readonly code: "no-hooks"; readonly message: string };

/** A context item whose pointer did not resolve, since output format 1.2 (excerpts, design decision 4). */
export type UnresolvedPointerWarning = {
  readonly code: "unresolved-pointer";
  readonly itemId: string;
  readonly pointer: string;
  readonly reason: UnresolvedReason;
  /** The reason in plain words; it names no path outside the root. */
  readonly message: string;
};

/** An item whose formulas the send-time graph check found in error, since output format 1.3 (AD-13). */
export type FormulaWarning = {
  readonly code: "formula";
  /** The item's ID in reference addressing: the ID the agent sent. */
  readonly itemId: string;
  /** The address of the node in error. */
  readonly address: string;
  readonly error: FormulaErrorKind;
  readonly message: string;
};

export type Outcome = "unavailable" | "open" | "postponed" | "closed" | "discarded";

/** AD-18's detection rule, in its order. */
export type UnavailableReason = "remote-host" | "container" | "ci" | "no-browser";

// Output format 1.1 (ask-lifecycle, design decision 2).

/** AD-10's question states. */
export type QuestionState = "open" | "answered" | "postponed" | "declined";

type QuestionEvent = {
  readonly cursor: string;
  readonly itemId: string;
  /** The question's revision the user acted on. */
  readonly rev: number;
};

/** The user postponed the question (FR-4). */
export type PostponedEvent = QuestionEvent & { readonly type: "postponed" };

/** The user undid a sent postpone or decline (FR-4). */
export type ReopenedEvent = QuestionEvent & { readonly type: "reopened" };

/** A note sent without an answer (FR-7). */
export type NoteEvent = QuestionEvent & {
  readonly type: "note";
  readonly who: string;
  readonly when: string;
  readonly note: string;
};

/** A follow-up the agent replies to with `update`, naming this event's cursor (FR-10). */
export type FollowUpEvent = QuestionEvent & {
  readonly type: "follow-up";
  readonly who: string;
  readonly when: string;
  readonly text: string;
};

/** What the user chose about an agent change to a question with unsent work (FR-6, AD-20). */
export type EditChoiceEvent = QuestionEvent & { readonly type: "edit-choice" } & (
    | { readonly edit: "reload" }
    | { readonly edit: "ignore"; readonly keptRev: number }
  );
