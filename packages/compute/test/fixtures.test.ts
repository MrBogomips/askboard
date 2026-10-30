import { describe, expect, test } from "bun:test";
import { FORMULA_FUNCTIONS, FORMULA_OPERATORS } from "@askboard/contract";
import {
  DROPPED,
  runAll,
  runErrors,
  runWhitelist,
  Tally,
  WHITELIST_CASES,
} from "./fixtures/suite.ts";

describe("the whitelist fixtures, with Excel's values", () => {
  test("hold the probe's 123 cases, and at least one for every whitelisted entry", () => {
    expect(WHITELIST_CASES).toHaveLength(123);
    const ops = new Set(WHITELIST_CASES.map((c) => c.op));
    for (const entry of FORMULA_FUNCTIONS) expect(ops.has(entry.name)).toBe(true);
    for (const entry of FORMULA_OPERATORS) expect(ops.has(entry.symbol)).toBe(true);
  });

  test("hold every dropped function's cases, kept as a record", () => {
    const dropped = WHITELIST_CASES.filter((c) => DROPPED.has(c.op));
    expect(dropped).toHaveLength(15);
    expect([...new Set(dropped.map((c) => c.op))].sort()).toEqual([...DROPPED].sort());
  });

  test("all pass: whitelisted entries give Excel's value, dropped functions are refused by name", () => {
    const tally = new Tally();
    runWhitelist(tally);
    expect(tally.failures).toEqual([]);
    expect(tally.passed).toBe(246);
    // 0.1+0.2 is 0.30000000000000004 in binary floating point, in Excel too; it passes at 1e-9.
    expect(tally.exactMismatches).toEqual(["whitelist:add-float@t.r"]);
  });
});

describe("the error and hostile fixtures", () => {
  test("all read as expected, from buildGraph and the engine", () => {
    const tally = new Tally();
    runErrors(tally);
    expect(tally.failures).toEqual([]);
    expect(tally.exactMismatches).toEqual([]);
  });
});

describe("every fixture", () => {
  test("passes", () => {
    const tally = runAll();
    expect(tally.failed).toBe(0);
    expect(tally.passed).toBeGreaterThan(300);
  });
});
