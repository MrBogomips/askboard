import { describe, expect, test } from "bun:test";
import { COUNTER_MIN, isCrowded, OVERFLOW_TOOLS, ROW_PADDING } from "./overflow.ts";

// Review F-16: the counter gives way first; when the tools alone no longer leave it its minimum,
// the move tools go into "More".
describe("the toolbar's overflow", () => {
  test("the tools and the counter's minimum fit a wide row", () => {
    expect(isCrowded(1000, 600)).toBe(false);
    expect(isCrowded(600 + COUNTER_MIN + ROW_PADDING, 600)).toBe(false);
  });

  test("a row one pixel short of them is crowded", () => {
    expect(isCrowded(600 + COUNTER_MIN + ROW_PADDING - 1, 600)).toBe(true);
    expect(isCrowded(500, 600)).toBe(true);
  });

  test("tools not measured yet are never crowded", () => {
    expect(isCrowded(100, 0)).toBe(false);
  });

  test("the move tools are the four moves, no other", () => {
    expect([...OVERFLOW_TOOLS].sort()).toEqual(["indent", "moveDown", "moveUp", "outdent"]);
  });
});
