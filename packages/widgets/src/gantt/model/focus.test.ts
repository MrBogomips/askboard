import { describe, expect, test } from "bun:test";
import { clampFocus, type GridFocus, moveFocus, nextTool, toolTabStop } from "./focus.ts";

// UJ-2's six tasks in the grid's four columns.
const SIZE = { rows: 6, columns: 4 };

describe("the grid's focus", () => {
  test.each([
    [{ row: 1, column: 1 }, "up", { row: 0, column: 1 }],
    [{ row: 1, column: 1 }, "down", { row: 2, column: 1 }],
    [{ row: 1, column: 1 }, "left", { row: 1, column: 0 }],
    [{ row: 1, column: 1 }, "right", { row: 1, column: 2 }],
    [{ row: 1, column: 1 }, "home", { row: 1, column: 0 }],
    [{ row: 1, column: 1 }, "end", { row: 1, column: 3 }],
    [{ row: 5, column: 3 }, "home", { row: 5, column: 0 }],
    [{ row: 0, column: 2 }, "end", { row: 0, column: 3 }],
  ] as const)("moves from %j %s to %j", (from, move, to) => {
    expect(moveFocus(from, move, SIZE)).toEqual(to);
  });

  test.each([
    [{ row: 0, column: 1 }, "up"],
    [{ row: 5, column: 1 }, "down"],
    [{ row: 2, column: 0 }, "left"],
    [{ row: 2, column: 3 }, "right"],
    [{ row: 2, column: 0 }, "home"],
    [{ row: 2, column: 3 }, "end"],
  ] as const)("stays at %j on %s, the grid's edge, as the same position", (from, move) => {
    const focus: GridFocus = { ...from };
    expect(moveFocus(focus, move, SIZE)).toBe(focus);
  });

  test("gives frozen positions", () => {
    expect(Object.isFrozen(moveFocus({ row: 1, column: 1 }, "down", SIZE))).toBe(true);
  });

  test.each([
    [{ row: 2, column: 2 }, SIZE, { row: 2, column: 2 }],
    [{ row: 9, column: 2 }, SIZE, { row: 5, column: 2 }],
    [{ row: 2, column: 7 }, SIZE, { row: 2, column: 3 }],
    [
      { row: 9, column: 7 },
      { rows: 1, columns: 4 },
      { row: 0, column: 3 },
    ],
    [{ row: 2, column: 2 }, { rows: 0, columns: 4 }, undefined],
  ])("keeps %j inside a grid of %j: %j", (focus, size, kept) => {
    expect(clampFocus(focus, size)).toEqual(kept);
  });

  test("keeps the same position when it is inside the grid", () => {
    const focus = { row: 3, column: 1 };
    expect(clampFocus(focus, SIZE)).toBe(focus);
  });
});

describe("the toolbar's roving focus", () => {
  test.each([
    [[true, true, true], 0, "next", 1],
    [[true, true, true], 2, "next", 0],
    [[true, true, true], 0, "previous", 2],
    [[true, false, true], 0, "next", 2],
    [[true, false, true], 2, "next", 0],
    [[true, false, true], 2, "previous", 0],
    [[false, true, true], 2, "first", 1],
    [[true, true, false], 0, "last", 1],
    [[false, true, false], 1, "next", 1],
    [[false, false, false], 1, "next", 1],
    [[false, false, false], 1, "first", 1],
  ] as const)(
    "among %j, from %i, moves %s to %i, skipping disabled tools",
    (enabled, from, move, to) => {
      expect(nextTool(enabled, from, move)).toBe(to);
    },
  );

  test.each([
    [[true, true, true], 1, 1],
    [[true, false, true], 1, 0],
    [[false, false, true], 0, 2],
    [[false, false, false], 0, undefined],
  ])("among %j, with tool %i active, puts the Tab stop on %p", (enabled, active, stop) => {
    expect(toolTabStop(enabled, active)).toBe(stop);
  });
});
