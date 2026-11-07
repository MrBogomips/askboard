// Commands whose next token the scan does not read (latex-kanban-timeline, task 4.21; contract
// spec: LaTeX nesting counted as KaTeX reads it, scenario "Commands whose next token the scan does
// not read"; design decision 3). `\show` and a character code given by a backquote take the next
// token whole, and `\verb|}|` is one token for KaTeX's lexer: instead of reading it again, the check
// refuses both commands, naming them (4.19 re-review X-1).

import { describe, expect, test } from "bun:test";
import { LATEX_FIXTURE_ITEM, withWidgetTypes } from "../src/fixtures/index.ts";
import { LATEX_WIDGET, latexPropsProblems, scanLatex } from "../src/index.ts";
import { askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(LATEX_WIDGET);
const messageOf = (expression: string): string | undefined =>
  latexPropsProblems({ expression })[0]?.message;
const refusedOf = (expression: string): string | undefined => scanLatex(expression).refused;

const SHOW = "the expression uses `\\show`, which a LaTeX item does not allow";
const CHAR = "the expression uses ``\\char` ``, which a LaTeX item does not allow";

// The review's two nests: 12 batches of `\sqrt{` ×11 with `\show\verb|` + `}` ×11 + `|` inside, then
// `x` and 132 closers (1,201 code points); and `\frac{\show\verb|}|` ×18, `x`, `}{x}` ×18.
const SQRT_BATCHES = `${`${"\\sqrt{".repeat(11)}\\show\\verb|${"}".repeat(11)}|`.repeat(12)}x${"}".repeat(132)}`;
const FRAC_SHOWS = `${"\\frac{\\show\\verb|}|".repeat(18)}x${"}{x}".repeat(18)}`;

describe("commands whose next token the scan does not read", () => {
  test("the review's two nests are the code points it counted", () => {
    expect([...SQRT_BATCHES]).toHaveLength(1_201);
    expect([...FRAC_SHOWS]).toHaveLength(415);
  });

  const WORD_FRACS = `${"\\frac{\\char`\\verb|}|".repeat(12)}x${"}{x}".repeat(12)}`;

  test.each([
    ["\\show\\verb|}}|", "\\show"],
    ["\\show{x}", "\\show"],
    ["x \\show", "\\show"],
    ["\\show%\n}", "\\show"],
    ["\\char`\\{", "\\char`"],
    ["\\char`}", "\\char`"],
    ["\\char `a", "\\char`"],
    ["\\char%c\n`a", "\\char`"],
    ["\\char`\\verb|}|", "\\char`"],
    ["\\sqrt{\\char`}", "\\char`"],
    ["\\char` {", "\\char`"],
    [SQRT_BATCHES, "\\show"],
    [FRAC_SHOWS, "\\show"],
    [WORD_FRACS, "\\char`"],
  ])("case %#: the text is refused, naming its command", (expression, command) => {
    expect(refusedOf(expression)).toBe(command);
  });

  test("the problems say so, in the agent's wording, for the item", () => {
    expect(messageOf("\\show\\verb|}}|")).toBe(SHOW);
    expect(messageOf("\\char`\\{")).toBe(CHAR);
    for (const expression of [SQRT_BATCHES, FRAC_SHOWS]) {
      expect(latexPropsProblems({ expression }).map(({ path }) => path)).toEqual(["/expression"]);
      expect(messageOf(expression)).toBe(SHOW);
      const [problem, ...rest] = askProblems(TYPES, {
        ...LATEX_FIXTURE_ITEM,
        props: { expression },
      });
      expect(rest).toEqual([]);
      expect(problem?.itemId).toBe(LATEX_FIXTURE_ITEM.id);
      expect(problem?.message).toContain("\\show");
    }
  });

  test("a refused command is named before the depth, and one problem is given", () => {
    expect(latexPropsProblems({ expression: `${"{".repeat(12)}\\show` })).toHaveLength(1);
    expect(messageOf(`${"{".repeat(12)}\\show`)).toBe(SHOW);
  });

  test("the first refused word is the one named, in the text's order", () => {
    expect(refusedOf("\\show\\def")).toBe("\\show");
    expect(refusedOf("\\def\\show")).toBe("\\def");
    expect(refusedOf("\\char`a\\df@tag")).toBe("\\char`");
    expect(refusedOf("\\df@tag\\char`a")).toBe("\\df@tag");
  });

  test.each([
    ["\\verb|}|", 0],
    ["\\sqrt{\\verb|}|}", 1],
    ["\\sqrt{\\verb|}|", 1],
    ['\\char"263A', 0],
    ["\\char'101{x}", 1],
    ["\\char65 x", 0],
    ["a\\char", 0],
    ["\\char\\alpha{x}", 1],
  ])("case %#: the other forms are still read as text and counted", (expression, depth) => {
    expect(refusedOf(expression)).toBeUndefined();
    expect(scanLatex(expression).depth).toBe(depth);
    expect(latexPropsProblems({ expression })).toEqual([]);
  });

  test("\\verb|}| inside \\sqrt{ still counts as text, so a nest of them is its depth", () => {
    for (const n of [3, 10, 11]) {
      const text = `${"\\sqrt{\\verb|}|".repeat(n)}${"}".repeat(n)}`;
      expect(scanLatex(text)).toEqual({ refused: undefined, depth: n });
    }
  });

  test("a word that only starts with \\show or \\char is no such command", () => {
    for (const expression of ["\\showx", "\\shown`", "\\charx`a", "\\chars"]) {
      expect(refusedOf(expression), expression).toBeUndefined();
    }
  });

  test("a hostile text ends: 400 backquote forms and 400 \\show, refused at the first", () => {
    expect(refusedOf("\\char`".repeat(400))).toBe("\\char`");
    expect(refusedOf("\\show".repeat(400))).toBe("\\show");
  });
});
