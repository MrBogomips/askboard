// The lifecycle draft (ask-lifecycle, design decision 6; AD-20; EXPERIENCE.md, What a reload
// keeps): beside the draft record of the tree-widget seams, which keeps each item's value, it keeps
// what the board has besides: per question the revision the work was made on, the "Other…" text
// (present while "Other…" is chosen), the user's option notes, the open prompt's text, the
// follow-up composer's text and the act held for Submit, with its order and whether "Select
// recommended" made it; for the board the delivery mode and the question in view. The two together
// are the draft record the board page mirrors to `board-host` and restores after a reload or a
// takeover. Nothing in either leaves the view but through that mirror, and nothing reaches the
// agent until the user acts (AD-10). Each change makes new values; the stores are replaced, never
// changed in place.

import type { DraftQuestion, DraftRecord, HeldAct, LifecycleBoardState } from "@askboard/contract";
import { renderedOf } from "../catalog/components.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
import type { DraftStore, DraftRecord as ValueRecord } from "./draft-store.ts";
import { draftAnswerOf } from "./question-state.ts";

/** A question's work besides its items' values, on the revision it was made on. */
export type QuestionWork = Omit<DraftQuestion, "values"> & {
  /**
   * The held undo (`reopen`) of a sent postpone or decline that a later answer, decline or note
   * was held over: it is held again when that act is taken back or made not ready, so the undo is
   * never lost (AD-20). Only the view keeps it: the draft record holds one act per question.
   */
  readonly undo?: HeldAct;
};

export type Delivery = DraftRecord["delivery"];

/** Where a question's context sits (FR-13): `beside` is the default and is never held. */
export type ContextPlacement = NonNullable<DraftQuestion["context"]>;

export type BoardDraftState = {
  readonly delivery: Delivery;
  readonly inView?: string;
  readonly questions: ReadonlyMap<string, QuestionWork>;
  /**
   * The questions whose context the user placed inline (excerpts, task 6.3). Kept apart from the
   * work, which is tied to a revision: a placement is no answer work and survives a revision.
   */
  readonly placements?: ReadonlyMap<string, ContextPlacement>;
};

export type BoardDraft = {
  get(): BoardDraftState;
  work(questionId: string): QuestionWork | undefined;
  /**
   * Changes a question's work; a question without work starts at `rev`. An edit to the answer's
   * content makes a ready answer or decline not ready (FR-22).
   */
  edit(questionId: string, rev: number, change: (work: QuestionWork) => QuestionWork): void;
  /** Removes these fields of a question's work. */
  clear(questionId: string, fields: readonly (keyof QuestionWork)[]): void;
  /** Drops a question's work, its revision included. */
  forget(questionId: string): void;
  setDelivery(delivery: Delivery): void;
  /** Where the user placed the question's context; none while it is beside. */
  placement(questionId: string): ContextPlacement | undefined;
  /** Places a question's context; `beside` is the default and takes the placement out. */
  setPlacement(questionId: string, placement: ContextPlacement): void;
  setInView(questionId: string | undefined): void;
  /** Replaces the whole draft, as a restore does. */
  replace(state: BoardDraftState): void;
  subscribe(listener: () => void): () => void;
};

// The fields an answer carries: editing one changes the answer the user made ready.
const CONTENT: readonly (keyof QuestionWork)[] = ["other", "optionNotes", "note"];

const sameNotes = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = Object.entries(a);
  return (
    left.length === Object.keys(b).length &&
    left.every(
      ([key, value]) => Object.hasOwn(b, key) && (b as Record<string, unknown>)[key] === value,
    )
  );
};

const changedContent = (before: QuestionWork, after: QuestionWork): boolean =>
  CONTENT.some((field) => !sameNotes(before[field], after[field]));

// The held acts that carry the question's content: an answer, a decline with its reason, and a
// note alone. An edit to the content makes them not ready (FR-22), holding again the undo one was
// held over; a held postpone or undo stays.
const CONTENT_HELD: ReadonlySet<HeldAct["act"]> = new Set(["answer", "decline", "note"]);

const isAnswerHeld = (held: HeldAct | undefined): boolean =>
  held !== undefined && CONTENT_HELD.has(held.act);

/** Takes back the held act; the undo it was held over, if any, is held again. */
export const releaseHeld = ({ held: _, undo, ...work }: QuestionWork): QuestionWork =>
  undo === undefined ? work : { ...work, held: undo };

/** The lifecycle draft, starting with no work in the delivery mode given. */
export const createBoardDraft = (delivery: Delivery): BoardDraft => {
  let state: BoardDraftState = { delivery, questions: new Map() };
  const listeners = new Set<() => void>();
  const set = (next: BoardDraftState) => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };
  const withWork = (questionId: string, work: QuestionWork | undefined): BoardDraftState => {
    const questions = new Map(state.questions);
    if (work === undefined) questions.delete(questionId);
    else questions.set(questionId, Object.freeze(work));
    return { ...state, questions };
  };
  return {
    get: () => state,
    work: (questionId) => state.questions.get(questionId),
    edit: (questionId, rev, change) => {
      const before = state.questions.get(questionId) ?? { rev };
      let after = change(before);
      if (
        after.held === before.held &&
        isAnswerHeld(before.held) &&
        changedContent(before, after)
      ) {
        after = releaseHeld(after);
      }
      set(withWork(questionId, after));
    },
    clear: (questionId, fields) => {
      const before = state.questions.get(questionId);
      if (before === undefined || !fields.some((field) => before[field] !== undefined)) return;
      const after: Record<string, unknown> = { ...before };
      for (const field of fields) delete after[field];
      set(withWork(questionId, after as QuestionWork));
    },
    forget: (questionId) => {
      if (state.questions.has(questionId)) set(withWork(questionId, undefined));
    },
    setDelivery: (next) => {
      if (next !== state.delivery) set({ ...state, delivery: next });
    },
    placement: (questionId) => state.placements?.get(questionId),
    setPlacement: (questionId, placement) => {
      if ((state.placements?.get(questionId) ?? "beside") === placement) return;
      const placements = new Map(state.placements);
      if (placement === "beside") placements.delete(questionId);
      else placements.set(questionId, placement);
      set({ ...state, placements });
    },
    setInView: (questionId) => {
      if (questionId === state.inView) return;
      const { inView: _, ...rest } = state;
      set(questionId === undefined ? rest : { ...rest, inView: questionId });
    },
    replace: (next) => set({ ...next, questions: new Map(next.questions) }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/** The items a question's draft values may name: its own ID with options, then its widgets'. */
export const itemIdsOf = (question: ViewQuestion): readonly string[] =>
  renderedOf(question).map(({ item }) => item.id);

const hasValues = (question: ViewQuestion, values: ValueRecord): boolean =>
  itemIdsOf(question).some((itemId) => values.get(itemId) !== undefined);

const sameValues = (question: ViewQuestion, a: ValueRecord, b: ValueRecord): boolean =>
  itemIdsOf(question).every((itemId) => Object.is(a.get(itemId), b.get(itemId)));

/**
 * Whether the question's draft holds answer work: an item's value, "Other…" chosen, an option note
 * or the open prompt's text. The composer's text and a held act are no answer work: on an answered
 * question, answer work is a revision (ask-lifecycle, task 6.7).
 */
export const hasAnswerWork = (
  question: ViewQuestion,
  values: ValueRecord,
  work: QuestionWork | undefined,
): boolean =>
  hasValues(question, values) ||
  work?.other !== undefined ||
  Object.keys(work?.optionNotes ?? {}).length > 0 ||
  (work?.note !== undefined && work.note !== "");

// Work holding nothing but its revision.
const isBare = (work: QuestionWork): boolean => Object.keys(work).every((key) => key === "rev");

/**
 * Keeps the two stores together: a value the user puts in starts the question's work at its
 * revision, an edit to a ready answer's values makes it not ready, and work that holds nothing
 * any more is dropped with its revision. Returns what stops it.
 */
export const connectDrafts = (
  document: ViewDocument | (() => ViewDocument),
  values: DraftStore,
  board: BoardDraft,
): (() => void) => {
  const documentOf = typeof document === "function" ? document : () => document;
  let previous = values.record();
  const onValues = () => {
    const record = values.record();
    for (const question of questionsOf(documentOf())) {
      if (sameValues(question, previous, record)) continue;
      const work = board.work(question.id);
      if (hasValues(question, record) && work === undefined) {
        board.edit(question.id, question.rev, (fresh) => fresh);
      } else if (work !== undefined && isAnswerHeld(work.held)) {
        board.edit(question.id, work.rev, releaseHeld);
      }
    }
    previous = record;
    prune();
  };
  const prune = () => {
    const record = values.record();
    for (const question of questionsOf(documentOf())) {
      const work = board.work(question.id);
      if (work !== undefined && isBare(work) && !hasValues(question, record)) {
        board.forget(question.id);
      }
    }
  };
  const stopValues = values.subscribe(onValues);
  const stopBoard = board.subscribe(prune);
  return () => {
    stopValues();
    stopBoard();
  };
};

const filled = (text: string | undefined): text is string => text !== undefined && text !== "";

const filledNotes = (
  notes: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined => {
  const kept = Object.entries(notes ?? {}).filter(([, note]) => filled(note));
  return kept.length === 0 ? undefined : Object.fromEntries(kept);
};

// One question's entry in the record, if it has work.
const questionEntry = (
  question: ViewQuestion,
  values: ValueRecord,
  work: QuestionWork | undefined,
  placement: ContextPlacement | undefined,
): DraftQuestion | undefined => {
  const held = itemIdsOf(question).flatMap((itemId) => {
    const value = values.get(itemId);
    return value === undefined ? [] : [[itemId, value] as const];
  });
  const optionNotes = filledNotes(work?.optionNotes);
  const fields = {
    ...(held.length === 0 ? {} : { values: Object.fromEntries(held) }),
    ...(work?.other === undefined ? {} : { other: work.other }),
    ...(optionNotes === undefined ? {} : { optionNotes }),
    ...(filled(work?.note) ? { note: work.note } : {}),
    ...(filled(work?.composer) ? { composer: work.composer } : {}),
    ...(work?.held === undefined ? {} : { held: work.held }),
    ...(placement === undefined ? {} : { context: placement }),
  };
  return Object.keys(fields).length === 0
    ? undefined
    : { rev: work?.rev ?? question.rev, ...fields };
};

/** The draft record the board page mirrors: both stores, for the questions the board holds. */
export const draftRecordOf = (
  document: ViewDocument,
  values: ValueRecord,
  board: BoardDraftState,
): DraftRecord => {
  const questions = questionsOf(document);
  const entries = questions.flatMap((question) => {
    const entry = questionEntry(
      question,
      values,
      board.questions.get(question.id),
      board.placements?.get(question.id),
    );
    return entry === undefined ? [] : [[question.id, entry] as const];
  });
  const inView =
    board.inView !== undefined && questions.some((question) => question.id === board.inView)
      ? { inView: board.inView }
      : {};
  return { delivery: board.delivery, ...inView, questions: Object.fromEntries(entries) };
};

const isLabels = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((label) => typeof label === "string");

const sameLabels = (
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean =>
  left === undefined
    ? right === undefined
    : right !== undefined &&
      left.length === right.length &&
      left.every((label, at) => label === right[at]);

const sameTextRecord = (
  left: Readonly<Record<string, string>> | undefined,
  right: Readonly<Record<string, string>> | undefined,
): boolean => {
  const a = left ?? {};
  const b = right ?? {};
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key])
  );
};

const hasValuesIn = (values: Readonly<Record<string, unknown>>): boolean =>
  Object.keys(values).length > 0;

const isRestoredAnswer = (
  question: ViewQuestion,
  entry: DraftQuestion,
  state: LifecycleBoardState,
): boolean => {
  const status = state.questions.find((each) => each.itemId === question.id);
  if (
    status === undefined ||
    (status.state !== "answered" && status.state !== "declined") ||
    status.rev !== question.rev ||
    entry.rev !== question.rev
  ) {
    return false;
  }
  const expectedHeld = status.state === "declined" ? "decline" : "answer";
  if (entry.held !== undefined && entry.held.act !== expectedHeld) return false;
  const itemValues = entry.values ?? {};
  if (Object.keys(itemValues).some((itemId) => itemId !== question.id)) return false;
  const choice = itemValues[question.id];
  if (choice !== undefined && !isLabels(choice)) return false;
  return (
    sameLabels(status.answer.choice, choice as readonly string[] | undefined) &&
    status.answer.other === entry.other &&
    status.answer.note === entry.note &&
    sameTextRecord(status.answer.optionNotes, entry.optionNotes)
  );
};

/**
 * Puts a restored draft record back into both stores (FR-25): the work on the questions the board
 * still holds, each item's value where it names one of that question's items (a question's own
 * value only as option labels), the delivery mode (immediate on a single-question board) and the
 * question in view. A mirrored answer identical to the board's current answer is stale, not a
 * revision; work on another revision or with different content stays. The work keeps its revision.
 */
export const restoreDraft = (
  record: DraftRecord,
  document: ViewDocument,
  state: LifecycleBoardState,
  values: DraftStore,
  board: BoardDraft,
): void => {
  const questions = questionsOf(document);
  const work = new Map<string, QuestionWork>();
  const placements = new Map<string, ContextPlacement>();
  for (const question of questions) {
    if (!Object.hasOwn(record.questions, question.id)) continue;
    const entry = record.questions[question.id] as DraftQuestion;
    const staleAnswer = isRestoredAnswer(question, entry, state);
    const { values: kept = {}, context, ...rest } = entry;
    if (context === "inline") placements.set(question.id, context);
    const items = new Set(itemIdsOf(question));
    if (!staleAnswer) {
      for (const [itemId, value] of Object.entries(kept)) {
        if (!items.has(itemId) || (itemId === question.id && !isLabels(value))) continue;
        values.set(itemId, value);
      }
    }
    const held = staleAnswer
      ? { rev: rest.rev, ...(rest.composer === undefined ? {} : { composer: rest.composer }) }
      : rest;
    // An entry holding only a placement is no work.
    if (Object.keys(held).some((key) => key !== "rev") || hasValuesIn(kept))
      work.set(question.id, held);
  }
  const inView = questions.some((question) => question.id === record.inView)
    ? { inView: record.inView as string }
    : {};
  const delivery = questions.length === 1 ? "immediate" : record.delivery;
  board.replace({ delivery, ...inView, questions: work, placements });
};

/**
 * What "Answer" sends for a question: its choice and each changed widget item's value (the
 * seam's), the "Other…" text while "Other…" is chosen and has text, the notes on options and the
 * open prompt's note, each only when given (FR-3, FR-7, FR-18).
 */
export const answerContentOf = (
  question: ViewQuestion,
  values: ValueRecord,
  work: QuestionWork | undefined,
): AnswerContent => {
  const optionNotes = filledNotes(work?.optionNotes);
  return {
    ...draftAnswerOf(question, values),
    ...(filled(work?.other) ? { other: work.other } : {}),
    ...(optionNotes === undefined ? {} : { optionNotes }),
    ...(filled(work?.note) ? { note: work.note } : {}),
  };
};
