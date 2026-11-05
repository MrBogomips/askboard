// The board as a component reads it through the port (AD-9; gantt-widget design decisions 7 and
// 10): every widget item the board document holds, as the agent sent it, the draft record, and
// what each item shows. The items are those of every question, areas' included (ask-lifecycle,
// design decision 6), listed once per board document; the shell's document is the latest the agent
// sent, which an agent update replaces, so the board follows it. What an item shows is its draft
// value, else the value its question's latest answer holds for it (molecules, design decision 11,
// option A), so that the board matches the card on a question being revised; the draft record
// gains nothing from it. The board object is made once per items list, answers and draft record,
// so a component that builds from it, such as the Gantt's compute graph, can memoize on its
// identity while none of them changes (cross-review H1).

import type { LifecycleBoardState } from "@askboard/contract";
import type { BoardContent, BoardWidgetItem } from "../catalog/port.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
import type { DraftRecord } from "./draft-store.ts";
import { statusOf } from "./question-state.ts";

/** What the board is made from: the shell's latest board document and the board state. */
export type BoardSource = {
  readonly document: ViewDocument;
  readonly state: LifecycleBoardState;
};

// Each board document's items list; a document is never changed in place, only replaced.
const ITEMS = new WeakMap<ViewDocument, readonly BoardWidgetItem[]>();

/**
 * The board's widget items as sent: each question's items, in board order, frozen; the same list
 * for the same document.
 */
export const boardItemsOf = (document: ViewDocument): readonly BoardWidgetItem[] => {
  const known = ITEMS.get(document);
  if (known !== undefined) return known;
  const items = Object.freeze(questionsOf(document).flatMap(({ props }) => props.items ?? []));
  ITEMS.set(document, items);
  return items;
};

/** Item ID to the value its question's latest answer holds for it. */
type Answered = ReadonlyMap<string, unknown>;

const NO_ANSWERS: Answered = new Map();

// Each widget item's value in its question's latest answer, read as an own property of the
// answer's values, for the items the question holds.
const answeredOf = ({ document, state }: BoardSource): Answered => {
  const entries = questionsOf(document).flatMap((question) => {
    const status = statusOf(state, question.id);
    if (status === undefined || (status.state !== "answered" && status.state !== "declined")) {
      return [];
    }
    const { values }: AnswerContent = status.answer;
    if (values === undefined) return [];
    return (question.props.items ?? []).flatMap(({ id }) =>
      Object.hasOwn(values, id) && values[id] !== undefined ? [[id, values[id]] as const] : [],
    );
  });
  return entries.length === 0 ? NO_ANSWERS : new Map(entries);
};

const sameAnswers = (a: Answered, b: Answered): boolean =>
  a.size === b.size && [...a].every(([id, value]) => b.has(id) && Object.is(b.get(id), value));

// What each item shows: the draft record itself while no answer adds a value it lacks.
const shownOf = (draft: DraftRecord, answered: Answered): ReadonlyMap<string, unknown> => {
  const unedited = [...answered].filter(([id]) => draft.get(id) === undefined);
  return unedited.length === 0 ? draft : new Map([...draft, ...unedited]);
};

/**
 * The board for a draft record, over the items of the document the shell holds now and the
 * answers of its board state: one frozen object per items list, answers and record.
 */
export const createBoardContent = (
  sourceOf: () => BoardSource,
): ((draft: DraftRecord) => BoardContent) => {
  const boards = new WeakMap<
    readonly BoardWidgetItem[],
    WeakMap<Answered, WeakMap<DraftRecord, BoardContent>>
  >();
  // The answers of the last document and state, kept while a new state holds the same values.
  let last: { readonly source: BoardSource; readonly answered: Answered } | undefined;
  const answersOf = (source: BoardSource): Answered => {
    if (last?.source.document === source.document && last.source.state === source.state) {
      return last.answered;
    }
    const found = answeredOf(source);
    const answered =
      last !== undefined && sameAnswers(last.answered, found) ? last.answered : found;
    last = { source, answered };
    return answered;
  };
  return (draft) => {
    const source = sourceOf();
    const items = boardItemsOf(source.document);
    const answered = answersOf(source);
    const byAnswers =
      boards.get(items) ?? new WeakMap<Answered, WeakMap<DraftRecord, BoardContent>>();
    boards.set(items, byAnswers);
    const byRecord = byAnswers.get(answered) ?? new WeakMap<DraftRecord, BoardContent>();
    byAnswers.set(answered, byRecord);
    const known = byRecord.get(draft);
    if (known !== undefined) return known;
    const board: BoardContent = Object.freeze({ items, draft, shown: shownOf(draft, answered) });
    byRecord.set(draft, board);
    return board;
  };
};
