import { describe, expect, test } from "bun:test";
import type { Expression } from "../src/formula/expression.ts";
import { lex } from "../src/formula/lexer.ts";
import { MAX_NESTING, parse } from "../src/formula/parser.ts";

const parsed = (formula: string): Expression => {
  const lexed = lex(formula);
  if (!lexed.ok) throw new Error(lexed.reason);
  const result = parse(lexed.tokens);
  if ("kind" in result) throw new Error(result.reason);
  return result;
};

const failure = (formula: string): { kind: string; reason: string } => {
  const lexed = lex(formula);
  if (!lexed.ok) throw new Error(lexed.reason);
  const result = parse(lexed.tokens);
  if (!("kind" in result)) throw new Error(`${formula} parsed`);
  return result;
};

const num = (value: number): Expression => ({ k: "number", value });

describe("the parser", () => {
  test("reads literals and references", () => {
    expect(parsed("1.5")).toEqual(num(1.5));
    expect(parsed('"a"')).toEqual({ k: "text", value: "a" });
    expect(parsed("TRUE")).toEqual({ k: "boolean", value: true });
    expect(parsed("[x.a]")).toEqual({ k: "reference", index: 0 });
  });

  test("binds * tighter than +, and ^ tighter than *", () => {
    expect(parsed("1+2*3^2")).toEqual({
      k: "chain",
      operators: ["+"],
      operands: [
        num(1),
        {
          k: "chain",
          operators: ["*"],
          operands: [num(2), { k: "chain", operators: ["^"], operands: [num(3), num(2)] }],
        },
      ],
    });
  });

  test("makes ^ left-associative: 2^3^2 is one chain", () => {
    expect(parsed("2^3^2")).toEqual({
      k: "chain",
      operators: ["^", "^"],
      operands: [num(2), num(3), num(2)],
    });
  });

  test("binds unary minus tighter than ^", () => {
    expect(parsed("-2^2")).toEqual({
      k: "chain",
      operators: ["^"],
      operands: [{ k: "negate", operand: num(2) }, num(2)],
    });
    expect(parsed("2^-1")).toEqual({
      k: "chain",
      operators: ["^"],
      operands: [num(2), { k: "negate", operand: num(1) }],
    });
  });

  test("chains comparisons from the left: 1<2<3", () => {
    expect(parsed("1<2<3")).toEqual({
      k: "chain",
      operators: ["<", "<"],
      operands: [num(1), num(2), num(3)],
    });
  });

  test("keeps a run of one precedence flat, so a long sum builds no deep tree", () => {
    const sum = parsed(`1${"+1".repeat(4000)}`);
    expect(sum.k).toBe("chain");
    if (sum.k === "chain") expect(sum.operands).toHaveLength(4001);
    expect(parsed("10-2-3")).toEqual({
      k: "chain",
      operators: ["-", "-"],
      operands: [num(10), num(2), num(3)],
    });
  });

  test("reads calls with their arguments", () => {
    expect(parsed("IF([x.a], 1)")).toEqual({
      k: "call",
      name: "IF",
      args: [{ k: "reference", index: 0 }, num(1)],
    });
    expect(parsed("sum(1,(2))")).toEqual({ k: "call", name: "SUM", args: [num(1), num(2)] });
  });

  test.each([
    ["ROUND(1)", "ROUND takes 2 arguments, got 1"],
    ["IF(1)", "IF takes 2 to 3 arguments, got 1"],
    ["SQRT(1,2)", "SQRT takes 1 argument, got 2"],
    ["SUM()", "SUM takes 1 to 255 arguments, got 0"],
    [`SUM(${"1,".repeat(255)}1)`, "SUM takes 1 to 255 arguments, got 256"],
  ])("checks the arguments of %#", (formula, reason) => {
    expect(failure(formula)).toEqual({ kind: "syntax", reason });
  });

  test.each([
    ["1+", "unexpected end of formula"],
    ["SUM(1,,2)", "unexpected , at 6"],
    ["=1+2", "unexpected = at 0"],
    ["1 2", "unexpected 2 at 2"],
    ["()", "unexpected ) at 1"],
    ["", "unexpected end of formula"],
    ["SUM(1 2)", "expected ) to close SUM"],
    ["1e309", "number 1e309 is out of range"],
    ["A1", "unknown name A1"],
    ['1 "a"', 'unexpected "a" at 2'],
    ["1 TRUE", "unexpected TRUE at 2"],
    ["1 FALSE", "unexpected FALSE at 2"],
    ["1 SUM(2)", "unexpected SUM at 2"],
    ["1 [x.a]", "unexpected [x.a] at 2"],
    ["1 (2)", "unexpected ( at 2"],
  ])("refuses %s", (formula, reason) => {
    expect(failure(formula)).toEqual({ kind: "syntax", reason });
  });

  test("lets an error that is not a refusal through", () => {
    const tokens = new Proxy([], {
      get: () => {
        throw new RangeError("not a token list");
      },
    });
    expect(() => parse(tokens)).toThrow(RangeError);
  });

  test("refuses a function outside the whitelist", () => {
    expect(failure("NOW()")).toEqual({
      kind: "not-whitelisted",
      reason: "function NOW is not whitelisted",
    });
  });

  test("stops at its own nesting guard instead of overflowing the stack", () => {
    const deep = `${"(".repeat(MAX_NESTING + 1)}1${")".repeat(MAX_NESTING + 1)}`;
    expect(failure(deep)).toEqual({ kind: "syntax", reason: `nesting deeper than ${MAX_NESTING}` });
    expect(failure(`${"-".repeat(10_000)}1`)).toEqual({
      kind: "syntax",
      reason: `nesting deeper than ${MAX_NESTING}`,
    });
    expect(parsed(`${"(".repeat(MAX_NESTING)}1${")".repeat(MAX_NESTING)}`)).toEqual(num(1));
  });
});
