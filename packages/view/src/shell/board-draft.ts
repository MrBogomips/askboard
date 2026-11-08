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

import {
  type DraftQuestion,
  type DraftRecord,
  type HeldAct,
  type LifecycleBoardState,
  resultHoldsNothing,
} from "@askboard/contract";
import { type ComponentFacts, componentFacts } from "../catalog/port.ts";
import { nestedItemById, valueItemsOf } from "../nested-items.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
import type { ShownOf } from "./agent-change.ts";
import {
  cellEntryIdsOf,
  cutCellEntries,
  entriesWithCells,
  fitCellEntries,
} from "./cell-entries.ts";
import type { DraftStore, DraftRecord as ValueRecord } from "./draft-store.ts";
import { cutEntry, entryIdsOf, fieldEntryIdsOf } from "./entries.ts";
import { draftAnswerOf } from "./question-state.ts";

/** A question's work besides its items' values, on the revision it was made on. */
export type QuestionWork = Omit<DraftQuestion, "values" | "results" | "entries" | "cellEntries"> & {
  /**
   * The held undo (`reopen`) of a sent postpone or decline that a later answer, decline or note
   * was held over: it is held again when that act is taken back or made not ready, so the undo is
   * never lost (AD-20). Only the view keeps it: the draft record holds one act per question.
   */
  readonly undo?: HeldAct;
};

export type Delivery = DraftRecord["delivery"];

/** Where a question's context sits (FR-13): held only when it differs from the board's default. */
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
  /** Places a question's context; a placement equal to the board's default takes it out. */
  setPlacement(questionId: string, placement: ContextPlacement): void;
  /** Where the question's context sits: its own placement, else the board's default. */
  effectivePlacement(questionId: string): ContextPlacement;
  /** The board's default placement, the presentation's `contextPlacement` (design decision 1). */
  setDefaultPlacement(placement: ContextPlacement): void;
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
  // Kept beside the state, which a restore replaces: the default is the user's setting, not work.
  let fallback: ContextPlacement = "beside";
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
      if ((state.placements?.get(questionId) ?? fallback) === placement) return;
      const placements = new Map(state.placements);
      if (placement === fallback) placements.delete(questionId);
      else placements.set(questionId, placement);
      set({ ...state, placements });
    },
    effectivePlacement: (questionId) => state.placements?.get(questionId) ?? fallback,
    setDefaultPlacement: (placement) => {
      if (placement === fallback) return;
      fallback = placement;
      set({ ...state });
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

/**
 * The items a question's draft values may name: its own ID with options, then its widgets', at
 * every depth of its layouts and never a layout's, which holds nothing in the draft (layouts,
 * design decision 6).
 */
export const itemIdsOf = (question: ViewQuestion): readonly string[] => [
  ...(question.props.options === undefined ? [] : [question.id]),
  ...valueItemsOf(question.props.items).map((item) => item.id),
];

/**
 * The items a question's results may name: its widget items, never the question itself, whose
 * options give no result (widget-registry, design decision 9).
 */
export const resultIdsOf = (question: ViewQuestion): readonly string[] =>
  itemIdsOf(question).filter((itemId) => itemId !== question.id);

/**
 * Whether `result` may be held for the widget item `itemId` of `question`, as the question shows
 * it: the item's type takes it against the item's props, by the `fits` its chunk registered
 * (approval-scale-ranking, pre-PR reviews, "A draft holds only results its items accept"). The
 * board page then never holds a result that `ask-core` would refuse, so "Answer" is never enabled
 * by work the item shows as untouched (AD-10, AD-20). A type that registered no `fits`, and one
 * with no facts at all, takes no result, never any; an item the question lacks takes none.
 */
export const resultFits = (
  question: ViewQuestion,
  itemId: string,
  result: unknown,
  factsOf: (type: string) => ComponentFacts | undefined = componentFacts,
): boolean => {
  const item = nestedItemById(question.props.items, itemId);
  return item !== undefined && factsOf(item.type)?.fits?.(result, item.props) === true;
};

/**
 * Whether the draft may hold `value` for the widget item `itemId` of `question`, as the question
 * shows it: the item's type, by the `valueFits` its chunk registered, shows it on the item's props
 * (latex-kanban-timeline, task 5b.2; security review X-2, "An answer sends what its widgets
 * show"). A type that registered none keeps its values as they are; an item the question lacks
 * takes none.
 */
export const valueFits = (
  question: ViewQuestion,
  itemId: string,
  value: unknown,
  factsOf: (type: string) => ComponentFacts | undefined = componentFacts,
): boolean => {
  const item = nestedItemById(question.props.items, itemId);
  if (item === undefined) return false;
  const fits = factsOf(item.type)?.valueFits;
  return fits === undefined || fits(value, item.props);
};

/**
 * Whether a held value no longer belongs to the card: its type registered a check and either the
 * card shows a revision other than the one the work was made on, so that the work's base is not
 * the shown props and the item would count the agent's own changes as the user's, or the shown
 * revision does not fit it (`valueFits`).
 */
export const valueDropped = (
  shown: ViewQuestion,
  workRev: number,
  itemId: string,
  value: unknown,
  factsOf: (type: string) => ComponentFacts | undefined = componentFacts,
): boolean => {
  const item = nestedItemById(shown.props.items, itemId);
  if (item === undefined || factsOf(item.type)?.valueFits === undefined) return false;
  return shown.rev !== workRev || !valueFits(shown, itemId, value, factsOf);
};

// No held results: the results store of a board that has none.
const NO_RESULTS: ValueRecord = new Map();

/**
 * The item IDs a draft reader walks for a question: those of the question the board holds and, when
 * the card shows another revision (after "Keep mine" the one the work was made on), those of that
 * revision too, so that work held only on an item a later revision removed is neither forgotten,
 * nor left unmirrored, nor kept ready when it is edited (document-review, design decision 15;
 * review S-2 of 6.14). The same question gives the one list.
 */
const idsOver = (
  read: (question: ViewQuestion) => readonly string[],
  question: ViewQuestion,
  shown: ViewQuestion,
): readonly string[] =>
  shown === question ? read(question) : [...new Set([...read(question), ...read(shown)])];

const hasValues = (
  question: ViewQuestion,
  values: ValueRecord,
  results: ValueRecord = NO_RESULTS,
  entries: ValueRecord = NO_RESULTS,
  shown: ViewQuestion = question,
): boolean =>
  idsOver(itemIdsOf, question, shown).some((itemId) => values.get(itemId) !== undefined) ||
  idsOver(resultIdsOf, question, shown).some((itemId) => results.get(itemId) !== undefined) ||
  idsOver(entryIdsOf, question, shown).some((itemId) => entries.get(itemId) !== undefined);

const sameValues = (
  question: ViewQuestion,
  a: ValueRecord,
  b: ValueRecord,
  resultsA: ValueRecord = NO_RESULTS,
  resultsB: ValueRecord = NO_RESULTS,
  entriesA: ValueRecord = NO_RESULTS,
  entriesB: ValueRecord = NO_RESULTS,
  shown: ViewQuestion = question,
): boolean =>
  idsOver(itemIdsOf, question, shown).every((itemId) => Object.is(a.get(itemId), b.get(itemId))) &&
  idsOver(resultIdsOf, question, shown).every((itemId) =>
    Object.is(resultsA.get(itemId), resultsB.get(itemId)),
  ) &&
  idsOver(entryIdsOf, question, shown).every((itemId) =>
    Object.is(entriesA.get(itemId), entriesB.get(itemId)),
  );

/**
 * Whether the question's draft holds answer work: an item's value, result or entry, "Other…"
 * chosen, an option note or the open prompt's text. The composer's text and a held act are no answer work: on an answered
 * question, answer work is a revision (ask-lifecycle, task 6.7).
 */
export const hasAnswerWork = (
  question: ViewQuestion,
  values: ValueRecord,
  work: QuestionWork | undefined,
  results: ValueRecord = NO_RESULTS,
  entries: ValueRecord = NO_RESULTS,
): boolean =>
  hasValues(question, values, results, entries) ||
  work?.other !== undefined ||
  Object.keys(work?.optionNotes ?? {}).length > 0 ||
  (work?.note !== undefined && work.note !== "");

// Work holding nothing but its revision.
const isBare = (work: QuestionWork): boolean => Object.keys(work).every((key) => key === "rev");

/**
 * Keeps the two stores together: a value the user puts in starts the question's work at its
 * revision, an edit to a ready answer's values makes it not ready, and work that holds nothing
 * any more is dropped with its revision. Returns what stops it. `shownOf` gives the question as the
 * card shows it: the readers walk the items of that revision too, as the work was made on it.
 */
export const connectDrafts = (
  document: ViewDocument | (() => ViewDocument),
  values: DraftStore,
  board: BoardDraft,
  results?: DraftStore,
  entries?: DraftStore,
  cellEntries?: DraftStore,
  shownOf?: ShownOf,
): (() => void) => {
  const shownIn = (question: ViewQuestion): ViewQuestion => shownOf?.(question) ?? question;
  const documentOf = typeof document === "function" ? document : () => document;
  const resultsNow = () => results?.record() ?? NO_RESULTS;
  // Every entry the board holds, the fields' and the Tables' cells', through the one function.
  const entriesNow = () => entriesWithCells(entries?.record(), cellEntries?.record());
  let previous = values.record();
  let previousResults = resultsNow();
  let previousEntries = entriesNow();
  const onValues = () => {
    const record = values.record();
    const held = resultsNow();
    const typed = entriesNow();
    for (const question of questionsOf(documentOf())) {
      const shown = shownIn(question);
      if (
        sameValues(question, previous, record, previousResults, held, previousEntries, typed, shown)
      ) {
        continue;
      }
      const work = board.work(question.id);
      if (hasValues(question, record, held, typed) && work === undefined) {
        board.edit(question.id, question.rev, (fresh) => fresh);
      } else if (work !== undefined && isAnswerHeld(work.held)) {
        board.edit(question.id, work.rev, releaseHeld);
      }
    }
    previous = record;
    previousResults = held;
    previousEntries = typed;
    prune();
  };
  const prune = () => {
    const record = values.record();
    for (const question of questionsOf(documentOf())) {
      const work = board.work(question.id);
      if (
        work !== undefined &&
        isBare(work) &&
        !hasValues(question, record, resultsNow(), entriesNow(), shownIn(question))
      ) {
        board.forget(question.id);
      }
    }
  };
  const stopValues = values.subscribe(onValues);
  const stopResults = results?.subscribe(onValues);
  const stopEntries = entries?.subscribe(onValues);
  const stopCells = cellEntries?.subscribe(onValues);
  const stopBoard = board.subscribe(prune);
  return () => {
    stopValues();
    stopResults?.();
    stopEntries?.();
    stopCells?.();
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
  results: ValueRecord,
  entries: ValueRecord,
  cells: ValueRecord,
  work: QuestionWork | undefined,
  placement: ContextPlacement | undefined,
  shown: ViewQuestion,
): DraftQuestion | undefined => {
  const held = idsOver(itemIdsOf, question, shown).flatMap((itemId) => {
    const value = values.get(itemId);
    return value === undefined ? [] : [[itemId, value] as const];
  });
  const resulting = idsOver(resultIdsOf, question, shown).flatMap((itemId) => {
    const value = results.get(itemId);
    return value === undefined ? [] : [[itemId, value] as const];
  });
  // The text of each item that holds an entry, cut at the limit, never of an item that holds none.
  const typed = idsOver(fieldEntryIdsOf, question, shown).flatMap((itemId) => {
    const text = cutEntry(entries.get(itemId));
    return text === undefined ? [] : [[itemId, text] as const];
  });
  // The cell entries of each Table that holds some, cut at the limits, never of an item that is no
  // Table of the question: a map of `row.field` to text, own keys, so `__proto__.rate` is data.
  const typedCells = idsOver(cellEntryIdsOf, question, shown).flatMap((itemId) => {
    const cut = cutCellEntries(cells.get(itemId));
    return cut === undefined ? [] : [[itemId, Object.fromEntries(cut)] as const];
  });
  const optionNotes = filledNotes(work?.optionNotes);
  const fields = {
    ...(held.length === 0 ? {} : { values: Object.fromEntries(held) }),
    ...(resulting.length === 0 ? {} : { results: Object.fromEntries(resulting) }),
    ...(typed.length === 0 ? {} : { entries: Object.fromEntries(typed) }),
    ...(typedCells.length === 0 ? {} : { cellEntries: Object.fromEntries(typedCells) }),
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

/**
 * The draft record the board page mirrors: both stores, for the questions the board holds. A
 * question's entry names the items of the revision the card shows too (`shownOf`), as the work was
 * made on it.
 */
export const draftRecordOf = (
  document: ViewDocument,
  values: ValueRecord,
  board: BoardDraftState,
  results: ValueRecord = NO_RESULTS,
  typed: ValueRecord = NO_RESULTS,
  cells: ValueRecord = NO_RESULTS,
  shownOf?: ShownOf,
): DraftRecord => {
  const questions = questionsOf(document);
  const entries = questions.flatMap((question) => {
    const entry = questionEntry(
      question,
      values,
      results,
      typed,
      cells,
      board.questions.get(question.id),
      board.placements?.get(question.id),
      shownOf?.(question) ?? question,
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

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

// Deep equality of two JSON values, objects by own keys, whatever their order. A mirrored record
// is at most as deep as the board protocol takes, so the recursion is bounded.
const sameJson = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
  );
};

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
  // The answer holds no entry: text left in a field makes the draft differ from it.
  if (Object.keys(entry.entries ?? {}).length > 0) return false;
  if (Object.keys(entry.cellEntries ?? {}).length > 0) return false;
  const itemValues = entry.values ?? {};
  if (Object.keys(itemValues).some((itemId) => itemId !== question.id)) return false;
  const choice = itemValues[question.id];
  if (choice !== undefined && !isLabels(choice)) return false;
  return (
    sameLabels(status.answer.choice, choice as readonly string[] | undefined) &&
    sameJson(status.answer.results ?? {}, entry.results ?? {}) &&
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
  results?: DraftStore,
  factsOf?: (type: string) => ComponentFacts | undefined,
  entries?: DraftStore,
  cellEntries?: DraftStore,
): void => {
  const questions = questionsOf(document);
  const work = new Map<string, QuestionWork>();
  const placements = new Map<string, ContextPlacement>();
  for (const question of questions) {
    if (!Object.hasOwn(record.questions, question.id)) continue;
    const entry = record.questions[question.id] as DraftQuestion;
    const staleAnswer = isRestoredAnswer(question, entry, state);
    const {
      values: kept = {},
      results: keptResults = {},
      entries: keptEntries = {},
      cellEntries: keptCells = {},
      context,
      ...rest
    } = entry;
    if (context !== undefined) placements.set(question.id, context);
    const items = new Set(itemIdsOf(question));
    const widgets = new Set(resultIdsOf(question));
    // An entry is held only for an item of an entry type, as a cut text; an item that holds one
    // gives no result, so a record naming both keeps the entry (the text the user sees).
    const typedIds = new Set(fieldEntryIdsOf(question));
    const typed = Object.entries(keptEntries).flatMap(([itemId, text]) => {
      const cut = typedIds.has(itemId) ? cutEntry(text) : undefined;
      return cut === undefined ? [] : [[itemId, cut] as const];
    });
    const typedNow = new Set(typed.map(([itemId]) => itemId));
    // A result is checked against the props it was made for: those of the question as it is, when
    // the work was made on this revision. Work on an earlier revision keeps its results, which the
    // card's "Keep mine" checks against what the card then shows, and "Reload" drops.
    const takes = (itemId: string, result: unknown): boolean =>
      rest.rev !== question.rev || resultFits(question, itemId, result, factsOf);
    // A widget's value is held on the same terms: on this revision only while the shown props fit
    // it; work on an earlier revision keeps it for "Keep mine" to settle.
    const takesValue = (itemId: string, value: unknown): boolean =>
      rest.rev !== question.rev || valueFits(question, itemId, value, factsOf);
    const refused = new Set(
      Object.entries(kept)
        .filter(([itemId, value]) => widgets.has(itemId) && !takesValue(itemId, value))
        .map(([itemId]) => itemId),
    );
    const keptValues = Object.fromEntries(
      Object.entries(kept).filter(([itemId]) => !refused.has(itemId)),
    );
    // The cell entries of a Table, each cut, then kept only for an input cell of the value the
    // Table holds: the restored value where it keeps one, else the props as the question shows them.
    const tables = new Set(cellEntryIdsOf(question));
    const typedCells = Object.entries(keptCells).flatMap(([itemId, texts]) => {
      // A value dropped here takes its cell entries with it (table-widget review S-1).
      if (!tables.has(itemId) || refused.has(itemId)) return [];
      const cut = cutCellEntries(new Map(Object.entries(texts ?? {})));
      const held = Object.hasOwn(keptValues, itemId) ? keptValues[itemId] : undefined;
      const props = held ?? nestedItemById(question.props.items, itemId)?.props;
      const fitting = cut === undefined ? undefined : fitCellEntries(cut, props);
      return fitting === undefined ? [] : [[itemId, fitting] as const];
    });
    if (!staleAnswer) {
      for (const [itemId, value] of Object.entries(keptValues)) {
        if (!items.has(itemId) || (itemId === question.id && !isLabels(value))) continue;
        values.set(itemId, value);
      }
      // Each result where it names a widget item of the question, as a value does, and only
      // while the item's type takes it (a mirror holding one it refuses is no work of the user's).
      for (const [itemId, result] of Object.entries(keptResults)) {
        if (
          widgets.has(itemId) &&
          !typedNow.has(itemId) &&
          !resultHoldsNothing(result) &&
          takes(itemId, result)
        ) {
          results?.set(itemId, result);
        }
      }
      for (const [itemId, text] of typed) entries?.set(itemId, text);
      for (const [itemId, held] of typedCells) cellEntries?.set(itemId, held);
    }
    const held = staleAnswer
      ? { rev: rest.rev, ...(rest.composer === undefined ? {} : { composer: rest.composer }) }
      : rest;
    // An entry holding only a placement is no work.
    if (
      Object.keys(held).some((key) => key !== "rev") ||
      hasValuesIn(keptValues) ||
      typed.length > 0 ||
      typedCells.length > 0 ||
      Object.entries(keptResults).some(
        ([itemId, r]) =>
          !typedNow.has(itemId) &&
          !resultHoldsNothing(r) &&
          !(widgets.has(itemId) && !takes(itemId, r)),
      )
    )
      work.set(question.id, held);
  }
  const inView = questions.some((question) => question.id === record.inView)
    ? { inView: record.inView as string }
    : {};
  const delivery = questions.length === 1 ? "immediate" : record.delivery;
  board.replace({ delivery, ...inView, questions: work, placements });
};

/**
 * What "Answer" sends for a question: its choice, each changed widget item's value (the
 * seam's) and each result a widget item holds, the "Other…" text while "Other…" is chosen and has text, the notes on options and the
 * open prompt's note, each only when given (FR-3, FR-7, FR-18).
 */
export const answerContentOf = (
  question: ViewQuestion,
  values: ValueRecord,
  work: QuestionWork | undefined,
  results: ValueRecord = NO_RESULTS,
): AnswerContent => {
  const optionNotes = filledNotes(work?.optionNotes);
  return {
    ...draftAnswerOf(question, values, results),
    ...(filled(work?.other) ? { other: work.other } : {}),
    ...(optionNotes === undefined ? {} : { optionNotes }),
    ...(filled(work?.note) ? { note: work.note } : {}),
  };
};
