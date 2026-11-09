import { describe, expect, test } from "bun:test";
import { KANBAN_FIXTURE_ITEM, KANBAN_ORDER_ITEM } from "@askboard/contract/fixtures";
import { afterDrop, indicatorOf, lineOf, slotAt } from "./drop.ts";
import { columnsOf } from "./model.ts";

// The Kanban's drag as plain data (view-and-widgets spec: Kanban moves by drag; design decisions 6
// and 9; kanban-order): the place under the pointer, the state a drag is in, which column shows
// the outline and which card the line, and the props a drop makes.
const PROPS = KANBAN_FIXTURE_ITEM.props;
const ORDER = KANBAN_ORDER_ITEM.props;
const TODO = ["fix-login", "add-sso", "audit"];
const DOING = ["write-docs", "review"];

describe("slotAt", () => {
  test("counts the cards whose vertical middle is above the pointer", () => {
    const middles = [100, 140, 180];
    expect(slotAt(middles, 20)).toBe(0);
    expect(slotAt(middles, 99)).toBe(0);
    expect(slotAt(middles, 101)).toBe(1);
    expect(slotAt(middles, 139)).toBe(1);
    expect(slotAt(middles, 150)).toBe(2);
    expect(slotAt(middles, 181)).toBe(3);
    expect(slotAt(middles, 900)).toBe(3);
  });

  test("a pointer on a middle counts that card as above it: before the first card whose middle is below", () => {
    expect(slotAt([100, 140], 100)).toBe(1);
    expect(slotAt([100, 140], 140)).toBe(2);
  });

  test("a column with no other card gives slot 0, and an empty list of middles never reads the pointer", () => {
    expect(slotAt([], 50)).toBe(0);
    expect(slotAt([], Number.NaN)).toBe(0);
  });

  test("a pointer that is no number gives slot 0", () => {
    expect(slotAt([100, 140], Number.NaN)).toBe(0);
  });
});

describe("indicatorOf", () => {
  test("a column shows the outline while a card from another column is over it", () => {
    const drag = { dragging: "fix-login", over: { column: "doing", slot: 0 } };
    expect(indicatorOf(drag, "doing", "todo")).toBe("into");
    expect(
      indicatorOf({ dragging: "fix-login", over: { column: "doing", slot: 5 } }, "doing", "todo"),
    ).toBe("into");
  });

  test("no other column shows it, nor the card's own column, nor a column with no drag over", () => {
    const drag = { dragging: "fix-login", over: { column: "doing", slot: 0 } };
    expect(indicatorOf(drag, "done", "todo")).toBeUndefined();
    expect(
      indicatorOf({ dragging: "fix-login", over: { column: "todo", slot: 1 } }, "todo", "todo"),
    ).toBeUndefined();
    expect(indicatorOf({ dragging: "fix-login" }, "doing", "todo")).toBeUndefined();
    expect(indicatorOf(undefined, "doing", "todo")).toBeUndefined();
  });
});

describe("lineOf", () => {
  const over = (dragging: string, column: string, slot: number) => ({
    dragging,
    over: { column, slot },
  });

  test("in the card's own column the line is before the card at the slot, or after the last", () => {
    expect(lineOf(over("fix-login", "todo", 1), "todo", TODO)).toEqual({
      card: "audit",
      side: "before",
    });
    expect(lineOf(over("fix-login", "todo", 2), "todo", TODO)).toEqual({
      card: "audit",
      side: "after",
    });
    expect(lineOf(over("audit", "todo", 0), "todo", TODO)).toEqual({
      card: "fix-login",
      side: "before",
    });
  });

  test("where the drop would change nothing there is no line", () => {
    expect(lineOf(over("fix-login", "todo", 0), "todo", TODO)).toBeUndefined();
    expect(lineOf(over("add-sso", "todo", 1), "todo", TODO)).toBeUndefined();
    expect(lineOf(over("audit", "todo", 2), "todo", TODO)).toBeUndefined();
  });

  test("in another column the line is before the card at the slot, or after the last", () => {
    expect(lineOf(over("fix-login", "doing", 0), "doing", DOING)).toEqual({
      card: "write-docs",
      side: "before",
    });
    expect(lineOf(over("fix-login", "doing", 1), "doing", DOING)).toEqual({
      card: "review",
      side: "before",
    });
    expect(lineOf(over("fix-login", "doing", 2), "doing", DOING)).toEqual({
      card: "review",
      side: "after",
    });
  });

  test("an empty column, another column, and no drag give no line", () => {
    expect(lineOf(over("fix-login", "later", 0), "later", [])).toBeUndefined();
    expect(lineOf(over("fix-login", "doing", 1), "todo", TODO)).toBeUndefined();
    expect(lineOf({ dragging: "fix-login" }, "doing", DOING)).toBeUndefined();
    expect(lineOf(undefined, "doing", DOING)).toBeUndefined();
  });

  test("a slot past the column's cards is the bottom", () => {
    expect(lineOf(over("fix-login", "doing", 99), "doing", DOING)).toEqual({
      card: "review",
      side: "after",
    });
  });
});

describe("afterDrop", () => {
  test("a drop in another column, below its last card, gives the props with the card there", () => {
    const next = afterDrop(PROPS, "fix-login", "doing", 1);
    expect(next?.cards.map(({ id, column }) => [id, column])).toEqual([
      ["write-docs", "doing"],
      ["fix-login", "doing"],
      ["release-notes", "done"],
    ]);
    expect(columnsOf(next ?? PROPS)[1]?.cards.map(({ id }) => id)).toEqual([
      "write-docs",
      "fix-login",
    ]);
  });

  test("a drop above a card of another column puts the card first", () => {
    const next = afterDrop(PROPS, "fix-login", "doing", 0);
    expect(columnsOf(next ?? PROPS)[1]?.cards.map(({ id }) => id)).toEqual([
      "fix-login",
      "write-docs",
    ]);
  });

  test("a drop in the card's own column places it there", () => {
    const next = afterDrop(ORDER, "audit", "todo", 0);
    expect(columnsOf(next ?? ORDER)[0]?.cards.map(({ id }) => id)).toEqual([
      "audit",
      "fix-login",
      "add-sso",
    ]);
  });

  test("a drop where the card stands, or of a card or onto a column the item lacks, gives none", () => {
    expect(afterDrop(ORDER, "add-sso", "todo", 1)).toBeUndefined();
    expect(afterDrop(PROPS, "fix-login", "todo", 0)).toBeUndefined();
    expect(afterDrop(PROPS, "zz", "doing", 0)).toBeUndefined();
    expect(afterDrop(PROPS, "fix-login", "zz", 0)).toBeUndefined();
  });
});
