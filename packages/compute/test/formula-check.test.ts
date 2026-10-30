import { describe, expect, test } from "bun:test";
import { FORMULA_MAX_CHARS, FORMULA_MAX_DEPTH, RANGE_MAX_CELLS } from "@askboard/contract";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import { lex, type ReferenceSyntax, type Token } from "../src/formula/lexer.ts";

const tokensOf = (formula: string): readonly Token[] => {
  const lexed = lex(formula);
  if (!lexed.ok) throw new Error(lexed.reason);
  return lexed.tokens;
};

const referenceOf = (formula: string): ReferenceSyntax => {
  const token = tokensOf(formula)[0];
  if (token?.kind !== "reference") throw new Error(`${formula} is not a reference`);
  return token.reference;
};

const problemOf = (formula: string): { kind: string; reason: string } => {
  const checked = checkFormula(formula);
  if (!isProblem(checked)) throw new Error(`${formula} passed the check`);
  return checked;
};

describe("the lexer", () => {
  test("reads numbers, text, booleans, names, operators and punctuation", () => {
    expect(tokensOf('1.5e3 "a""b" true FALSE sum(x, 1) <= <> >= & %').map((t) => t.kind)).toEqual([
      "number",
      "text",
      "boolean",
      "boolean",
      "name",
      "open",
      "name",
      "comma",
      "number",
      "close",
      "operator",
      "operator",
      "operator",
      "operator",
      "operator",
    ]);
    const [number, text, yes, no, call, , bare] = tokensOf('.5 "a""b" TRUE false Sum ( x )');
    expect(number).toMatchObject({ kind: "number", value: 0.5 });
    expect(text).toMatchObject({ kind: "text", value: 'a"b' });
    expect(yes).toMatchObject({ kind: "boolean", value: true });
    expect(no).toMatchObject({ kind: "boolean", value: false });
    expect(call).toMatchObject({ kind: "name", name: "SUM", call: true });
    expect(bare).toMatchObject({ kind: "name", name: "X", call: false });
  });

  test("keeps where each token starts", () => {
    expect(tokensOf("1 + [x.a]").map((t) => t.at)).toEqual([0, 2, 4]);
  });

  test("numbers each reference in order of appearance", () => {
    const refs = tokensOf("[x.a]+[x.b]*[x.a]").filter((t) => t.kind === "reference");
    expect(refs.map((t) => (t.kind === "reference" ? t.index : -1))).toEqual([0, 1, 2]);
  });

  test("reads item fields, child fields, wildcards, cells and ranges", () => {
    expect(referenceOf("[wbs.expected]")).toEqual({
      form: "field",
      item: "wbs",
      levels: 0,
      field: "expected",
    });
    expect(referenceOf("[wbs.ux.optimistic]")).toEqual({
      form: "field",
      item: "wbs",
      child: "ux",
      levels: 0,
      field: "optimistic",
    });
    expect(referenceOf("[wbs.design.*.expected]")).toEqual({
      form: "field",
      item: "wbs",
      child: "design",
      levels: 1,
      field: "expected",
    });
    expect(referenceOf("[wbs.*.*.expected]")).toEqual({
      form: "field",
      item: "wbs",
      levels: 2,
      field: "expected",
    });
    expect(referenceOf("[sheet.B2]")).toEqual({ form: "cell", item: "sheet", cell: "B2" });
    expect(referenceOf("[sheet.B2:A1]")).toEqual({
      form: "range",
      item: "sheet",
      from: { column: 2, row: 2 },
      to: { column: 1, row: 1 },
      cells: 4,
    });
  });

  test("takes any ID inside brackets as an ID", () => {
    for (const id of [
      "constructor",
      "__proto__",
      "TRUE",
      "SUM",
      "A1",
      "-x",
      "123",
      "a".repeat(64),
    ]) {
      expect(referenceOf(`[${id}.${id === "A1" ? "B2" : "v"}]`).item).toBe(id);
    }
  });

  test.each([
    ["[x]", "needs an item and a field"],
    ["[x..a]", 'child ID ""'],
    ["[*.a]", 'item ID "*"'],
    ["[x.a.*]", 'field "*"'],
    ["[x.a b.v]", 'child ID "a b"'],
    [`[${"a".repeat(65)}.b.v]`, "item ID"],
    ["[wbs.design.ux.optimistic]", "at most one child ID"],
    ["[wbs.*.ux.optimistic]", "at most one child ID"],
    ["[sheet.child.A1]", "a cell belongs to an item"],
    ["[sheet.child.A1:B2]", "a range is item.A1:B3"],
    ["[x.a:b]", "a range is item.A1:B3"],
    ["[x.A1:B]", "a range is item.A1:B3"],
    ["[x.a", "unterminated reference"],
    ["[x.[a]]", "nested ["],
  ])("refuses the reference %s", (formula, reason) => {
    const lexed = lex(formula);
    expect(lexed.ok).toBe(false);
    if (!lexed.ok) expect(lexed.reason).toContain(reason);
  });

  test.each([
    ['"open', "unterminated text"],
    ["1;2", 'character ";"'],
    ["{1,2}", 'character "{"'],
    ["x!A1", 'character "!"'],
    ["$A$1", 'character "$"'],
    ["#REF!", 'character "#"'],
    ["@x", 'character "@"'],
    ["(1+2", "unbalanced ("],
    ["1+2)", "unbalanced )"],
  ])("refuses %s", (formula, reason) => {
    const lexed = lex(formula);
    expect(lexed.ok).toBe(false);
    if (!lexed.ok) expect(lexed.reason).toContain(reason);
  });
});

describe("the formula check", () => {
  test("passes a well-formed formula and lists its references in order", () => {
    const checked = checkFormula(
      "SUM([wbs.design.*.expected], [sheet.A1:B2]) / [wbs.ux.optimistic]",
    );
    expect(isProblem(checked)).toBe(false);
    if (!isProblem(checked)) {
      expect(checked.references.map((r) => r.form)).toEqual(["field", "range", "field"]);
    }
  });

  test("refuses a formula over the length limit before lexing it", () => {
    const formula = `"${"a".repeat(1024 * 1024)}`;
    expect(problemOf(formula)).toEqual({
      kind: "over-limit",
      reason: `formula of ${formula.length} characters, over the limit of ${FORMULA_MAX_CHARS}`,
    });
  });

  test("passes a flat sum of 4,001 terms under the length limit", () => {
    expect(isProblem(checkFormula(`1${"+1".repeat(4000)}`))).toBe(false);
  });

  test("passes 64 levels of parentheses and refuses 65", () => {
    expect(isProblem(checkFormula(`${"(".repeat(64)}1${")".repeat(64)}`))).toBe(false);
    expect(problemOf(`${"(".repeat(65)}1${")".repeat(65)}`)).toEqual({
      kind: "over-limit",
      reason: `nesting of 65 levels, over the limit of ${FORMULA_MAX_DEPTH}`,
    });
  });

  test("counts nested calls and runs of unary minus as nesting", () => {
    expect(problemOf(`${"SUM(".repeat(100)}1${")".repeat(100)}`).kind).toBe("over-limit");
    expect(problemOf(`${"-".repeat(5000)}1`)).toEqual({
      kind: "over-limit",
      reason: `nesting of 5000 levels, over the limit of ${FORMULA_MAX_DEPTH}`,
    });
    expect(problemOf(`(${"-".repeat(64)}1)`).reason).toContain("nesting of 65 levels");
    expect(isProblem(checkFormula(`${"-".repeat(64)}1`))).toBe(false);
  });

  test("refuses a range over the cell limit without listing its cells", () => {
    expect(problemOf("SUM([z.A1:XFD1048576])")).toEqual({
      kind: "over-limit",
      reason: `range [z.A1:XFD1048576] of 17179869184 cells, over the limit of ${RANGE_MAX_CELLS}`,
    });
    expect(isProblem(checkFormula("SUM([z.A1:A65536])"))).toBe(false);
    expect(problemOf("SUM([z.A1:B32769])").kind).toBe("over-limit");
  });

  test.each([
    ['INDIRECT("x.a")', "function INDIRECT"],
    ["OFFSET([x.a],1,0)", "function OFFSET"],
    ['HYPERLINK("https://example.com")', "function HYPERLINK"],
    ['WEBSERVICE("https://example.com")', "function WEBSERVICE"],
    ["NOW()", "function NOW"],
    ["rand()", "function RAND"],
    ["SUM(1,RAND())", "function RAND"],
    ["TODAY()", "function TODAY"],
    ['CONCATENATE("a","b")', "function CONCATENATE"],
    ["constructor(1)", "function CONSTRUCTOR"],
    ["toString()", "function TOSTRING"],
    ["__proto__(1)", "function __PROTO__"],
    ['hasOwnProperty("x")', "function HASOWNPROPERTY"],
    ['"a"&"b"', "operator &"],
    ["50%", "operator %"],
    ["+1", "unary +"],
    ["2*+3", "unary +"],
    ["SUM(+[x.a])", "unary +"],
  ])("refuses %s as not whitelisted", (formula, reason) => {
    const problem = problemOf(formula);
    expect(problem.kind).toBe("not-whitelisted");
    expect(problem.reason).toContain(reason);
  });

  test.each(["OR", "NOT", "ABS", "CEILING", "AVERAGE", "COUNT", "NETWORKDAYS", "networkdays"])(
    "refuses the dropped function %s",
    (name) => {
      const problem = problemOf(`${name}(1,2)`);
      expect(problem).toEqual({
        kind: "not-whitelisted",
        reason: `function ${name.toUpperCase()} is not whitelisted`,
      });
    },
  );

  test.each([
    ["A1+1", "unknown name A1"],
    ["__proto__", "unknown name __PROTO__"],
    ["constructor", "unknown name CONSTRUCTOR"],
    ["SUM 1", "unknown name SUM"],
    ["x.y", "unknown name X.Y"],
  ])("refuses the bare name in %s as syntax", (formula, reason) => {
    expect(problemOf(formula)).toEqual({ kind: "syntax", reason });
  });

  test.each([
    "1+",
    "(1+2",
    "1+2)",
    "SUM(1,,2)",
    "=1+2",
    "1;2",
    "[x.a",
    "ROUND(1)",
    "IF(1)",
    '"open',
    "1 2",
    "[x.a:b]",
    "[x..a]",
    "[*.a]",
    "[x.a.*]",
    "[x.A1:B]",
    "1e309",
    "{1,2}",
    "x!A1",
    "$A$1",
    "#REF!",
    "@x",
    "",
    "()",
  ])("refuses %s as syntax", (formula) => {
    expect(problemOf(formula).kind).toBe("syntax");
  });
});
