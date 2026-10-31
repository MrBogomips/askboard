// What a question card shows (EXPERIENCE.md, Question card, Answer and Delivery receipt): from the
// question's status in the board state, its draft answer (the choice, and the value of each widget
// item the user changed, design decision 7; since the ask lifecycle also the "Other…" text, the
// option notes and the open prompt's note), the command the user has just sent touching it, if
// any, whether its items have loaded, whether the board page locked the board, and whether its
// answer is ready for Submit. A command on its way shows what it sent, read-only, with its receipt,
// until the board page settles it. An answered or declined question shows its latest answer with
// that answer's receipt, and stays editable while the ask is open: once the user edits it, the card
// shows the draft as a revision, which "Answer" sends as the delivery mode says (ask-lifecycle,
// task 6.7; FR-22). Nothing can be chosen or answered before the question is visible, once one of
// its items failed (AD-9, AD-10), on a board that moved, was discarded or closed (AD-21, FR-6), and
// nothing answered while an agent-change notice waits for the user's choice. Postpone, Decline and
// Explain follow `cardActions` (task 6.5; FR-4, FR-10).

import type { HeldAct, LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import type { ViewQuestion } from "../view-document.ts";
import type { AnswerContent, ViewAnswer, ViewLock } from "../view-protocol.ts";
import type { Flight } from "./answer-acts.ts";
import type { DraftRecord } from "./draft-store.ts";
import type { QuestionStatus as Load } from "./ready-tracker.ts";

/** The board's receipt texts (EXPERIENCE.md, Voice and Tone). */
export type ReceiptText = "not sent yet" | "sent" | "delivered to the agent";

const RECEIPTS = {
  queued: "not sent yet",
  sent: "sent",
  delivered: "delivered to the agent",
} as const;

export type CardInputs = {
  readonly status: LifecycleQuestionStatus | undefined;
  readonly draft: AnswerContent;
  /** The latest command the user sent that holds an act on the question, until it settles. */
  readonly flight?: Flight | undefined;
  readonly load: Load;
  readonly lock?: ViewLock | undefined;
  /** In submitted delivery, the answer is marked ready for Submit. */
  readonly ready: boolean;
  /** The user has edited an answered or declined question: the draft is a revision. */
  readonly editing?: boolean;
  /** An agent-change notice waits for the user's choice (FR-6). */
  readonly pending?: boolean;
};

export type CardState = {
  readonly phase: "open" | "sending" | "answered" | "declined";
  /** What the card's items and fields show in place of the draft: an answer's content. */
  readonly shown?: AnswerContent;
  readonly receipt?: ReceiptText;
  readonly readOnly: boolean;
  readonly canAnswer: boolean;
  /** "Answer" would send the open prompt's note alone, leaving the question open (FR-7). */
  readonly noteOnly: boolean;
  readonly ready: boolean;
};

/** The question's choice: the option labels Choice put in the draft record, none while unset. */
export const choiceOf = (value: unknown): readonly string[] => (Array.isArray(value) ? value : []);

/**
 * What "Answer" would send now: the question's choice, if it has one, and the draft value of each
 * of its widget items that holds one, which a widget sets only while it differs from the agent's
 * content (design decision 7). Built with own properties only, so any item ID is a plain key.
 */
export const draftAnswerOf = (question: ViewQuestion, record: DraftRecord): AnswerContent => {
  const choice = choiceOf(record.get(question.id));
  const changed = (question.props.items ?? []).flatMap(({ id }) => {
    const value = record.get(id);
    return value === undefined ? [] : [[id, value] as const];
  });
  return {
    ...(choice.length === 0 ? {} : { choice }),
    ...(changed.length === 0 ? {} : { values: Object.fromEntries(changed) }),
  };
};

/**
 * The answer with the derived values its widget items last reported (gantt-widget design decision
 * 10, FR-12): those of each item it carries a value for, in the question's order, so nothing for
 * an untouched item; no `derived` field when none of them reported any.
 */
export const withDerived = (
  answer: AnswerContent,
  reported: (itemId: string) => Readonly<Record<string, unknown>> | undefined,
): AnswerContent => {
  const entries = Object.keys(answer.values ?? {}).flatMap((itemId) =>
    Object.entries(reported(itemId) ?? {}),
  );
  return entries.length === 0 ? answer : { ...answer, derived: Object.fromEntries(entries) };
};

/**
 * What an item of the card shows in place of its draft value, if anything: the shown choice for
 * the question's own options, the shown value for a widget item, looked up as an own property.
 */
export const shownFor = (
  shown: AnswerContent | undefined,
  questionId: string,
  itemId: string,
): unknown => {
  if (shown === undefined) return undefined;
  if (itemId === questionId) return shown.choice;
  const { values } = shown;
  return values !== undefined && Object.hasOwn(values, itemId) ? values[itemId] : undefined;
};

export const statusOf = (
  state: LifecycleBoardState,
  itemId: string,
): LifecycleQuestionStatus | undefined =>
  state.questions.find((question) => question.itemId === itemId);

const closed = { canAnswer: false, noteOnly: false, readOnly: true } as const;

// The flight's answer for this question, as its items show it while it is sent.
const sentAnswer = (flight: Flight, questionId: string): AnswerContent | undefined => {
  const act = flight.acts.find((each) => each.itemId === questionId && each.type === "answer");
  return act?.type === "answer" ? contentOf(act) : undefined;
};

export const cardState = ({
  status,
  draft,
  flight,
  load,
  lock,
  ready,
  editing = false,
  pending = false,
}: CardInputs): CardState => {
  const logged = status?.state === "answered" || status?.state === "declined" ? status : undefined;
  if (flight !== undefined) {
    const shown = sentAnswer(flight, status?.itemId ?? "");
    return {
      phase: "sending",
      ...(shown === undefined ? {} : { shown }),
      ...(flight.outcome === undefined ? {} : { receipt: RECEIPTS[flight.outcome] }),
      ...closed,
      ready: false,
    };
  }
  const answerable = status !== undefined && load === "visible" && lock === undefined;
  const receipt = logged === undefined ? {} : { receipt: RECEIPTS[logged.answer.receipt] };
  if (logged !== undefined && !editing) {
    return {
      phase: logged.state,
      shown: contentOf(logged.answer),
      ...receipt,
      readOnly: !answerable,
      canAnswer: false,
      noteOnly: false,
      ready: false,
    };
  }
  const answers =
    draft.choice !== undefined || draft.values !== undefined || draft.other !== undefined;
  // A note alone goes on an open or postponed question; on an answered one it is no revision.
  const noted = draft.note !== undefined && logged === undefined;
  return {
    phase: "open",
    ...receipt,
    readOnly: !answerable,
    canAnswer: answerable && !pending && (answers || noted),
    noteOnly: !answers && noted,
    ready,
  };
};

/** What Postpone, Decline and Explain read (EXPERIENCE.md, Postpone, Decline and Explain). */
export type ActionInputs = {
  readonly status: LifecycleQuestionStatus | undefined;
  /** The act held for Submit on the question, if any. */
  readonly held: HeldAct["act"] | undefined;
  /** The held act sits over the held undo of the sent postpone or decline. */
  readonly undone?: boolean;
  /** A command of the card's acts is on its way. */
  readonly sending: boolean;
  readonly load: Load;
  readonly lock?: ViewLock | undefined;
  /** An agent-change notice waits for the user's choice. */
  readonly pending: boolean;
  /** An Explain follow-up waits for its reply. */
  readonly explaining: boolean;
};

export type CardActions = {
  /** Postpone shows pressed: the question is postponed, or a postpone is held, and no undo. */
  readonly postponed: boolean;
  readonly canPostpone: boolean;
  /** Decline shows chosen: the question is declined, or a decline is held, and no undo. */
  readonly declined: boolean;
  readonly canDecline: boolean;
  readonly canExplain: boolean;
};

/**
 * Postpone and Decline undo when pressed again; Postpone is disabled on an answered, declined or
 * ready question, Decline on an answered or ready one (FR-4, F-37); neither acts while the card's
 * command is on its way or a notice waits. Explain is disabled until its reply arrives (F-103).
 */
export const cardActions = (inputs: ActionInputs): CardActions => {
  const { status, held, undone = false, sending, load, lock, pending, explaining } = inputs;
  const state = status?.state;
  const usable = status !== undefined && load === "visible" && lock === undefined;
  const free = usable && !sending && !pending;
  const ready = held === "answer" || held === "decline";
  const undo = held === "reopen" || undone;
  return {
    postponed: (state === "postponed" && !undo) || held === "postpone",
    canPostpone: free && state !== "answered" && state !== "declined" && !ready,
    declined: (state === "declined" && !undo) || held === "decline",
    canDecline: free && state !== "answered" && held !== "answer",
    canExplain: usable && !explaining,
  };
};

/**
 * An answer's content alone, with the choice copied: the fields it has, never one set to
 * undefined, since the view protocol refuses a field that is present and not valid.
 */
export const contentOf = ({
  choice,
  values,
  derived,
  other,
  optionNotes,
  note,
}: AnswerContent): AnswerContent => ({
  ...(choice === undefined ? {} : { choice: [...choice] }),
  ...(values === undefined ? {} : { values }),
  ...(derived === undefined ? {} : { derived }),
  ...(other === undefined ? {} : { other }),
  ...(optionNotes === undefined ? {} : { optionNotes: { ...optionNotes } }),
  ...(note === undefined ? {} : { note }),
});

/** The answer view message for the draft's answer, stamped with the time of the act. */
export const answerOf = (question: ViewQuestion, draft: AnswerContent, at: Date): ViewAnswer => ({
  type: "answer",
  itemId: question.id,
  rev: question.rev,
  ...contentOf(draft),
  when: at.toISOString(),
});
