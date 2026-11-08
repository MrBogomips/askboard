// The board as a component reads it through the port (AD-9; gantt-widget design decisions 7 and
// 10): every widget item the board document holds, as the agent sent it, the draft record, and
// what each item shows. The items are those of every question, areas' included (ask-lifecycle,
// design decision 6), listed once per board document; the shell's document is the latest the agent
// sent, which an agent update replaces, so the board follows it. What an item shows is its draft
// value, else the value its question's latest answer holds for it (molecules, design decision 11,
// option A), so that the board matches the card on an answered question; once a revision of the
// question has started, its draft alone (reopen-start-from-answer, design decision 2): the start
// copied every value the answer holds into the draft, so an empty one is an edit returned to the
// agent's props and is not filled again. The draft record gains nothing from it. The board object is made once per items list, answers and draft record,
// so a component that builds from it, such as the Gantt's compute graph, can memoize on its
// identity while none of them changes (cross-review H1).

import type { LifecycleBoardState } from "@askboard/contract";
import {
  type BoardContent,
  type BoardWidgetItem,
  type ComponentFacts,
  componentFacts,
} from "../catalog/port.ts";
import { nestedWidgetItemsOf, valueItemsOf } from "../nested-items.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
import { resultFits } from "./board-draft.ts";
import type { DraftRecord } from "./draft-store.ts";
import { type CheckFactsOf, itemCheckFailure } from "./field-block.ts";
import { statusIndexOf, unchangedOf } from "./question-state.ts";

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
  const items = Object.freeze(
    questionsOf(document).flatMap(({ props }) => nestedWidgetItemsOf(props.items)),
  );
  ITEMS.set(document, items);
  return items;
};

// Each board document's question-to-items map, as `ITEMS` is.
const QUESTION_ITEMS = new WeakMap<ViewDocument, ReadonlyMap<string, readonly string[]>>();

/**
 * Each question's widget items' IDs, in order, by question ID (approval-scale-ranking, design
 * decision 7), for every question of the board, areas' included, and an empty list for a question
 * with none; frozen, and the same for the same document. A component reads its siblings from it.
 */
export const widgetItemsByQuestion = (
  document: ViewDocument,
): ReadonlyMap<string, readonly string[]> => {
  const known = QUESTION_ITEMS.get(document);
  if (known !== undefined) return known;
  const byQuestion = new Map(
    questionsOf(document).map(
      ({ id, props }) =>
        [id, Object.freeze(nestedWidgetItemsOf(props.items).map((item) => item.id))] as const,
    ),
  );
  QUESTION_ITEMS.set(document, byQuestion);
  return byQuestion;
};

/** Item ID to the value its question's latest answer holds for it. */
type Answered = ReadonlyMap<string, unknown>;

const NO_ANSWERS: Answered = new Map();

// Each widget item's value in its question's latest answer, read as an own property of the
// answer's values, for the items the question holds, and for no question with a revision under way.
const answeredOf = ({ document, state }: BoardSource, revising: ReadonlySet<string>): Answered => {
  const statuses = statusIndexOf(state);
  const entries = questionsOf(document).flatMap((question) => {
    const status = statuses.get(question.id);
    if (status === undefined || (status.state !== "answered" && status.state !== "declined")) {
      return [];
    }
    if (revising.has(question.id)) return [];
    const { values }: AnswerContent = status.answer;
    if (values === undefined) return [];
    // Only an item the answer lists as unchanged shows its value: an edit the agent's revision
    // overtook shows as the agent sent it (reopen-start-from-answer, decision 2). Results go as before.
    const unchanged = unchangedOf(status.answer, "current");
    return valueItemsOf(question.props.items).flatMap(({ id }) =>
      Object.hasOwn(values, id) && values[id] !== undefined && unchanged(id)
        ? [[id, values[id]] as const]
        : [],
    );
  });
  return entries.length === 0 ? NO_ANSWERS : new Map(entries);
};

/**
 * The result each widget item's question's latest answer holds for it, by item ID, read as an own
 * property of the answer's `results` and only for the items the question holds: what an item
 * shows of its result while the user holds none (widget-registry, design decision 9), where its
 * type's `fits` takes it on the item's current props.
 */
export const answeredResultsOf = (
  { document, state }: BoardSource,
  factsOf: (type: string) => ComponentFacts | undefined = componentFacts,
): Answered => {
  const statuses = statusIndexOf(state);
  const entries = questionsOf(document).flatMap((question) => {
    const status = statuses.get(question.id);
    if (status === undefined || (status.state !== "answered" && status.state !== "declined")) {
      return [];
    }
    const { results }: AnswerContent = status.answer;
    if (results === undefined) return [];
    // Only a result its item's type still takes on the item's current props is shown: one the
    // agent's revision no longer takes is not (reopen-start-from-answer, decision 2).
    return valueItemsOf(question.props.items).flatMap(({ id }) =>
      Object.hasOwn(results, id) &&
      results[id] !== undefined &&
      resultFits(question, id, results[id], factsOf)
        ? [[id, results[id]] as const]
        : [],
    );
  });
  return entries.length === 0 ? NO_ANSWERS : new Map(entries);
};

/**
 * A lookup of `answeredResultsOf` over the board as it stands now, made again only when the
 * document or the state is replaced.
 */
export const createAnsweredResults = (
  sourceOf: () => BoardSource,
  factsOf?: (type: string) => ComponentFacts | undefined,
): ((itemId: string) => unknown) => {
  let last: { readonly source: BoardSource; readonly results: Answered } | undefined;
  return (itemId) => {
    const source = sourceOf();
    if (last?.source.document !== source.document || last.source.state !== source.state) {
      last = { source, results: answeredResultsOf(source, factsOf) };
    }
    return last.results.get(itemId);
  };
};

// The ID of each item of a board, made once per items list.
const ITEMS_BY_ID = new WeakMap<readonly BoardWidgetItem[], ReadonlyMap<string, BoardWidgetItem>>();

const itemsById = (board: BoardContent): ReadonlyMap<string, BoardWidgetItem> => {
  const known = ITEMS_BY_ID.get(board.items);
  if (known !== undefined) return known;
  const byId = new Map(board.items.map((item) => [item.id, item] as const));
  ITEMS_BY_ID.set(board.items, byId);
  return byId;
};

// The IDs of the items whose held result fails their check, once per board and results record: the
// check of a TextField runs its pattern, which is not repeated for every item that reads the board.
const FAILING = new WeakMap<BoardContent, WeakMap<DraftRecord, readonly string[]>>();
const NO_IDS: readonly string[] = Object.freeze([]);

const failingIds = (
  board: BoardContent,
  results: DraftRecord,
  factsOf: CheckFactsOf | undefined,
): readonly string[] => {
  const compute = (): readonly string[] => {
    const byId = itemsById(board);
    return [...results].flatMap(([id, result]) => {
      const item = byId.get(id);
      return item === undefined ||
        result === undefined ||
        itemCheckFailure(item, result, factsOf) === undefined
        ? []
        : [id];
    });
  };
  if (factsOf !== undefined) return compute();
  const byRecord = FAILING.get(board) ?? new WeakMap<DraftRecord, readonly string[]>();
  FAILING.set(board, byRecord);
  const known = byRecord.get(results);
  if (known !== undefined) return known;
  const ids = compute();
  byRecord.set(results, ids);
  return ids;
};

// The boards that hold entries or failing fields, by board and the IDs they hold, so that a
// component may memoize on the board while the set is the same.
const WITH_ENTRIES = new WeakMap<BoardContent, Map<string, BoardContent>>();

/**
 * The board with the IDs of the items whose fields need a correction (`BoardContent.entries`,
 * layouts design decision 6; form-widget, design decision 5): those that hold an entry and those
 * whose held result fails their field check on a value (`kind: "check"`; an empty required field
 * adds none). The same board while none does, else one frozen board per board and set of IDs. The
 * Tabs read it for the mark of a tab that holds a field to correct. `results` and `factsOf` default
 * to none and to the registered facts.
 */
export const withEntries = (
  board: BoardContent,
  entries: DraftRecord,
  results?: DraftRecord,
  factsOf?: CheckFactsOf,
): BoardContent => {
  const held = [...entries].filter(([, text]) => text !== undefined).map(([id]) => id);
  const failing = results === undefined ? NO_IDS : failingIds(board, results, factsOf);
  const ids = [...new Set([...held, ...failing])];
  if (ids.length === 0) return board;
  const bySet = WITH_ENTRIES.get(board) ?? new Map<string, BoardContent>();
  WITH_ENTRIES.set(board, bySet);
  const key = [...ids].sort().join("\n");
  const known = bySet.get(key);
  if (known !== undefined) return known;
  const marked: BoardContent = Object.freeze({ ...board, entries: new Set(ids) });
  bySet.set(key, marked);
  return marked;
};

const sameAnswers = (a: Answered, b: Answered): boolean =>
  a.size === b.size && [...a].every(([id, value]) => b.has(id) && Object.is(b.get(id), value));

// What each item shows: the draft record itself while no answer adds a value it lacks.
const shownOf = (draft: DraftRecord, answered: Answered): ReadonlyMap<string, unknown> => {
  const unedited = [...answered].filter(([id]) => draft.get(id) === undefined);
  return unedited.length === 0 ? draft : new Map([...draft, ...unedited]);
};

const NO_REVISING: ReadonlySet<string> = new Set();

/**
 * The board for a draft record, over the items of the document the shell holds now and the
 * answers of its board state: one frozen object per items list, answers and record. A question
 * in the set `revisingOf` gives (the revising snapshot, which returns the same set while its
 * content is the same) shows its draft alone, whatever its answer holds; the default is none.
 */
export const createBoardContent = (
  sourceOf: () => BoardSource,
  revisingOf: () => ReadonlySet<string> = () => NO_REVISING,
): ((draft: DraftRecord) => BoardContent) => {
  const boards = new WeakMap<
    readonly BoardWidgetItem[],
    WeakMap<Answered, WeakMap<DraftRecord, BoardContent>>
  >();
  // The answers of the last document, state and set of revisions under way, kept while a new one
  // holds the same values.
  let last:
    | {
        readonly source: BoardSource;
        readonly revising: ReadonlySet<string>;
        readonly answered: Answered;
      }
    | undefined;
  const answersOf = (source: BoardSource): Answered => {
    const revising = revisingOf();
    if (
      last?.source.document === source.document &&
      last.source.state === source.state &&
      last.revising === revising
    ) {
      return last.answered;
    }
    const found = answeredOf(source, revising);
    const answered =
      last !== undefined && sameAnswers(last.answered, found) ? last.answered : found;
    last = { source, revising, answered };
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
    const board: BoardContent = Object.freeze({
      items,
      questionItems: widgetItemsByQuestion(source.document),
      draft,
      shown: shownOf(draft, answered),
    });
    byRecord.set(draft, board);
    return board;
  };
};
