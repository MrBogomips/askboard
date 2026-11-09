import { describe, expect, test } from "bun:test";
import { currentAfter, RANKING_TOOLS, rankingTools } from "./keys.ts";

// The Ranking at the keyboard (view-and-widgets spec: Ranking at the keyboard; design decision 8):
// the list's cursor actions move the current row, never the order, and the toolbar's tools are
// enabled only where their act is possible.
const order = ["a", "b", "c"];

describe("currentAfter", () => {
  test("up and down move the current row by one, stopping at the ends", () => {
    expect(currentAfter(order, "b", "down")).toBe("c");
    expect(currentAfter(order, "b", "up")).toBe("a");
    expect(currentAfter(order, "c", "down")).toBe("c");
    expect(currentAfter(order, "a", "up")).toBe("a");
  });

  test("first and last go to the ends", () => {
    expect(currentAfter(order, "b", "first")).toBe("a");
    expect(currentAfter(order, "b", "last")).toBe("c");
  });

  test("a current row the order lacks starts at the first row, and an empty order has none", () => {
    expect(currentAfter(order, "gone", "down")).toBe("a");
    expect(currentAfter([], "a", "first")).toBeUndefined();
  });
});

describe("rankingTools", () => {
  const none = new Set<string>();

  test("Move up and To top are off on the first row, Move down and To bottom on the last", () => {
    expect(rankingTools(order, ["a"], false, false)).toEqual({
      moveUp: false,
      moveDown: true,
      toTop: false,
      toBottom: true,
      keep: true,
      selectNone: false,
    });
    expect(rankingTools(order, ["c"], false, false)).toEqual({
      moveUp: true,
      moveDown: false,
      toTop: true,
      toBottom: false,
      keep: true,
      selectNone: false,
    });
    expect(rankingTools(order, ["b"], false, false)).toMatchObject({
      moveUp: true,
      moveDown: true,
      toTop: true,
      toBottom: true,
    });
  });

  test("they follow the rows that act: two selected rows packed at the top cannot move up", () => {
    expect(rankingTools(order, ["a", "b"], true, false)).toMatchObject({
      moveUp: false,
      toTop: false,
      moveDown: true,
      toBottom: true,
      selectNone: true,
    });
    expect(none.size).toBe(0);
  });

  test("Select none is on exactly while rows are selected", () => {
    expect(rankingTools(order, ["b"], false, false).selectNone).toBe(false);
    expect(rankingTools(order, ["b"], true, false).selectNone).toBe(true);
  });

  test("every tool is off in a read-only Ranking, and no acting row moves nothing", () => {
    expect(rankingTools(order, ["b"], true, true)).toEqual({
      moveUp: false,
      moveDown: false,
      toTop: false,
      toBottom: false,
      keep: false,
      selectNone: false,
    });
    expect(rankingTools(order, [], false, false)).toEqual({
      moveUp: false,
      moveDown: false,
      toTop: false,
      toBottom: false,
      keep: true,
      selectNone: false,
    });
  });
});

describe("RANKING_TOOLS", () => {
  test("lists the six tools in the toolbar's order, each with its table action", () => {
    expect(RANKING_TOOLS.map(({ key, action }) => [key, action])).toEqual([
      ["moveUp", "move.up"],
      ["moveDown", "move.down"],
      ["toTop", "move.top"],
      ["toBottom", "move.bottom"],
      ["keep", "ranking.keep"],
      ["selectNone", "select.none"],
    ]);
  });
});
