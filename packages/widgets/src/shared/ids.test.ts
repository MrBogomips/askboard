import { describe, expect, test } from "bun:test";
import { nextViewId } from "./ids.ts";

describe("the next view-made ID (design decision 11, finding F10)", () => {
  test("is u-1 when the item holds no view-made ID", () => {
    expect(nextViewId([])).toBe("u-1");
    expect(nextViewId(["design", "build", "portal"])).toBe("u-1");
  });

  test("is one more than the highest u-<n>, whatever the order", () => {
    expect(nextViewId(["design", "u-1"])).toBe("u-2");
    expect(nextViewId(["u-3", "a", "u-1", "u-12", "u-2"])).toBe("u-13");
  });

  test("ignores agent IDs and a u- ID not followed by a number", () => {
    const ids = ["u-", "u-x", "u-1a", "u-1.5", "u--2", "u-+3", "u- 4", "U-7", "xu-9", "plan-u-5"];
    expect(nextViewId(ids)).toBe("u-1");
  });

  test("reads leading zeros as the number they write", () => {
    expect(nextViewId(["u-007"])).toBe("u-8");
  });

  test("stays new past the largest safe integer", () => {
    expect(nextViewId(["u-9007199254740993"])).toBe("u-9007199254740994");
  });

  test("takes any iterable of IDs, and never gives one the item holds", () => {
    const ids = new Set(["u-4", "u-5", "u-1"]);
    const next = nextViewId(ids);
    expect(next).toBe("u-6");
    expect(ids.has(next)).toBe(false);
  });
});
