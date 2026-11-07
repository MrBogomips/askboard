import { describe, expect, test } from "bun:test";
import { resultHoldsNothing } from "../src/index.ts";
import { EMPTY_RESULTS } from "../src/widgets/registry-check.ts";

describe("resultHoldsNothing (widget-registry, one definition)", () => {
  test.each([
    ["null", null],
    ["an empty string", ""],
    ["{}", {}],
    ["[]", []],
    ["nested empties", { a: [[], {}, [{ b: null }]], c: "" }],
    ["an array of nulls and empty strings", [null, ""]],
  ])("%s holds nothing", (_, value) => {
    expect(resultHoldsNothing(value)).toBe(true);
  });

  test.each([
    ["false", false],
    ["0", 0],
    ["a string", "a"],
    ["a blank string", " "],
    ["a number deep inside", { a: [{ b: [1] }] }],
    ["false beside empties", { a: [], b: { c: false } }],
  ])("%s is content", (_, value) => {
    expect(resultHoldsNothing(value)).toBe(false);
  });

  test("reads a very deep value without recursing", () => {
    let deep: unknown = [];
    for (let i = 0; i < 100000; i++) deep = [deep];
    expect(resultHoldsNothing(deep)).toBe(true);
  });

  test("every sample the registry's result-empty rule tries holds nothing", () => {
    expect(EMPTY_RESULTS.length).toBeGreaterThanOrEqual(8);
    for (const [shown, value] of EMPTY_RESULTS) {
      expect([shown, resultHoldsNothing(value)]).toEqual([shown, true]);
    }
  });
});
