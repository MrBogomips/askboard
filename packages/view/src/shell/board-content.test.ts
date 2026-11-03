import { describe, expect, test } from "bun:test";
import {
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanBoardDocument,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewArea, ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import { boardItemsOf, createBoardContent } from "./board-content.ts";
import { createDraftStore } from "./draft-store.ts";

// A test-only widget item, never a real widget's (design decision 12 of the tree-widget change).
const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };

const [plain] = plainChoiceBoardDocument.items;
// The plain question with widget items beside its options.
const holding = (items: readonly WidgetItem[]): ViewQuestion => ({
  ...plain,
  props: { ...plain.props, items },
});
const withItems = (items: readonly WidgetItem[]): ViewDocument => ({
  ...plainChoiceBoardDocument,
  items: [holding(items)],
});

// The standalone Gantt's question, and the Gantt plan's question with its Tree.
const [schedule] = ganttBoardDocument.items;
const [release] = schedule.props.items;
const [planQuestion] = ganttPlanBoardDocument.items;
const [wbs, plan] = planQuestion.props.items;

const area = (id: string, items: readonly [ViewQuestion, ...ViewQuestion[]]): ViewArea => ({
  type: "area",
  id,
  props: { title: id, items },
});

// An ask-lifecycle board of areas (ask-lifecycle, design decision 6): the Gantt's question in one
// area, the plain question with a probe item and the plan's question in the other.
const areaBoard: ViewDocument = {
  ...ganttBoardDocument,
  items: [area("timeline", [schedule]), area("scope", [holding([sketch]), planQuestion])],
};

describe("the board's widget items as sent (gantt-widget design decisions 7 and 10)", () => {
  test("a Gantt board gives its Gantt item, as the document holds it", () => {
    const items = boardItemsOf(ganttBoardDocument);
    expect(items).toEqual([release]);
    expect(items[0]).toBe(release);
  });

  test("every widget item of the question, in its order; the question itself is none", () => {
    const second = { ...sketch, id: "second" };
    expect(boardItemsOf(withItems([sketch, second]))).toEqual([sketch, second]);
    expect(boardItemsOf(plainChoiceBoardDocument)).toEqual([]);
  });

  test("a board of areas gives the widget items of each area's questions, in board order, and no question (cross-review H1)", () => {
    expect(boardItemsOf(areaBoard)).toEqual([release, sketch, wbs, plan]);
  });

  test("the list is frozen, one per board document: the same for the same document, a new one for another", () => {
    const items = boardItemsOf(areaBoard);
    expect(Object.isFrozen(items)).toBe(true);
    expect(boardItemsOf(areaBoard)).toBe(items);
    const revised: ViewDocument = { ...areaBoard };
    expect(boardItemsOf(revised)).not.toBe(items);
    expect(boardItemsOf(revised)).toEqual(items);
  });
});

describe("the board a component reads: its items as sent and the draft record (AD-9)", () => {
  test("it holds the document's items and the draft record as they are, read-only", () => {
    const draft = createDraftStore();
    draft.set("release", ganttEditedValue);
    const board = createBoardContent(() => ganttBoardDocument)(draft.record());
    expect(board.items).toBe(boardItemsOf(ganttBoardDocument));
    expect(board.draft).toBe(draft.record());
    expect(board.draft.get("release")).toBe(ganttEditedValue);
    expect(Object.isFrozen(board)).toBe(true);
  });

  test("the same object for the same draft record, a new one once the record changes, over the same items", () => {
    const draft = createDraftStore();
    const boardOf = createBoardContent(() => ganttBoardDocument);
    const before = boardOf(draft.record());
    expect(boardOf(draft.record())).toBe(before);
    draft.set("release", ganttEditedValue);
    const after = boardOf(draft.record());
    expect(after).not.toBe(before);
    expect(after.items).toBe(before.items);
    expect(before.draft.has("release")).toBe(false);
  });

  test("on a board of areas the Gantt reads the widget items, not the questions (cross-review H1)", () => {
    const board = createBoardContent(() => areaBoard)(createDraftStore().record());
    expect(board.items).toEqual([release, sketch, wbs, plan]);
  });

  test("an agent update that replaces the document gives the new document's items: the plan and its Tree it adds (cross-review H1)", () => {
    // The shell's document, which an agent `update.document` replaces (ask-lifecycle, task 6.7).
    let document: ViewDocument = ganttBoardDocument;
    const boardOf = createBoardContent(() => document);
    const draft = createDraftStore();
    draft.set("release", ganttEditedValue);
    const record = draft.record();
    const before = boardOf(record);
    expect(before.items).toEqual([release]);
    document = { ...ganttBoardDocument, items: [schedule, planQuestion] };
    const after = boardOf(record);
    expect(after).not.toBe(before);
    expect(after.items).toEqual([release, wbs, plan]);
    expect(after.items).toBe(boardItemsOf(document));
    expect(after.draft).toBe(record);
    expect(boardOf(record)).toBe(after);
  });

  test("a later draft change on the same document reuses its items list (cross-review H1)", () => {
    let document: ViewDocument = ganttBoardDocument;
    const boardOf = createBoardContent(() => document);
    const draft = createDraftStore();
    document = areaBoard;
    const first = boardOf(draft.record());
    draft.set("release", ganttEditedValue);
    const edited = boardOf(draft.record());
    expect(edited).not.toBe(first);
    expect(edited.items).toBe(first.items);
    expect(edited.draft.get("release")).toBe(ganttEditedValue);
  });
});
