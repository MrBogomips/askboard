import { describe, expect, test } from "bun:test";
import type { BoardContent } from "@askboard/view/catalog";
import { summaryItemsOf } from "./items.ts";

// The other widget items of the Approval's question, as the summary reads them (design decisions 7
// and 8): each with its props as sent and as shown, those whose type gives no shape left to the
// summary to skip, the Approval itself and the items of other questions left out.
const items = [
  { type: "tree", id: "plan", props: { nodes: [{ id: "a", label: "A" }] } },
  { type: "approval", id: "verdict", props: {} },
  { type: "ranking", id: "order", props: { items: [] } },
  { type: "tree", id: "elsewhere", props: { nodes: [] } },
];

const board = (extra: Partial<BoardContent> = {}): BoardContent => ({
  items,
  questionItems: new Map([
    ["q1", ["plan", "verdict", "order"]],
    ["q2", ["elsewhere"]],
  ]),
  draft: new Map(),
  shown: new Map(),
  ...extra,
});

describe("summaryItemsOf", () => {
  test("lists the question's other widget items in order, with no item of another question or the Approval itself", () => {
    const listed = summaryItemsOf(board(), "q1", "verdict");
    expect(listed.map(({ id, type }) => [id, type])).toEqual([
      ["plan", "tree"],
      ["order", "ranking"],
    ]);
  });

  test("an item that shows nothing but its props shows them as sent", () => {
    const [plan] = summaryItemsOf(board(), "q1", "verdict");
    expect(plan?.shown).toBe(plan?.sent);
  });

  test("an item with a value shows it", () => {
    const edited = { nodes: [{ id: "a", label: "B" }] };
    const [plan] = summaryItemsOf(board({ shown: new Map([["plan", edited]]) }), "q1", "verdict");
    expect(plan?.shown).toBe(edited);
    expect(plan?.sent).toEqual({ nodes: [{ id: "a", label: "A" }] });
  });

  test("a value that is no object shows the props as sent", () => {
    const [plan] = summaryItemsOf(board({ shown: new Map([["plan", 7]]) }), "q1", "verdict");
    expect(plan?.shown).toBe(plan?.sent);
  });

  test("a board that does not say which items a question holds lists none", () => {
    expect(summaryItemsOf(board({ questionItems: undefined }), "q1", "verdict")).toEqual([]);
    expect(summaryItemsOf(board(), "unknown", "verdict")).toEqual([]);
  });

  test("an item the board does not hold is left out, and props that are no object give no item", () => {
    const withGhost = board({ questionItems: new Map([["q1", ["ghost", "plan"]]]) });
    expect(summaryItemsOf(withGhost, "q1", "verdict").map(({ id }) => id)).toEqual(["plan"]);
    const odd = board({ items: [{ type: "tree", id: "plan", props: "x" }] });
    expect(summaryItemsOf(odd, "q1", "verdict")).toEqual([]);
  });
});
