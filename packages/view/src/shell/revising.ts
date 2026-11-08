// Which questions are under revision (reopen-start-from-answer, design decision 2): one predicate
// the card, its first edit and the board share, and the set of answered questions it finds, a
// snapshot made once per change of its inputs that every item reads and follows. The board shows
// the logged answer only for a question outside the set, as it shows the results (Issue #107).

import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import { type Revisions, workingQuestion } from "./agent-change.ts";
import type { BoardSource } from "./board-content.ts";
import { type BoardDraft, hasAnswerWork, type QuestionWork } from "./board-draft.ts";
import { entriesWithCells } from "./cell-entries.ts";
import type { DraftRecord, DraftStore } from "./draft-store.ts";
import { answeredIdsOf } from "./question-state.ts";
import type { Store } from "./store.ts";

/** What the predicate reads of one question's work; `entries` has the cell entries merged in. */
export type RevisingInput = {
  readonly work: QuestionWork | undefined;
  readonly revisions: Revisions;
  readonly values: DraftRecord;
  readonly results?: DraftRecord | undefined;
  readonly entries?: DraftRecord | undefined;
};

/**
 * Whether the question's work holds an edit of its answer: `hasAnswerWork` on the revision the
 * work was made on (`workingQuestion`), over the values, results and entries as the stores hold
 * them. The one predicate: the card's `useCard` and `revise` and the snapshot below call it, so
 * the board and the card never disagree.
 */
export const questionRevising = (
  question: ViewQuestion,
  { work, revisions, values, results, entries }: RevisingInput,
): boolean =>
  hasAnswerWork(workingQuestion(question, work, revisions), values, work, results, entries);

/** The set of answered or declined questions under revision, by ID, and what follows it. */
export type RevisingSnapshot = {
  /** The same set while its content is the same: replaced only when a question joins or leaves. */
  get(): ReadonlySet<string>;
  /** Called after a change of the stores leaves the set with other content. */
  subscribe(listener: () => void): () => void;
};

export type RevisingStores = {
  readonly view: Pick<Store<BoardSource>, "get" | "subscribe">;
  readonly draft: DraftStore;
  readonly board: BoardDraft;
  readonly revisions: Revisions;
  readonly results?: DraftStore | undefined;
  readonly entries?: DraftStore | undefined;
  readonly cellEntries?: DraftStore | undefined;
};

const NONE: ReadonlySet<string> = new Set();

// Each board document's questions by ID, made once per document (a document is replaced, never
// changed in place).
const QUESTIONS = new WeakMap<ViewDocument, ReadonlyMap<string, ViewQuestion>>();

const questionIndexOf = (document: ViewDocument): ReadonlyMap<string, ViewQuestion> => {
  const known = QUESTIONS.get(document);
  if (known !== undefined) return known;
  const index = new Map(questionsOf(document).map((question) => [question.id, question] as const));
  QUESTIONS.set(document, index);
  return index;
};

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id));

/**
 * The revising set over the stores. It is computed once per change of its inputs, the identities
 * of the document, the state, the draft, results, entries and cell-entry records and the board's
 * work, whoever reads it and however often; a board that holds no answered or declined question
 * costs a lookup. `predicate` is the test of one question (`questionRevising`).
 */
export const createRevisingSnapshot = (
  stores: RevisingStores,
  predicate: (question: ViewQuestion, input: RevisingInput) => boolean = questionRevising,
): RevisingSnapshot => {
  const { view, draft, board, revisions, results, entries, cellEntries } = stores;
  let last: { readonly keys: readonly unknown[]; readonly set: ReadonlySet<string> } | undefined;
  const keysOf = (source: BoardSource): readonly unknown[] => [
    source.document,
    source.state,
    draft.record(),
    results?.record(),
    entries?.record(),
    cellEntries?.record(),
    board.get().questions,
  ];
  const compute = (source: BoardSource): ReadonlySet<string> => {
    const answered = answeredIdsOf(source.state);
    if (answered.length === 0) return NONE;
    const byId = questionIndexOf(source.document);
    const values = draft.record();
    const heldResults = results?.record();
    const typed = entriesWithCells(entries?.record(), cellEntries?.record());
    const ids = answered.filter((id) => {
      const question = byId.get(id);
      return (
        question !== undefined &&
        predicate(question, {
          work: board.work(id),
          revisions,
          values,
          results: heldResults,
          entries: typed,
        })
      );
    });
    return ids.length === 0 ? NONE : new Set(ids);
  };
  const get = (): ReadonlySet<string> => {
    const source = view.get();
    const keys = keysOf(source);
    if (last !== undefined && keys.every((key, index) => Object.is(key, last?.keys[index]))) {
      return last.set;
    }
    const found = compute(source);
    const set = last !== undefined && sameSet(last.set, found) ? last.set : found;
    last = { keys, set };
    return set;
  };
  const listeners = new Set<() => void>();
  // What the listeners were last told; a read between a change and its notice never hides it.
  let announced: ReadonlySet<string> = NONE;
  const refresh = () => {
    const set = get();
    if (set === announced) return;
    announced = set;
    for (const listener of [...listeners]) listener();
  };
  let unwatch: (() => void) | undefined;
  return {
    get,
    subscribe: (listener) => {
      if (listeners.size === 0) {
        announced = get();
        const watched = [view, draft, board, results, entries, cellEntries];
        const stops = watched.flatMap((store) =>
          store === undefined ? [] : [store.subscribe(refresh)],
        );
        unwatch = () => {
          for (const stop of stops) stop();
        };
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unwatch?.();
          unwatch = undefined;
        }
      };
    },
  };
};
