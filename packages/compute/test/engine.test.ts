import { describe, expect, test } from "bun:test";
import { FORMULA_FUNCTIONS } from "@askboard/contract";
import { functionNames } from "../src/engine/functions.ts";
import { createOwnEngine } from "../src/engine/own-engine.ts";
import type { EngineCell, EngineReference, EngineValue } from "../src/engine/port.ts";
import { checkFormula, isProblem } from "../src/formula/check.ts";

const input = (value: EngineValue): EngineCell => ({ kind: "input", value });

/** A formula cell whose references read the given engine names, in order of appearance. */
const formula = (text: string, ...names: (number | readonly number[])[]): EngineCell => {
  const checked = checkFormula(text);
  if (isProblem(checked)) throw new Error(checked.reason);
  const references: EngineReference[] = names.map((name) =>
    typeof name === "number" ? { list: false, name } : { list: true, names: name },
  );
  return { kind: "formula", expression: checked.expression, references };
};

const evaluate = (cells: readonly EngineCell[]): EngineValue[] => {
  const engine = createOwnEngine();
  engine.load(cells);
  return cells.map((_, name) => engine.read(name));
};

const only = (text: string, ...cells: EngineCell[]): EngineValue => {
  const values = evaluate([...cells, formula(text, ...cells.map((_, name) => name))]);
  return values[values.length - 1] as EngineValue;
};

describe("the engine's table", () => {
  test("holds exactly the contract's whitelist", () => {
    expect([...functionNames()].sort()).toEqual(
      FORMULA_FUNCTIONS.map((f): string => f.name).sort(),
    );
  });
});

describe("evaluation", () => {
  test("coerces operands as Excel does", () => {
    expect(only("TRUE+TRUE")).toBe(2);
    expect(only('"3"+1')).toBe(4);
    expect(only("[x.a]+1", input(null))).toBe(1);
    expect(only('"abc"+1')).toEqual({
      kind: "value",
      origin: 0,
      detail: 'text "abc" is not a number',
    });
  });

  test("compares numbers at 15 digits, text without case, numbers below text below booleans", () => {
    expect(only("0.1+0.2=0.3")).toBe(true);
    expect(only('"a"="A"')).toBe(true);
    expect(only('1<"a"')).toBe(true);
    expect(only('"z"<TRUE')).toBe(true);
    expect(only("[x.e]=0", input(null))).toBe(true);
    expect(only('[x.e]=""', input(null))).toBe(true);
  });

  test("evaluates IF lazily and AND over every argument, errors first", () => {
    expect(only("IF(TRUE,1,1/0)")).toBe(1);
    expect(only("IF(FALSE,1)")).toBe(false);
    expect(only("AND(FALSE,1/0)")).toEqual({ kind: "division-by-zero", origin: 0 });
  });

  test("propagates the left operand's error first, with its origin", () => {
    const values = evaluate([
      formula("1/0"),
      formula('"x"*1'),
      formula("[x.a]+[x.b]", 1, 0),
      formula("[x.c]*2", 2),
    ]);
    expect(values[2]).toEqual({ kind: "value", origin: 1, detail: 'text "x" is not a number' });
    expect(values[3]).toEqual(values[2] as EngineValue);
  });

  test("rounds on the decimal value at 15 digits", () => {
    expect(only("ROUND(2.675,2)")).toBe(2.68);
    expect(only("ROUND(-2.5,0)")).toBe(-3);
    expect(only("ROUNDUP((0.1+0.2)*10,0)")).toBe(3);
    expect(only("ROUND(1,400)")).toEqual({
      kind: "value",
      origin: 0,
      detail: "digits out of range",
    });
  });

  test("counts working days on serials", () => {
    expect(only("WORKDAY(46332,1)")).toBe(46_335);
    expect(only("WORKDAY(10,1)")).toEqual({
      kind: "value",
      origin: 0,
      detail: "not a date in range",
    });
    expect(only("WORKDAY(46332,1E9)")).toEqual({
      kind: "value",
      origin: 0,
      detail: "WORKDAY days out of range",
    });
    expect(only("WORKDAY(2958465,1)")).toEqual({
      kind: "value",
      origin: 0,
      detail: "WORKDAY result out of range",
    });
  });

  test("reads an empty result as 0, and an empty cell of a range as empty", () => {
    expect(only("IF(TRUE,[x.e])", input(null))).toBe(0);
    expect(evaluate([input(2), formula("SUM([x.r])", [0, -1])])[1]).toBe(2);
  });

  test("reads a reference the cell does not list as an error", () => {
    expect(evaluate([formula("[x.a]+1")])[0]).toEqual({
      kind: "syntax",
      origin: 0,
      detail: "unknown reference",
    });
  });

  test("refuses a list where one value is expected", () => {
    expect(evaluate([input(1), formula("[x.l]+1", [0])])[1]).toEqual({
      kind: "value",
      origin: 1,
      detail: "a list where one value is expected",
    });
  });
});

describe("cells", () => {
  test("a fixed error reads as itself, and its readers inherit it", () => {
    const fixed = { kind: "missing-reference" as const, origin: 0, detail: "gone" };
    expect(evaluate([{ kind: "error", error: fixed }, formula("[x.a]+1", 0)])).toEqual([
      fixed,
      fixed,
    ]);
  });

  test("an input may hold an error", () => {
    const bad = { kind: "value" as const, origin: 0 };
    expect(evaluate([input(bad), formula("[x.a]*2", 0)])).toEqual([bad, bad]);
  });

  test("a cycle that reaches the engine reads as cycle", () => {
    expect(evaluate([formula("[x.b]+1", 1), formula("[x.a]+1", 0), formula("[x.a]*0", 0)])).toEqual(
      [
        { kind: "cycle", origin: 0 },
        { kind: "cycle", origin: 1 },
        { kind: "cycle", origin: 0 },
      ],
    );
  });
});

describe("recalculation", () => {
  // 0 and 1 are inputs; 2 = [0]*2; 3 = [2]+1; 4 = [1]+1.
  const cells = (): EngineCell[] => [
    input(1),
    input(10),
    formula("[x.a]*2", 0),
    formula("[x.b]+1", 2),
    formula("[x.c]+1", 1),
  ];

  test("evaluates only what depends on the changed inputs, in order", () => {
    const engine = createOwnEngine();
    engine.load(cells());
    engine.set(0, 5);
    expect(engine.recalc()).toEqual([2, 3]);
    expect([engine.read(2), engine.read(3), engine.read(4)]).toEqual([10, 11, 11]);
    expect(engine.recalc()).toEqual([]);
  });

  test("equals a fresh load after any sequence of edits", () => {
    const engine = createOwnEngine();
    engine.load(cells());
    engine.set(1, 3);
    engine.set(0, -2);
    engine.recalc();
    const fresh = createOwnEngine();
    fresh.load([input(-2), input(3), ...cells().slice(2)]);
    for (let name = 0; name < 5; name++) expect(engine.read(name)).toEqual(fresh.read(name));
  });

  test("refuses to set anything but an input, or to read an unknown name", () => {
    const engine = createOwnEngine();
    engine.load([...cells(), { kind: "error", error: { kind: "cycle", origin: 5 } }]);
    expect(() => engine.set(2, 1)).toThrow("engine name 2 is not an input");
    expect(() => engine.set(5, 1)).toThrow("engine name 5 is not an input");
    expect(() => engine.set(9, 1)).toThrow("no engine name 9");
    expect(() => engine.read(9)).toThrow("no engine name 9");
  });
});
