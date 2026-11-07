import { describe, expect, test } from "bun:test";
import { afterDrop, indicatorOf } from "./drop.ts";

// The drag's state and what a drop does (view-and-widgets spec: Ranking reorder; design decision
// 8): a line before or after the row the pointer is over, by the half of the row, and a drop that
// changes the order reports it, one that leaves it reports none.
const order = ["a", "b", "c", "d"];

describe("indicatorOf", () => {
  const drag = { dragging: "c", over: { targetId: "a", fraction: 0.2 } } as const;

  test("a row the pointer is over shows a line before it in its top half and after it from half down", () => {
    expect(indicatorOf(drag, "a")).toBe("before");
    expect(indicatorOf({ ...drag, over: { targetId: "a", fraction: 0.5 } }, "a")).toBe("after");
    expect(indicatorOf({ ...drag, over: { targetId: "a", fraction: 0.9 } }, "a")).toBe("after");
  });

  test("no other row shows one, nor the dragged row, nor any row when nothing is over", () => {
    expect(indicatorOf(drag, "b")).toBeUndefined();
    expect(
      indicatorOf({ dragging: "a", over: { targetId: "a", fraction: 0.2 } }, "a"),
    ).toBeUndefined();
    expect(indicatorOf({ dragging: "c" }, "a")).toBeUndefined();
    expect(indicatorOf(undefined, "a")).toBeUndefined();
  });
});

describe("afterDrop", () => {
  test("gives the new order of a drop on each half of another row", () => {
    expect(afterDrop(order, "c", "a", 0.1)).toEqual(["c", "a", "b", "d"]);
    expect(afterDrop(order, "c", "a", 0.9)).toEqual(["a", "c", "b", "d"]);
    expect(afterDrop(order, "a", "d", 0.9)).toEqual(["b", "c", "d", "a"]);
  });

  test("gives none for a drop that leaves the order, on itself or in place", () => {
    expect(afterDrop(order, "c", "c", 0.1)).toBeUndefined();
    expect(afterDrop(order, "b", "a", 0.9)).toBeUndefined();
    expect(afterDrop(order, "b", "c", 0.1)).toBeUndefined();
  });

  test("gives none for a row the order does not hold", () => {
    expect(afterDrop(order, "x", "a", 0.1)).toBeUndefined();
    expect(afterDrop(order, "a", "x", 0.1)).toBeUndefined();
  });
});
