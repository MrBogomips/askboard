import { describe, expect, test } from "bun:test";
import type { FormulaWarning } from "@askboard/contract";
import {
  boundedFormulaWarnings,
  FORMULA_WARNING_CLOSING_MAX_CHARS,
  FORMULA_WARNINGS_MAX_CHARS,
} from "../src/graph-check.ts";

// Core spec, The send-time graph check ("Warnings past the bound"); design decision 4, the bound.

const MAX = 3_000;

const warning = (n: number, message = `the plan names x${n}`): FormulaWarning => ({
  code: "formula",
  itemId: "schedule",
  address: `schedule.x${n}`,
  error: "missing-reference",
  message,
});

const warnings = (count: number, message?: (n: number) => string): FormulaWarning[] =>
  Array.from({ length: count }, (_, n) => warning(n, message?.(n)));

const size = (list: readonly unknown[]): number => JSON.stringify(list).length;

describe("the bound on the send-time warnings", () => {
  test("states its two constants", () => {
    expect(FORMULA_WARNINGS_MAX_CHARS).toBe(10_000);
    expect(FORMULA_WARNING_CLOSING_MAX_CHARS).toBe(1_000);
  });

  test("an empty list stays empty", () => {
    expect(boundedFormulaWarnings([], MAX)).toEqual([]);
  });

  test("a list within the bound is returned unchanged, in order", () => {
    const list = warnings(10);
    expect(size(list)).toBeLessThanOrEqual(MAX);
    expect(boundedFormulaWarnings(list, MAX)).toEqual(list);
  });

  test("a list that fills the bound to its last character is unchanged", () => {
    const pad = MAX - size(warnings(5));
    const list = [...warnings(4), warning(4, `the plan names x4${"y".repeat(pad)}`)];
    expect(size(list)).toBe(MAX);
    expect(boundedFormulaWarnings(list, MAX)).toEqual(list);
  });

  test("a list over the bound keeps a prefix and ends with one closing warning that counts the rest", () => {
    const list = warnings(100);
    expect(size(list)).toBeGreaterThan(MAX);
    const result = boundedFormulaWarnings(list, MAX);
    expect(size(result)).toBeLessThanOrEqual(MAX);
    const closing = result[result.length - 1] as FormulaWarning;
    const kept = result.length - 1;
    const first = list[kept] as FormulaWarning;
    const left = list.length - kept - 1;
    expect(result.slice(0, kept)).toEqual(list.slice(0, kept));
    expect(closing).toEqual({
      code: "formula",
      itemId: first.itemId,
      address: first.address,
      error: first.error,
      message: `The formula at ${first.address} is in error (${first.error}), and ${left} more formula warnings are left out.`,
    });
    expect(kept + 1 + left).toBe(list.length);
    // It keeps as many as the budget holds: one more would pass the room set aside for the closing.
    expect(size(list.slice(0, kept + 1)) + FORMULA_WARNING_CLOSING_MAX_CHARS).toBeGreaterThan(MAX);
    expect(size(list.slice(0, kept)) + FORMULA_WARNING_CLOSING_MAX_CHARS).toBeLessThanOrEqual(MAX);
  });

  test("counts the commas between the kept warnings: a budget that fits five and bare brackets keeps five", () => {
    const list = Array.from({ length: 20 }, (_, n) =>
      warning(n, `the plan names x${String(n).padStart(2, "0")}`),
    );
    const each = size([list[0]]) - 2;
    // Six warnings fit the budget only without their five commas.
    const max = FORMULA_WARNING_CLOSING_MAX_CHARS + 2 + 6 * each;
    const result = boundedFormulaWarnings(list, max);
    expect(result).toHaveLength(6);
    expect(result.slice(0, 5)).toEqual(list.slice(0, 5));
    expect(size(result)).toBeLessThanOrEqual(max);
  });

  test("a first warning that alone passes the budget gives the closing warning only", () => {
    const list = [warning(0, "z".repeat(MAX)), ...warnings(4).slice(1)];
    const result = boundedFormulaWarnings(list, MAX);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      itemId: "schedule",
      address: "schedule.x0",
      error: "missing-reference",
      message:
        "The formula at schedule.x0 is in error (missing-reference), and 3 more formula warnings are left out.",
    });
    expect(size(result)).toBeLessThanOrEqual(MAX);
  });

  test("one warning left out after the first is counted in the singular", () => {
    const result = boundedFormulaWarnings([warning(0, "z".repeat(MAX)), warning(1)], MAX);
    expect(result).toHaveLength(1);
    expect(result[0]?.message).toBe(
      "The formula at schedule.x0 is in error (missing-reference), and 1 more formula warning is left out.",
    );
  });

  test("a single warning too large for the budget is the closing one, with no count after it", () => {
    const result = boundedFormulaWarnings([warning(0, "z".repeat(MAX))], MAX);
    expect(result).toHaveLength(1);
    expect(result[0]?.message).toBe(
      "The formula at schedule.x0 is in error (missing-reference); its detail is left out.",
    );
  });

  test("measures a message as JSON.stringify escapes it, quotes and control characters included", () => {
    const heavy = (n: number) => `${n}${'"'.repeat(30)}${"\u0001".repeat(60)}`;
    const list = warnings(25, heavy);
    // Raw, the messages are about 100 characters each: the bound would keep far more than it may.
    const raw = list.reduce((sum, { message }) => sum + message.length, 0);
    expect(raw).toBeLessThan(MAX);
    expect(size(list)).toBeGreaterThan(MAX);
    const result = boundedFormulaWarnings(list, MAX);
    expect(size(result)).toBeLessThanOrEqual(MAX);
    expect(result.length).toBeLessThan(list.length);
    const kept = result.length - 1;
    expect(size(list.slice(0, kept + 1)) + FORMULA_WARNING_CLOSING_MAX_CHARS).toBeGreaterThan(MAX);
  });

  test("the largest closing warning fits the room set aside for it", () => {
    const worst: FormulaWarning = {
      code: "formula",
      itemId: "i".repeat(64),
      address: "a".repeat(256),
      error: "division-by-zero",
      message: "m",
    };
    const result = boundedFormulaWarnings(
      [warning(0, "z".repeat(MAX)), { ...worst }, ...warnings(99_998)],
      FORMULA_WARNINGS_MAX_CHARS,
    );
    expect(size(result.slice(-1))).toBeLessThanOrEqual(FORMULA_WARNING_CLOSING_MAX_CHARS);
    expect(size(result)).toBeLessThanOrEqual(FORMULA_WARNINGS_MAX_CHARS);
    const huge = boundedFormulaWarnings(
      [{ ...worst, message: "w".repeat(FORMULA_WARNINGS_MAX_CHARS) }, ...warnings(99_999)],
      FORMULA_WARNINGS_MAX_CHARS,
    );
    expect(huge).toHaveLength(1);
    expect(size(huge)).toBeLessThanOrEqual(FORMULA_WARNING_CLOSING_MAX_CHARS);
  });
});
