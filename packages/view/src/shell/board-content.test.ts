import { describe, expect, test } from "bun:test";
import {
  ganttBoardDocument,
  ganttEditedValue,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewDocument, WidgetItem } from "../view-document.ts";
import { boardItemsOf, createBoardContent } from "./board-content.ts";
import { createDraftStore } from "./draft-store.ts";

// A test-only widget item, never a real widget's (design decision 12 of the tree-widget change).
const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };

const [plain] = plainChoiceBoardDocument.items;
// The plain question with widget items beside its options.
const withItems = (items: readonly WidgetItem[]): ViewDocument => ({
  ...plainChoiceBoardDocument,
  items: [{ ...plain, props: { ...plain.props, items } }],
});

describe("the board's widget items as sent (gantt-widget design decisions 7 and 10)", () => {
  test("a Gantt board gives its Gantt item, as the document holds it", () => {
    const [question] = ganttBoardDocument.items;
    const items = boardItemsOf(ganttBoardDocument);
    expect(items).toEqual([question.props.items[0]]);
    expect(items[0]).toBe(question.props.items[0]);
  });

  test("every widget item of the question, in its order; the question itself is none", () => {
    const second = { ...sketch, id: "second" };
    expect(boardItemsOf(withItems([sketch, second]))).toEqual([sketch, second]);
    expect(boardItemsOf(plainChoiceBoardDocument)).toEqual([]);
  });

  test("the list is frozen", () => {
    expect(Object.isFrozen(boardItemsOf(ganttBoardDocument))).toBe(true);
  });
});

describe("the board a component reads: its items as sent and the draft record (AD-9)", () => {
  const items = boardItemsOf(ganttBoardDocument);

  test("it holds the items and the draft record as they are, read-only", () => {
    const draft = createDraftStore();
    draft.set("release", ganttEditedValue);
    const board = createBoardContent(items)(draft.record());
    expect(board.items).toBe(items);
    expect(board.draft).toBe(draft.record());
    expect(board.draft.get("release")).toBe(ganttEditedValue);
    expect(Object.isFrozen(board)).toBe(true);
  });

  test("the same object for the same draft record, a new one once the record changes", () => {
    const draft = createDraftStore();
    const boardOf = createBoardContent(items);
    const before = boardOf(draft.record());
    expect(boardOf(draft.record())).toBe(before);
    draft.set("release", ganttEditedValue);
    const after = boardOf(draft.record());
    expect(after).not.toBe(before);
    expect(after.items).toBe(before.items);
    expect(before.draft.has("release")).toBe(false);
  });
});
