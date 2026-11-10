import { describe, expect, test } from "bun:test";
import { clear, extend, NO_SELECTION, pruned, type RowSelection, toggle } from "./selection.ts";

// The Ranking's row selection (view-and-widgets spec: Ranking row selection; design decision 8): a
// set of element IDs and the anchor, the row last toggled or clicked. View state, so nothing here
// reaches a draft or an answer. Every function returns a new value and never touches its input.
const ORDER = ["a", "b", "c", "d", "e"];
const idsOf = (selection: RowSelection): string[] => [...selection.ids].sort();

describe("toggle", () => {
  test("selects an unselected row and makes it the anchor", () => {
    const next = toggle(NO_SELECTION, ORDER, "c");
    expect(idsOf(next)).toEqual(["c"]);
    expect(next.anchor).toBe("c");
  });

  test("clears a selected row, which stays the anchor", () => {
    const next = toggle(toggle(NO_SELECTION, ORDER, "c"), ORDER, "c");
    expect(idsOf(next)).toEqual([]);
    expect(next.anchor).toBe("c");
  });

  test("leaves the other rows as they are", () => {
    const next = toggle(toggle(NO_SELECTION, ORDER, "a"), ORDER, "d");
    expect(idsOf(next)).toEqual(["a", "d"]);
    expect(next.anchor).toBe("d");
  });

  test("a row the order lacks changes nothing", () => {
    const before = toggle(NO_SELECTION, ORDER, "a");
    expect(toggle(before, ORDER, "zzz")).toBe(before);
  });

  test("never touches its input", () => {
    const before = toggle(NO_SELECTION, ORDER, "a");
    toggle(before, ORDER, "b");
    expect(idsOf(before)).toEqual(["a"]);
    expect(idsOf(NO_SELECTION)).toEqual([]);
  });
});

describe("extend", () => {
  test("goes down from the anchor to the target, both included", () => {
    const next = extend(toggle(NO_SELECTION, ORDER, "b"), ORDER, "d");
    expect(idsOf(next)).toEqual(["b", "c", "d"]);
  });

  test("goes up from the anchor to the target", () => {
    const next = extend(toggle(NO_SELECTION, ORDER, "d"), ORDER, "b");
    expect(idsOf(next)).toEqual(["b", "c", "d"]);
  });

  test("keeps the anchor, so a second extension runs from the same row", () => {
    const first = extend(toggle(NO_SELECTION, ORDER, "b"), ORDER, "c");
    const second = extend(first, ORDER, "e");
    expect(first.anchor).toBe("b");
    expect(idsOf(second)).toEqual(["b", "c", "d", "e"]);
  });

  test("adds to what is selected: rows outside the range stay", () => {
    const start = toggle(toggle(NO_SELECTION, ORDER, "a"), ORDER, "d");
    expect(idsOf(extend(start, ORDER, "e"))).toEqual(["a", "d", "e"]);
  });

  test("with no anchor it starts from `from`, the current row", () => {
    expect(idsOf(extend(NO_SELECTION, ORDER, "c", "a"))).toEqual(["a", "b", "c"]);
  });

  test("with no anchor and no `from` it selects the target alone", () => {
    const next = extend(NO_SELECTION, ORDER, "c");
    expect(idsOf(next)).toEqual(["c"]);
    expect(next.anchor).toBe("c");
  });

  test("an anchor the order lacks falls back to `from`", () => {
    const stale: RowSelection = { ids: new Set(["gone"]), anchor: "gone" };
    expect(idsOf(extend(stale, ORDER, "c", "b"))).toEqual(["b", "c", "gone"]);
  });

  test("a target the order lacks changes nothing", () => {
    const before = toggle(NO_SELECTION, ORDER, "a");
    expect(extend(before, ORDER, "zzz")).toBe(before);
  });

  test("the range follows the order shown, not the order of the IDs", () => {
    const moved = ["c", "a", "b"];
    expect(idsOf(extend(toggle(NO_SELECTION, moved, "c"), moved, "b"))).toEqual(["a", "b", "c"]);
    expect(idsOf(extend(toggle(NO_SELECTION, moved, "a"), moved, "b"))).toEqual(["a", "b"]);
  });
});

describe("clear", () => {
  test("selects none and drops the anchor", () => {
    const next = clear();
    expect(idsOf(next)).toEqual([]);
    expect(next.anchor).toBeUndefined();
    expect(next).toBe(NO_SELECTION);
  });
});

describe("pruned: filtering after an agent's revision", () => {
  test("removes an item the new order no longer holds", () => {
    const start = extend(toggle(NO_SELECTION, ORDER, "b"), ORDER, "d");
    const next = pruned(start, ["a", "b", "d", "e"]);
    expect(idsOf(next)).toEqual(["b", "d"]);
    expect(next.anchor).toBe("b");
  });

  test("drops an anchor the new order lacks", () => {
    const start = toggle(toggle(NO_SELECTION, ORDER, "b"), ORDER, "c");
    const next = pruned(start, ["a", "b", "d"]);
    expect(idsOf(next)).toEqual(["b"]);
    expect(next.anchor).toBeUndefined();
  });

  test("gives the same value when nothing goes", () => {
    const start = toggle(NO_SELECTION, ORDER, "b");
    expect(pruned(start, ORDER)).toBe(start);
  });

  test("an empty selection is the same value", () => {
    expect(pruned(NO_SELECTION, [])).toBe(NO_SELECTION);
  });

  test("an order that holds none of them leaves none", () => {
    const start = toggle(NO_SELECTION, ORDER, "b");
    expect(idsOf(pruned(start, ["x", "y"]))).toEqual([]);
  });
});
