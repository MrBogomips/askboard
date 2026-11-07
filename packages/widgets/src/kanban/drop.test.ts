import { describe, expect, test } from "bun:test";
import { KANBAN_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { afterDrop, indicatorOf } from "./drop.ts";
import { columnsOf } from "./model.ts";

// The Kanban's drag as plain data (view-and-widgets spec: Kanban moves by drag; design decision 9).
const PROPS = KANBAN_FIXTURE_ITEM.props;

describe("indicatorOf", () => {
  test("a column shows the drop indicator while a card from another column is over it", () => {
    const drag = { dragging: "fix-login", over: "doing" };
    expect(indicatorOf(drag, "doing", "todo")).toBe("into");
  });

  test("no other column shows it, nor the card's own column, nor a column with no drag over", () => {
    const drag = { dragging: "fix-login", over: "doing" };
    expect(indicatorOf(drag, "done", "todo")).toBeUndefined();
    expect(indicatorOf({ dragging: "fix-login", over: "todo" }, "todo", "todo")).toBeUndefined();
    expect(indicatorOf({ dragging: "fix-login" }, "doing", "todo")).toBeUndefined();
    expect(indicatorOf(undefined, "doing", "todo")).toBeUndefined();
  });
});

describe("afterDrop", () => {
  test("a drop on another column gives the props with the card there, every card at its index", () => {
    const next = afterDrop(PROPS, "fix-login", "doing");
    expect(next?.cards.map(({ id, column }) => [id, column])).toEqual([
      ["fix-login", "doing"],
      ["write-docs", "doing"],
      ["release-notes", "done"],
    ]);
    expect(columnsOf(next ?? PROPS)[1]?.cards.map(({ id }) => id)).toEqual([
      "fix-login",
      "write-docs",
    ]);
  });

  test("a drop where the card stands, or of a card or onto a column the item lacks, gives none", () => {
    expect(afterDrop(PROPS, "fix-login", "todo")).toBeUndefined();
    expect(afterDrop(PROPS, "zz", "doing")).toBeUndefined();
    expect(afterDrop(PROPS, "fix-login", "zz")).toBeUndefined();
  });
});
