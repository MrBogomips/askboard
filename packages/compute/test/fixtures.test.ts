import { describe, expect, test } from "bun:test";
import { FORMULA_FUNCTIONS, FORMULA_OPERATORS } from "@askboard/contract";
import {
  BOARD_FIXTURES,
  DROPPED,
  editSource,
  runAll,
  runBoards,
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

describe("the board fixtures", () => {
  test("UJ-2's WBS and plan, and the spreadsheet, read as expected through every edit", () => {
    const tally = new Tally();
    runBoards(tally);
    expect(tally.failures).toEqual([]);
    expect(tally.exactMismatches).toEqual([]);
    // Values: UJ-2's 75 at load and after each of three edits, the spreadsheet's 8, 7 and 2; then
    // one warnings check per board and one fresh-build check per edit.
    expect(tally.passed).toBe(75 * 4 + (8 + 7 + 2) + 2 + 5);
  });

  test("edit the source as the view would", () => {
    const [board] = BOARD_FIXTURES;
    const items = editSource(board?.items ?? [], "wbs.ux.pessimistic", 16);
    expect(JSON.stringify(items)).toContain('"pessimistic":16');
    expect(JSON.stringify(board?.items)).not.toContain('"pessimistic":16');
  });
});

describe("every fixture", () => {
  test("passes", () => {
    const tally = runAll();
    expect(tally.failed).toBe(0);
    expect(tally.passed).toBeGreaterThan(300);
  });
});
