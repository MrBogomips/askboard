// The LaTeX's entry (latex-kanban-timeline, task 1.3; contract spec: LaTeX items, LaTeX changes,
// Teaching text of LaTeX, Kanban and Timeline), composed over the shipped registry with
// `withWidgetTypes` while the type is not yet registered (design decision 12), in a fresh Ajv.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  EDIT_WIDGETS_SESSION,
  LATEX_CHANGES,
  LATEX_EDITED_PROPS,
  LATEX_FIXTURE_ITEM,
  latexAct,
  latexAnswerEvent,
  latexFetchItemResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  applyElementChanges,
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  cutLatexExpression,
  elementChanges,
  LATEX_DEFINING_COMMANDS,
  LATEX_EXPRESSION_MAX_CHARS,
  LATEX_NESTING_MAX_DEPTH,
  LATEX_SCHEMA_IDS,
  LATEX_SHAPE,
  LATEX_WIDGET,
  latexPropsProblems,
  scanLatex,
  widgetChangesProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { elementShapeOf, validateBoardMessage } from "../src/validate.ts";
import { LATEX_EXPECTED } from "../src/widgets/latex/wording.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(LATEX_WIDGET);
const ITEM = LATEX_FIXTURE_ITEM;
const latex = (props: unknown, id = "formula") => ({ type: "latex", id, props });
const withExpression = (expression: unknown) => latex({ expression });
const problems = (item: unknown) => askProblems(TYPES, item as ReturnType<typeof latex>);

describe("LaTeX items", () => {
  test("a LaTeX item in a question passes, and the board document built from it validates", () => {
    const item = latex({ expression: "\\frac{a}{b}" });
    expect(problems(item)).toEqual([]);
    expect(askAccepted(TYPES, item)).toBe(true);
    const document = {
      version: BOARD_DOCUMENT_VERSION,
      askId: "latex-check-a1b2",
      title: "Is the formula right?",
      items: [{ type: "question", id: "q", rev: 1, props: { text: "Right?", items: [item] } }],
    };
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.boardDocument, document)).toEqual([]);
    const long = withExpression("x".repeat(2_001));
    const refused = {
      ...document,
      items: [{ ...document.items[0], props: { text: "Q", items: [long] } }],
    };
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.boardDocument, refused)).not.toEqual([]);
  });

  test("an empty expression passes", () => {
    expect(problems(withExpression(""))).toEqual([]);
    expect(askAccepted(TYPES, withExpression(""))).toBe(true);
  });

  test("2,000 characters pass and 2,001 fail, naming the item and expression", () => {
    expect(LATEX_EXPRESSION_MAX_CHARS).toBe(2_000);
    expect(problems(withExpression("x".repeat(2_000)))).toEqual([]);
    expect(askAccepted(TYPES, withExpression("x".repeat(2_000)))).toBe(true);
    const [problem, ...rest] = problems(withExpression("x".repeat(2_001)));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("formula");
    expect(problem?.field).toBe("props.expression");
    expect(problem?.message).toContain('item "formula"');
    expect(problem?.message).toContain("expression");
    expect(askAccepted(TYPES, withExpression("x".repeat(2_001)))).toBe(false);
  });

  test("the limit counts code points: 2,000 astral characters pass, 2,001 fail with the count", () => {
    const astral = (n: number) => "\u{1D465}".repeat(n);
    expect(problems(withExpression(astral(2_000)))).toEqual([]);
    expect(askAccepted(TYPES, withExpression(astral(2_000)))).toBe(true);
    expect(latexPropsProblems({ expression: astral(2_000) })).toEqual([]);
    expect(askAccepted(TYPES, withExpression(astral(2_001)))).toBe(false);
    // The schema refuses first, naming the item and the field; the check words the count.
    const [schemaProblem, ...others] = problems(withExpression(astral(2_001)));
    expect(others).toEqual([]);
    expect(schemaProblem?.itemId).toBe("formula");
    expect(schemaProblem?.field).toBe("props.expression");
    const refused = latexPropsProblems({ expression: astral(2_001) });
    expect(refused.map(({ path }) => path)).toEqual(["/expression"]);
    expect(refused[0]?.message).toContain("2001 characters");
    const check = (value: string) =>
      widgetChangesProblems(
        { type: "latex", id: "formula" },
        [{ op: "set", target: "formula.expression", value }],
        TYPES,
      );
    expect(check(astral(2_000))).toEqual([]);
    expect(check(astral(2_001))).not.toEqual([]);
  });

  test("cutLatexExpression keeps the first 2,000 code points and never splits a pair", () => {
    const astral = (n: number) => "\u{1D465}".repeat(n);
    expect(cutLatexExpression(astral(1_999))).toBe(astral(1_999));
    expect(cutLatexExpression(astral(2_000))).toBe(astral(2_000));
    expect(cutLatexExpression(astral(2_001))).toBe(astral(2_000));
    expect(cutLatexExpression("")).toBe("");
    const mixed = `${"a".repeat(1_999)}\u{1D465}tail`;
    expect(cutLatexExpression(mixed)).toBe(`${"a".repeat(1_999)}\u{1D465}`);
    expect(cutLatexExpression("a".repeat(2_005))).toBe("a".repeat(2_000));
  });

  test("a field the props do not define fails, naming it", () => {
    const [problem, ...rest] = problems(latex({ expression: "x", displayMode: true }));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("formula");
    expect(problem?.field).toBe("props.displayMode");
    expect(problem?.message).toContain("displayMode");
    expect(askAccepted(TYPES, latex({ expression: "x", displayMode: true }))).toBe(false);
  });

  test("props without an expression, or with one that is no text, fail", () => {
    expect(problems(latex({}))[0]?.field).toBe("props.expression");
    expect(problems(withExpression(3))[0]?.field).toBe("props.expression");
    expect(problems(withExpression(null))[0]?.field).toBe("props.expression");
    expect(askAccepted(TYPES, latex({}))).toBe(false);
    expect(askAccepted(TYPES, latex("x"))).toBe(false);
  });

  test("the plain check restates the limits and never throws on props it cannot read", () => {
    expect(latexPropsProblems({ expression: "" })).toEqual([]);
    expect(latexPropsProblems({ expression: "x".repeat(2_000) })).toEqual([]);
    const long = latexPropsProblems({ expression: "x".repeat(2_001) });
    expect(long.map(({ path }) => path)).toEqual(["/expression"]);
    expect(long[0]?.message).toContain("2000");
    expect(latexPropsProblems({ expression: "x", display: 1 }).map(({ path }) => path)).toEqual([
      "/display",
    ]);
    expect(latexPropsProblems({}).map(({ path }) => path)).toEqual(["/expression"]);
    for (const props of [null, 3, "x", [], { expression: null }, { expression: 4 }]) {
      expect(() => latexPropsProblems(props)).not.toThrow();
      expect(latexPropsProblems(props)).not.toEqual([]);
    }
    // The entry runs the same check after the schema, so a schema-valid value gives none.
    expect(LATEX_WIDGET.propsProblems({ expression: "ok" }, "agent")).toEqual([]);
  });
});

// Group 4 review S-1 (contract spec: LaTeX macro definitions refused; design decisions 3 and 7): a
// macro definition is refused, named, read as KaTeX 0.19.1's lexer reads control words.
const DEFINING = [
  "\\def",
  "\\gdef",
  "\\edef",
  "\\xdef",
  "\\global",
  "\\long",
  "\\let",
  "\\futurelet",
  "\\newcommand",
  "\\renewcommand",
  "\\providecommand",
] as const;

// The review's probe: a body of 900 `x` repeated 540 times through `\a`, 1,998 code points that froze
// the board for minutes, and the nested variant that repeats `\b` through two more levels.
const FREEZING = `\\def\\b{${"x".repeat(900)}}\\def\\a{${"\\b".repeat(540)}}\\a`;
const NESTED = `\\def\\b{${"x".repeat(300)}}\\def\\c{${"\\b".repeat(50)}}\\def\\d{${"\\c".repeat(50)}}\\d`;

describe("LaTeX macro definitions refused", () => {
  test("the review's freezing probe is within the limit and refused, naming \\def", () => {
    expect([...FREEZING].length).toBe(1_998);
    expect([...NESTED].length).toBeLessThanOrEqual(2_000);
    for (const expression of [FREEZING, NESTED]) {
      const refused = latexPropsProblems({ expression });
      expect(refused.map(({ path }) => path)).toEqual(["/expression"]);
      expect(refused[0]?.message).toBe(
        "the expression defines a macro with `\\def`, which a LaTeX item does not allow",
      );
      const [problem, ...rest] = problems(withExpression(expression));
      expect(rest).toEqual([]);
      expect(problem?.itemId).toBe("formula");
      expect(problem?.field).toBe("props.expression");
      expect(problem?.message).toContain("\\def");
    }
  });

  test.each(DEFINING)("%s is refused, named", (command) => {
    const refused = latexPropsProblems({ expression: `${command}\\zq{x}\\zq` });
    expect(refused).toHaveLength(1);
    expect(refused[0]?.path).toBe("/expression");
    expect(refused[0]?.message).toContain(`\`${command}\``);
    expect(problems(withExpression(`a + ${command} b`))[0]?.message).toContain(command);
  });

  test("a prefix names the prefix, the first defining command in the text", () => {
    expect(latexPropsProblems({ expression: "\\global\\def\\a{x}" })[0]?.message).toContain(
      "`\\global`",
    );
    expect(latexPropsProblems({ expression: "x \\let\\a=b \\def\\c{d}" })[0]?.message).toContain(
      "`\\let`",
    );
  });

  test("the list holds the eleven commands, frozen, and the scan names the first of them", () => {
    expect([...LATEX_DEFINING_COMMANDS].sort()).toEqual([...DEFINING].sort());
    expect(Object.isFrozen(LATEX_DEFINING_COMMANDS)).toBe(true);
    for (const command of DEFINING) {
      expect(scanLatex(`a ${command}`).refused).toBe(command);
      expect(scanLatex(`${command}x`).refused).toBeUndefined();
    }
    expect(scanLatex("").refused).toBeUndefined();
    expect(scanLatex("\\global\\def").refused).toBe("\\global");
    expect(scanLatex("\\frac \\let").refused).toBe("\\let");
  });

  test("the scan ends on 2,000 backslashes and on 2,000 code points of letters, with no command", () => {
    // No timing assertion: task 4.7's security review probes the run time.
    for (const text of [
      "\\".repeat(1_000),
      "\\".repeat(2_000),
      `\\${"a".repeat(1_999)}`,
      "\\a".repeat(666),
      `${"\\".repeat(1_000)}def`,
      "\\de".repeat(500),
      "\\defa".repeat(333),
    ]) {
      expect(scanLatex(text).refused).toBeUndefined();
    }
  });

  test("the request's wording and the teaching text say that no definition is allowed", () => {
    expect(LATEX_EXPECTED["latex.props.expression"]).toContain("no macro definition");
    expect(LATEX_WIDGET.skill?.notes?.join(" ")).toContain("a macro definition");
    expect(LATEX_WIDGET.skill?.notes?.join(" ")).not.toContain("outlives");
  });

  test("an ask holding \\newcommand is refused by the request's check, naming it", () => {
    const [problem, ...rest] = problems(withExpression("\\newcommand{\\c}{x}\\c"));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("formula");
    expect(problem?.message).toContain('item "formula"');
    expect(problem?.message).toContain("\\newcommand");
  });

  test("an edited value's check refuses it as well, so ask-core can", () => {
    const refused = LATEX_WIDGET.propsProblems({ expression: "\\def\\a{x}\\a" }, "edited");
    expect(refused.map(({ message }) => message)).toEqual([
      "the expression defines a macro with `\\def`, which a LaTeX item does not allow",
    ]);
  });

  test("control words that only look like one pass", () => {
    for (const expression of [
      "a \\\\ def",
      "\\left( x \\right)",
      "\\default",
      "\\DEF",
      "\\\\def",
      "\\\\\\\\let",
      "def newcommand",
      "\\frac{a}{b}",
      "\\ def",
      "x\\",
      "",
    ]) {
      expect(latexPropsProblems({ expression })).toEqual([]);
    }
  });

  test("a control word holding @ is refused, so \\def@x no longer passes", () => {
    expect(latexPropsProblems({ expression: "\\def@x" })[0]?.message).toContain("`\\def@x`");
    for (const expression of ["\\default", "\\left( x \\right)", "a \\\\ def", "\\\\@x", "x@y"]) {
      expect(latexPropsProblems({ expression }), expression).toEqual([]);
    }
  });

  test("a control symbol does not hide the word after it, and `\\\\` is a symbol of its own", () => {
    expect(latexPropsProblems({ expression: "\\,\\def\\a{x}" })).toHaveLength(1);
    expect(latexPropsProblems({ expression: "\\%\\let" })).toHaveLength(1);
    expect(latexPropsProblems({ expression: "\\\\\\def" })).toHaveLength(1);
  });
});

// The 4.7 re-review's X-1 (contract spec: LaTeX macro definitions and internal commands refused;
// design decisions 3 and 7, Bounded work): `\tag` and `\color` define macros by side effect, named
// `\df@tag` and `\current@color`, which the source can call because KaTeX's lexer reads `@` as a
// letter. Every control word holding `@` is refused.
const TAG = `\\tag{$${"x".repeat(900)}$}${"\\df@tag".repeat(156)}`;
const COLOR = `\\color{${"x".repeat(900)}}${"\\current@color".repeat(78)}`;
const BOTH = `\\tag{$\\color{${"x".repeat(1_200)}}${"\\current@color".repeat(20)}$}${"\\df@tag".repeat(20)}`;

describe("LaTeX internal commands refused", () => {
  test.each([
    ["\\tag and \\df@tag", TAG, "\\df@tag"],
    ["\\color and \\current@color", COLOR, "\\current@color"],
    ["both, multiplied", BOTH, "\\current@color"],
  ])(
    "the review's form %s is within the limit and refused, naming %s",
    (_name, expression, word) => {
      expect([...expression].length).toBeLessThanOrEqual(2_000);
      const refused = latexPropsProblems({ expression });
      expect(refused.map(({ path }) => path)).toEqual(["/expression"]);
      expect(refused[0]?.message).toBe(
        `the expression names \`${word}\`, one of KaTeX's internal commands, which a LaTeX item does not allow`,
      );
      const [problem, ...rest] = problems(withExpression(expression));
      expect(rest).toEqual([]);
      expect(problem?.itemId).toBe("formula");
      expect(problem?.field).toBe("props.expression");
      expect(problem?.message).toContain(word);
    },
  );

  test("the scan gives the first word holding @, definition or internal, in the text's order", () => {
    expect(scanLatex("\\def@x").refused).toBe("\\def@x");
    expect(scanLatex("\\@").refused).toBe("\\@");
    expect(scanLatex("a \\@ifnextchar b \\def").refused).toBe("\\@ifnextchar");
    expect(scanLatex("\\def \\df@tag").refused).toBe("\\def");
    expect(scanLatex("x \\tag@literal").refused).toBe("\\tag@literal");
    for (const text of [
      "\\\\@x",
      "\\\\\\\\@",
      "x@y",
      "@",
      "\\ @",
      "\\,@",
      "\\tag{x}",
      "\\color{red}x",
    ]) {
      expect(scanLatex(text).refused, text).toBeUndefined();
    }
  });

  test("an ask holding \\current@color is refused by the request's check, naming it", () => {
    const [problem, ...rest] = problems(withExpression("\\color{x}\\current@color"));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("formula");
    expect(problem?.message).toContain('item "formula"');
    expect(problem?.message).toContain("\\current@color");
  });

  test("an edited value's check refuses it as well, so ask-core can", () => {
    const refused = LATEX_WIDGET.propsProblems(
      { expression: "\\color{x}\\current@color" },
      "edited",
    );
    expect(refused.map(({ message }) => message)).toEqual([
      "the expression names `\\current@color`, one of KaTeX's internal commands, which a LaTeX item does not allow",
    ]);
  });

  test("the request's wording and the teaching text name the internal commands", () => {
    expect(LATEX_EXPECTED["latex.props.expression"]).toContain("no internal command");
    expect(LATEX_WIDGET.skill?.notes?.join(" ")).toContain("a KaTeX internal command");
    expect(LATEX_WIDGET.skill?.notes?.join(" ")).toContain("a name holding `@`");
  });

  test("the list's comment no longer claims every way KaTeX defines a macro", () => {
    const source = readFileSync(
      new URL("../src/widgets/latex/constants.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("every way KaTeX defines a macro");
    expect(source).toContain("`@`");
  });
});

// The 4.7 re-review's X-2 (contract spec: LaTeX nesting bounded; design decisions 3 and 7, Bounded
// work): a nest deeper than `LATEX_NESTING_MAX_DEPTH` is refused, naming the depth and the limit.
// The constructs are those of the depth probe (`harness/latex-fixtures.ts` in the view's browser
// tests), each nested to a depth the scan reads: a script and its group are two levels.
const CONSTRUCTS: readonly (readonly [string, string, string, 1 | 2])[] = [
  ["\\frac{", "}{x}", "frac", 1],
  ["{", "\\over x}", "over", 2],
  ["x^{", "}", "sup", 2],
  ["x_{", "}", "sub", 2],
  ["x^\\frac{", "}{x}", "sup frac", 1],
  ["\\sqrt{", "}", "sqrt", 1],
  ["\\hat{", "}", "hat", 1],
  ["\\overbrace{", "}", "overbrace", 1],
  ["\\underbrace{", "}", "underbrace", 1],
  ["\\cancel{", "}", "cancel", 1],
  ["\\stackrel{x}{", "}", "stackrel", 1],
  ["\\boxed{", "}", "boxed", 1],
  ["\\binom{", "}{x}", "binom", 1],
  ["\\left(", "\\right)", "left", 1],
  ["\\begin{matrix}", "\\end{matrix}", "matrix", 1],
  ["\\text{$", "$}", "text", 1],
  ["{", "}", "braces", 1],
];

const nested = (open: string, close: string, step: 1 | 2, depth: number): string => {
  const levels = Math.floor(depth / step);
  const text = `${open.repeat(levels)}x${close.repeat(levels)}`;
  return depth % step === 0 ? text : `{${text}}`;
};

describe("LaTeX nesting bounded", () => {
  const LIMIT = LATEX_NESTING_MAX_DEPTH;

  test("the limit is a whole number of at least 8, and its depth is what the scan reads", () => {
    expect(Number.isInteger(LIMIT)).toBe(true);
    expect(LIMIT).toBeGreaterThanOrEqual(8);
    expect(scanLatex(nested("\\frac{", "}{x}", 1, LIMIT)).depth).toBe(LIMIT);
  });

  test.each(CONSTRUCTS)(
    "%s %s (%s) at the limit passes and one level deeper is refused",
    (open, close, _name, step) => {
      const atLimit = nested(open, close, step, LIMIT);
      const past = nested(open, close, step, LIMIT + 1);
      expect(scanLatex(atLimit).depth).toBe(LIMIT);
      expect(scanLatex(past).depth).toBe(LIMIT + 1);
      expect(latexPropsProblems({ expression: atLimit })).toEqual([]);
      expect(problems(withExpression(atLimit))).toEqual([]);
      expect(
        latexPropsProblems({ expression: past }).map(({ path, message }) => [path, message]),
      ).toEqual([
        [
          "/expression",
          `the expression nests ${LIMIT + 1} levels deep, more than the limit of ${LIMIT}`,
        ],
      ]);
      const [problem, ...rest] = problems(withExpression(past));
      expect(rest).toEqual([]);
      expect(problem?.itemId).toBe("formula");
      expect(problem?.field).toBe("props.expression");
      expect(problem?.message).toContain(`${LIMIT + 1} levels deep`);
      expect(problem?.message).toContain(`limit of ${LIMIT}`);
    },
  );

  test("the review's crash forms, x^{ and \\sqrt{ 130 deep, are refused naming their depth", () => {
    const script = "x^{".repeat(130) + "y" + "}".repeat(130);
    const root = "\\sqrt{".repeat(130) + "x" + "}".repeat(130);
    expect(latexPropsProblems({ expression: script })[0]?.message).toContain("260 levels deep");
    expect(latexPropsProblems({ expression: root })[0]?.message).toContain("130 levels deep");
    expect(problems(withExpression(root))[0]?.message).toContain("limit of");
  });

  test("a nest past the limit that a comment or a \\verb hides from the closers is refused too", () => {
    const hidden = "\\sqrt{%\n".repeat(LIMIT + 1) + "}".repeat(LIMIT + 1);
    expect(latexPropsProblems({ expression: hidden })[0]?.message).toContain(
      `${LIMIT + 1} levels deep`,
    );
  });

  // The 4.12 re-review's X-1 and X-2 (contract spec: LaTeX nesting counted as KaTeX reads it): an
  // infix adds a level to its group, and an opener after a character code is counted.
  test("an infix fraction nest past the limit is refused: two levels per nest", () => {
    const frac = Math.floor(LIMIT / 2) + 1;
    const fractions = `${"\\frac{".repeat(frac)}x${"\\over y}{x}".repeat(frac)}`;
    const boxes = `${"\\boxed{".repeat(LIMIT)}x${"\\over y}".repeat(LIMIT)}`;
    for (const [expression, depth] of [
      [fractions, 2 * frac],
      [boxes, 2 * LIMIT],
    ] as const) {
      expect(scanLatex(expression).depth).toBe(depth);
      expect(
        latexPropsProblems({ expression }).map(({ path, message }) => [path, message]),
      ).toEqual([
        [
          "/expression",
          `the expression nests ${depth} levels deep, more than the limit of ${LIMIT}`,
        ],
      ]);
      const [problem, ...rest] = problems(withExpression(expression));
      expect(rest).toEqual([]);
      expect(problem?.itemId).toBe("formula");
      expect(problem?.message).toContain(`${depth} levels deep`);
      expect(problem?.message).toContain(`limit of ${LIMIT}`);
    }
    // Half as many nests, at the limit, pass.
    const atLimit = `${"\\frac{".repeat(LIMIT / 2)}x${"\\over y}{x}".repeat(LIMIT / 2)}`;
    expect(scanLatex(atLimit).depth).toBe(LIMIT);
    expect(latexPropsProblems({ expression: atLimit })).toEqual([]);
  });

  test("the review's hidden form, \\char` { 130 times, x, \\over} 130 times, is refused naming its depth", () => {
    const hidden = `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`;
    expect([...hidden]).toHaveLength(1_821);
    expect(latexPropsProblems({ expression: hidden })[0]?.message).toBe(
      `the expression nests 260 levels deep, more than the limit of ${LIMIT}`,
    );
    const [problem, ...rest] = problems(withExpression(hidden));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("formula");
    expect(problem?.message).toContain("260 levels deep");
  });

  test("a command is named before the depth, and one problem is given", () => {
    const both = `\\def\\a{x}${"{".repeat(LIMIT + 1)}`;
    const refused = latexPropsProblems({ expression: both });
    expect(refused).toHaveLength(1);
    expect(refused[0]?.message).toContain("`\\def`");
  });

  test("an edited value past the limit is refused as well, so ask-core can", () => {
    const refused = LATEX_WIDGET.propsProblems(
      { expression: nested("\\sqrt{", "}", 1, LIMIT + 3) },
      "edited",
    );
    expect(refused.map(({ message }) => message)).toEqual([
      `the expression nests ${LIMIT + 3} levels deep, more than the limit of ${LIMIT}`,
    ]);
  });

  test("the request's wording and the teaching text name the limit", () => {
    expect(LATEX_EXPECTED["latex.props.expression"]).toContain(`${LIMIT} levels`);
    expect(LATEX_WIDGET.skill?.notes?.join(" ")).toContain(`${LIMIT} levels`);
  });
});

describe("LaTeX changes", () => {
  const CHANGES = LATEX_WIDGET.edits?.changes;

  test("the shape names expression alone, and the item's shape is that one", () => {
    expect(LATEX_SHAPE).toEqual({ fields: ["expression"] });
    expect(Object.isFrozen(LATEX_SHAPE)).toBe(true);
    expect(Object.isFrozen(LATEX_SHAPE.fields)).toBe(true);
    expect(elementShapeOf(ITEM, TYPES)).toEqual(LATEX_SHAPE);
    expect(CHANGES?.$id).toBe(LATEX_SCHEMA_IDS.changes);
  });

  test("one set of expression passes, an add and a null set fail, naming the operation", () => {
    const check = (changes: unknown) =>
      widgetChangesProblems({ type: "latex", id: "formula" }, changes, TYPES);
    expect(check([{ op: "set", target: "formula.expression", value: "a" }])).toEqual([]);
    expect(check([{ op: "set", target: "formula.expression", value: "" }])).toEqual([]);
    expect(check([])).toEqual([]);
    const add = check([{ op: "add", target: "formula.e", value: { expression: "a" } }]);
    expect(add[0]?.message).toContain("add");
    expect(add[0]?.message).toContain("item formula");
    const cleared = check([{ op: "set", target: "formula.expression", value: null }]);
    expect(cleared[0]?.message).toContain("operation 0");
    expect(cleared[0]?.message).toContain("set");
  });

  test("a move, a remove, another field, a deeper target and a long value fail", () => {
    const check = (change: unknown) =>
      widgetChangesProblems({ type: "latex", id: "formula" }, [change], TYPES);
    expect(check({ op: "move", target: "formula.expression" })).not.toEqual([]);
    expect(check({ op: "remove", target: "formula.expression" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.display", value: "a" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.x.expression", value: "a" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula", value: "a" })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.expression", value: 3 })).not.toEqual([]);
    const value = "x".repeat(2_000);
    expect(check({ op: "set", target: "formula.expression", value })).toEqual([]);
    expect(check({ op: "set", target: "formula.expression", value: `${value}x` })).not.toEqual([]);
    expect(check({ op: "set", target: "formula.expression", value: "a", extra: 1 })).not.toEqual(
      [],
    );
  });

  test("a corrected expression is one set of the whole field, which applies back", () => {
    const changes = elementChanges("formula", ITEM.props, LATEX_EDITED_PROPS, LATEX_SHAPE);
    expect(changes).toEqual([{ op: "set", target: "formula.expression", value: "a^2+b^2=c^2" }]);
    expect(changes).toEqual(LATEX_CHANGES);
    expect(widgetChangesProblems(ITEM, changes, TYPES)).toEqual([]);
    expect(applyElementChanges("formula", ITEM.props, changes, LATEX_SHAPE)).toEqual(
      LATEX_EDITED_PROPS,
    );
  });

  test("an edit of any other key, a display mode say, is refused by the diff", () => {
    expect(() =>
      elementChanges("formula", ITEM.props, { ...LATEX_EDITED_PROPS, display: true }, LATEX_SHAPE),
    ).toThrow("display");
  });
});

describe("the LaTeX's fixtures", () => {
  test("take their version from the constants and hold the edit as the diff gives it", () => {
    expect(latexAct.version).toBe(BOARD_PROTOCOL_VERSION);
    const [act] = latexAct.acts;
    expect(act).toMatchObject({ type: "answer", itemId: EDIT_WIDGETS_SESSION.question });
    expect((act as { values?: unknown }).values).toEqual({ formula: LATEX_EDITED_PROPS });
    expect(latexAnswerEvent.changes).toEqual(LATEX_CHANGES);
    expect(ITEM.props).not.toEqual(LATEX_EDITED_PROPS);
  });

  test("the answer event and the fetch of the item validate", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.answerEvent, latexAnswerEvent)).toEqual([]);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, latexFetchItemResult)).toEqual([]);
    expect(validateBoardMessage("toHost", latexAct).ok).toBe(true);
  });
});

describe("the LaTeX's entry in the registry's own check", () => {
  test("passes over the registry holding it, edits declared and no result or derived", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(LATEX_WIDGET.props.$id).toBe(LATEX_SCHEMA_IDS.props);
    expect(LATEX_WIDGET.result).toBeUndefined();
    expect(LATEX_WIDGET.derived).toBeUndefined();
    expect(LATEX_WIDGET.noun).toBe("a LaTeX");
  });

  test("its teaching text is within bounds and its example is accepted in an ask", () => {
    const { skill, example } = LATEX_WIDGET;
    expect(skill?.use.length).toBeGreaterThanOrEqual(1);
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    expect(skill?.use).toContain("LaTeX");
    for (const note of skill?.notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
    expect(skill?.notes?.join(" ")).toContain("<id>.expression");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
  });
});

describe("the registry's other modules", () => {
  test("no module of src/widgets outside latex/ and registry.ts names the type", () => {
    const root = new URL("../src/widgets/", import.meta.url);
    const named: string[] = [];
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.parentPath.includes("/latex")) continue;
      if (entry.name === "registry.ts") continue;
      const text = readFileSync(`${entry.parentPath}/${entry.name}`, "utf8");
      // The change's own name is how comments cite it; the type's name is what must not appear.
      if (/latex/i.test(text.replaceAll("latex-kanban-timeline", ""))) named.push(entry.name);
    }
    expect(named).toEqual([]);
  });
});
