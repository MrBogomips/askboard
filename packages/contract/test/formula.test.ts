import { describe, expect, test } from "bun:test";
import {
  BINARY_OPERATOR_PRECEDENCE,
  CELL_PATTERN,
  FIELD_NAME_PATTERN,
  FORMULA_ERROR_KINDS,
  FORMULA_FUNCTIONS,
  FORMULA_MAX_CHARS,
  FORMULA_MAX_DEPTH,
  FORMULA_OPERATORS,
  ID_PATTERN,
  isFieldName,
  parseCell,
  RANGE_MAX_CELLS,
  REFUSED_OPERATORS,
  SHEET_MAX_COLUMN,
  SHEET_MAX_ROW,
} from "../src/index.ts";

// AD-13's whitelist, as the formula spike decided it on 2026-10-30 (findings, row 2).
const AD13_OPERATORS = ["+", "-", "*", "/", "^", "=", "<>", "<", "<=", ">", ">="];
const AD13_FUNCTIONS = [
  "SUM",
  "MIN",
  "MAX",
  "IF",
  "ROUND",
  "AND",
  "SQRT",
  "SUMSQ",
  "SUMPRODUCT",
  "ROUNDUP",
  "WORKDAY",
];
const DROPPED = ["OR", "NOT", "ABS", "CEILING", "AVERAGE", "COUNT", "NETWORKDAYS"];

describe("the whitelist", () => {
  test("holds exactly AD-13's functions, each with its arguments and semantics", () => {
    expect(FORMULA_FUNCTIONS.map((f): string => f.name).sort()).toEqual([...AD13_FUNCTIONS].sort());
    for (const f of FORMULA_FUNCTIONS) {
      expect(Number.isInteger(f.minArgs) && f.minArgs >= 1).toBe(true);
      expect(f.maxArgs).toBeGreaterThanOrEqual(f.minArgs);
      expect(f.excel.length).toBeGreaterThan(0);
    }
  });

  test("gives each function Excel's number of arguments", () => {
    const args = Object.fromEntries(FORMULA_FUNCTIONS.map((f) => [f.name, [f.minArgs, f.maxArgs]]));
    expect(args).toEqual({
      SUM: [1, 255],
      MIN: [1, 255],
      MAX: [1, 255],
      IF: [2, 3],
      ROUND: [2, 2],
      AND: [1, 255],
      SQRT: [1, 1],
      SUMSQ: [1, 255],
      SUMPRODUCT: [1, 255],
      ROUNDUP: [2, 2],
      WORKDAY: [2, 2],
    });
  });

  test("holds exactly AD-13's operators: unary minus and the binary ones", () => {
    const binary = FORMULA_OPERATORS.filter((o) => o.arity === "binary").map(
      (o): string => o.symbol,
    );
    const unary = FORMULA_OPERATORS.filter((o) => o.arity === "unary").map((o) => o.symbol);
    expect(binary.sort()).toEqual([...AD13_OPERATORS].sort());
    expect(unary).toEqual(["-"]);
  });

  test("leaves out the dropped functions and the refused operators", () => {
    const names = new Set<string>(FORMULA_FUNCTIONS.map((f) => f.name));
    for (const name of DROPPED) expect(names.has(name)).toBe(false);
    const symbols = new Set<string>(FORMULA_OPERATORS.map((o) => o.symbol));
    for (const symbol of REFUSED_OPERATORS) expect(symbols.has(symbol)).toBe(false);
  });

  test("refuses & and %", () => {
    expect([...REFUSED_OPERATORS]).toEqual(["&", "%"]);
  });

  test("is frozen", () => {
    expect(Object.isFrozen(FORMULA_FUNCTIONS)).toBe(true);
    expect(FORMULA_FUNCTIONS.every((f) => Object.isFrozen(f))).toBe(true);
    expect(Object.isFrozen(FORMULA_OPERATORS)).toBe(true);
    expect(Object.isFrozen(BINARY_OPERATOR_PRECEDENCE)).toBe(true);
  });
});

describe("the grammar", () => {
  test("ranks comparison lowest, then + -, then * /, then ^", () => {
    const p = BINARY_OPERATOR_PRECEDENCE;
    for (const op of ["=", "<>", "<", "<=", ">", ">="] as const) expect(p[op]).toBe(p["="]);
    expect(p["+"]).toBe(p["-"]);
    expect(p["*"]).toBe(p["/"]);
    expect(p["="]).toBeLessThan(p["+"]);
    expect(p["+"]).toBeLessThan(p["*"]);
    expect(p["*"]).toBeLessThan(p["^"]);
    expect(Object.keys(p).sort()).toEqual([...AD13_OPERATORS].sort());
  });

  test("names IDs as AD-7 does", () => {
    expect(ID_PATTERN).toBe("^[A-Za-z0-9_-]{1,64}$");
  });

  test("accepts field names: a letter, then letters and digits, up to 64", () => {
    const pattern = new RegExp(FIELD_NAME_PATTERN);
    for (const name of ["optimistic", "mostLikely", "es", "v", "x2y", "a".repeat(64)]) {
      expect(pattern.test(name)).toBe(true);
      expect(isFieldName(name)).toBe(true);
    }
    for (const name of ["", "2x", "_a", "a-b", "a.b", "a".repeat(65)]) {
      expect(isFieldName(name)).toBe(false);
    }
  });

  test("refuses a field name that matches the cell pattern in any case", () => {
    for (const name of ["a1", "Q1", "xfd1048576", "XFD1048576", "ab12", "Aa3"]) {
      expect(isFieldName(name)).toBe(false);
    }
    // Past the sheet's last column or row, a name is no cell, so it may be a field.
    expect(isFieldName("xfe1")).toBe(true);
    expect(isFieldName("a1048577")).toBe(true);
  });

  test("reads cells in upper case, from A1 to XFD1048576", () => {
    expect(new RegExp(CELL_PATTERN).test("A1")).toBe(true);
    expect(parseCell("A1")).toEqual({ column: 1, row: 1 });
    expect(parseCell("Z9")).toEqual({ column: 26, row: 9 });
    expect(parseCell("AA10")).toEqual({ column: 27, row: 10 });
    expect(parseCell("XFD1048576")).toEqual({ column: SHEET_MAX_COLUMN, row: SHEET_MAX_ROW });
    for (const text of ["XFE1", "A1048577", "a1", "A0", "A01", "1A", "A", "AAAA1", "A1:B2"]) {
      expect(parseCell(text)).toBeUndefined();
    }
  });

  test("bounds the sheet as Excel does", () => {
    expect(SHEET_MAX_COLUMN).toBe(16_384);
    expect(SHEET_MAX_ROW).toBe(1_048_576);
  });
});

describe("limits and error kinds", () => {
  test("are the formula spike's limits", () => {
    expect(FORMULA_MAX_CHARS).toBe(8_192);
    expect(FORMULA_MAX_DEPTH).toBe(64);
    expect(RANGE_MAX_CELLS).toBe(65_536);
  });

  test("name the eight formula error kinds in kebab-case", () => {
    expect([...FORMULA_ERROR_KINDS]).toEqual([
      "syntax",
      "over-limit",
      "not-whitelisted",
      "missing-reference",
      "cycle",
      "mixed-currencies",
      "value",
      "division-by-zero",
    ]);
    for (const kind of FORMULA_ERROR_KINDS) expect(kind).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
