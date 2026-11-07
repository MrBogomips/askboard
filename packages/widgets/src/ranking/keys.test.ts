import { describe, expect, test } from "bun:test";
import { currentAfterKey, rankingTools, toolbarMoveOf } from "./keys.ts";

// The Ranking at the keyboard (view-and-widgets spec: Ranking at the keyboard; design decision 8):
// the list's arrow keys move the current row, never the order, and the toolbar's tools are enabled
// only where the move is possible.
const order = ["a", "b", "c"];

describe("currentAfterKey", () => {
  test("the arrow keys move the current row by one, stopping at the ends", () => {
    expect(currentAfterKey(order, "b", "ArrowDown")).toBe("c");
    expect(currentAfterKey(order, "b", "ArrowUp")).toBe("a");
    expect(currentAfterKey(order, "c", "ArrowDown")).toBe("c");
    expect(currentAfterKey(order, "a", "ArrowUp")).toBe("a");
  });

  test("Home and End go to the first and the last row", () => {
    expect(currentAfterKey(order, "b", "Home")).toBe("a");
    expect(currentAfterKey(order, "b", "End")).toBe("c");
  });

  test("another key gives none, and a current row the order lacks starts at the first", () => {
    expect(currentAfterKey(order, "b", "x")).toBeUndefined();
    expect(currentAfterKey(order, "b", "Enter")).toBeUndefined();
    expect(currentAfterKey(order, "gone", "ArrowDown")).toBe("a");
    expect(currentAfterKey([], "a", "Home")).toBeUndefined();
  });
});

describe("rankingTools", () => {
  test("Move up is off on the first row and Move down on the last, Keep this order always on", () => {
    expect(rankingTools(order, "a", false)).toEqual({ moveUp: false, moveDown: true, keep: true });
    expect(rankingTools(order, "b", false)).toEqual({ moveUp: true, moveDown: true, keep: true });
    expect(rankingTools(order, "c", false)).toEqual({ moveUp: true, moveDown: false, keep: true });
  });

  test("every tool is off in a read-only Ranking, and a current row the order lacks moves nothing", () => {
    expect(rankingTools(order, "b", true)).toEqual({ moveUp: false, moveDown: false, keep: false });
    expect(rankingTools(order, "gone", false)).toEqual({
      moveUp: false,
      moveDown: false,
      keep: true,
    });
  });
});

describe("toolbarMoveOf", () => {
  test("maps the arrow keys, Home and End to a move among the tools", () => {
    expect(toolbarMoveOf("ArrowLeft")).toBe("previous");
    expect(toolbarMoveOf("ArrowRight")).toBe("next");
    expect(toolbarMoveOf("Home")).toBe("first");
    expect(toolbarMoveOf("End")).toBe("last");
  });

  test("gives none for any other key, the vertical arrows included", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "Tab", "x"]) {
      expect(toolbarMoveOf(key)).toBeUndefined();
    }
  });
});
