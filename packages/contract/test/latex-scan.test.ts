// The LaTeX scan's depth (latex-kanban-timeline, task 4.9; contract spec: LaTeX nesting bounded,
// scenarios "A script counts its argument" and "A brace KaTeX reads as text"; design decision 3):
// the most levels open at once, counted as KaTeX nests them. No limit is applied here.

import { describe, expect, test } from "bun:test";
import { scanLatex } from "../src/index.ts";

const depthOf = (text: string): number => scanLatex(text).depth;
const nest = (open: string, middle: string, close: string, n: number): string =>
  `${open.repeat(n)}${middle}${close.repeat(n)}`;

describe("the depth of an expression", () => {
  test("an expression with no group is 0, and so is one of control symbols only", () => {
    for (const text of ["", "x", "x + y = z", "\\{\\{x\\}\\}", "\\\\", "a\\%", "\\ \\,"]) {
      expect(depthOf(text), text).toBe(0);
    }
    expect(depthOf("\\\\{x}")).toBe(1);
    expect(depthOf("a\\%{")).toBe(1);
  });

  test("one group, one argument list, one script, one pair of delimiters, one environment is 1", () => {
    const ones = [
      "{x}",
      "\\frac{a}{b}",
      "x^y",
      "x_y",
      "\\left(x\\right)",
      "\\left\\{x\\right\\}",
      "\\bgroup x\\egroup",
      "\\begingroup x\\endgroup",
      "\\begin{matrix}a\\end{matrix}",
      "\\begin {matrix*} a \\end {matrix*}",
    ];
    for (const text of ones) expect(depthOf(text), text).toBe(1);
  });

  test("a script counts its argument: x^{y} is 2, x^{y^{z}} is 4", () => {
    expect(depthOf("x^{y}")).toBe(2);
    expect(depthOf("x_{y}")).toBe(2);
    expect(depthOf("x^{y^{z}}")).toBe(4);
    expect(depthOf("x^ {y}")).toBe(2);
    expect(depthOf("x^\n{y}")).toBe(2);
  });

  test("a script closes after the next token when no group opens first", () => {
    expect(depthOf("x^y^z")).toBe(1);
    expect(depthOf("x^\\alpha{a}")).toBe(1);
    expect(depthOf("x^\\{{a}")).toBe(1);
    expect(depthOf("x^\\bgroup y\\egroup")).toBe(2);
    expect(depthOf("x^\\begingroup y\\endgroup")).toBe(2);
    // The group after the script's token is a level of its own: the script is over.
    expect(depthOf("x^y{z}")).toBe(1);
    expect(depthOf("x^{y}{z}")).toBe(2);
  });

  test("n nested constructs are n deep, and a script and its group, or a group and its infix, make 2n", () => {
    for (const n of [1, 2, 5, 12, 40]) {
      expect(depthOf(nest("\\sqrt{", "x", "}", n)), `sqrt ${n}`).toBe(n);
      expect(depthOf(nest("\\frac{", "x", "}{x}", n)), `frac ${n}`).toBe(n);
      expect(depthOf(nest("{", "x", "\\over x}", n)), `over ${n}`).toBe(2 * n);
      expect(depthOf(nest("\\begin{matrix}", "x", "\\end{matrix}", n)), `matrix ${n}`).toBe(n);
      expect(depthOf(nest("\\left(", "x", "\\right)", n)), `left ${n}`).toBe(n);
      expect(depthOf(nest("x^{", "y", "}", n)), `script ${n}`).toBe(2 * n);
    }
  });

  test("a stray closer closes nothing", () => {
    expect(depthOf("}{x}")).toBe(1);
    expect(depthOf("}}}{x}")).toBe(1);
    expect(depthOf("\\right)\\end{matrix}\\egroup\\endgroup{x}")).toBe(1);
    expect(depthOf("{a}}}{b{c}}")).toBe(2);
  });

  test("a brace KaTeX reads as text closes nothing: a comment, a \\verb body, a character code, \\show", () => {
    for (const n of [3, 10, 25]) {
      expect(depthOf(nest("\\sqrt{%\n", "", "}", n)), `comment ${n}`).toBe(n);
      expect(depthOf(nest("\\sqrt{\\verb|}|", "", "}", n)), `verb ${n}`).toBe(n);
      expect(depthOf(nest("\\sqrt{\\char`}", "", "}", n)), `char ${n}`).toBe(n);
      expect(depthOf(nest("\\sqrt{\\show}", "", "}", n)), `show ${n}`).toBe(n);
      // The token after a comment is the one \show and \char read.
      expect(depthOf(nest("\\sqrt{\\show%\n}", "", "}", n)), `show, comment ${n}`).toBe(n);
      expect(depthOf(nest("\\sqrt{\\char%\n`%\n}", "", "}", n)), `char, comment ${n}`).toBe(n);
      expect(depthOf(nest("\\sqrt{\\verb*|}|", "", "}", n)), `verb* ${n}`).toBe(n);
    }
    expect(depthOf("\\verb|x|{a}{b}")).toBe(1);
    expect(depthOf("\\verb|{|{a}")).toBeGreaterThanOrEqual(1);
  });

  test("an opener after a % counts, so a nest cannot hide behind a comment", () => {
    expect(depthOf("\\url{%}\\sqrt{\\sqrt{x}}")).toBeGreaterThanOrEqual(3);
    expect(depthOf("{%{{{\n")).toBeGreaterThanOrEqual(4);
    expect(depthOf("\\verb|{{{|")).toBeGreaterThanOrEqual(3);
  });

  test("a \\verb that ends with its line, or has no delimiter, ignores closers only up to the line", () => {
    expect(depthOf("{\\verb|}\n}{x}")).toBe(1);
    for (const end of ["\r", String.fromCharCode(0x2028), String.fromCharCode(0x2029)]) {
      expect(depthOf(`{\\verb|}${end}}{x}`), JSON.stringify(end)).toBe(1);
    }
    expect(depthOf("{\\verb")).toBe(1);
    expect(depthOf("{\\verb*")).toBe(1);
    expect(depthOf("{\\verbx}{x}")).toBe(1);
  });

  test("the control words that do not read a brace are neither openers nor closers", () => {
    expect(depthOf("\\noexpand}{x}")).toBe(1);
    expect(depthOf("{\\expandafter}{x}")).toBe(1);
    expect(depthOf("\\left.\\middle|\\right.")).toBe(1);
  });

  test("a scan that refuses a word still gives the depth", () => {
    expect(scanLatex("\\def\\a{{x}}")).toEqual({ refused: "\\def", depth: 2 });
    expect(scanLatex("{x}")).toEqual({ refused: undefined, depth: 1 });
  });

  test("hostile texts end: 2,000 openers, 2,000 carets, a comment hiding closers, 1,000 scripted groups", () => {
    // No timing assertion: the security review probes the run time.
    expect(depthOf("{".repeat(2_000))).toBe(2_000);
    expect(depthOf("^".repeat(2_000))).toBe(1);
    expect(depthOf(`%${"}".repeat(1_999)}`)).toBe(0);
    expect(depthOf("x^{".repeat(1_000))).toBe(2_000);
    expect(depthOf("{^".repeat(1_000))).toBeGreaterThan(0);
    expect(depthOf("\\".repeat(2_000))).toBe(0);
    expect(depthOf("\\verb".repeat(400))).toBe(0);
  });
});

// The 4.12 re-review's X-1 (contract spec: LaTeX nesting counted as KaTeX reads it, scenario "An
// infix fraction"; design decision 3): an infix makes a fraction of what comes before it in its
// group, so it adds one level to the group that holds it, the root included.
describe("the depth of an infix fraction", () => {
  const INFIXES = ["\\over", "\\atop", "\\above1pt", "\\choose", "\\brace", "\\brack"];

  test("a top-level infix is 1 and one in braces is 2", () => {
    expect(depthOf("a \\over b")).toBe(1);
    expect(depthOf("{a \\over b}")).toBe(2);
    expect(depthOf("a \\over b \\over c")).toBe(1);
    expect(depthOf("{a \\over b}{c \\over d}")).toBe(2);
    expect(depthOf("{{a}{b} \\over {c}}")).toBe(3);
  });

  test("an infix adds its level to the deepest point of its group, wherever it stands", () => {
    expect(depthOf("{{x} \\over y}")).toBe(3);
    expect(depthOf("{\\over {{x}}}")).toBe(4);
    expect(depthOf("{{{x}} \\over y}")).toBe(4);
    expect(depthOf("{{{x}}} \\over y")).toBe(4);
    expect(depthOf("{{x}}\\over y")).toBe(3);
  });

  test.each(INFIXES)("%s inside each construct nests two levels per nest", (infix) => {
    for (const n of [1, 3, 7, 14]) {
      const text = [...Array(n).keys()].reduce((inner) => `\\frac{${inner} ${infix} y}{x}`, "x");
      expect(depthOf(text), `${infix} ${n}`).toBe(2 * n);
    }
  });

  test("the review's form: \\frac{ with \\over y}{x} nested 3 times is 6", () => {
    const text = [1, 2, 3].reduce((inner) => `\\frac{${inner}\\over y}{x}`, "x");
    expect(depthOf(text)).toBe(6);
  });

  test("an infix inside \\left...\\right, in an environment's cell and in \\text{$...$} adds its level", () => {
    expect(depthOf("\\left( a \\over b \\right)")).toBe(2);
    expect(depthOf("\\begin{matrix} a \\over b & c \\end{matrix}")).toBe(2);
    expect(depthOf("\\text{$a \\over b$}")).toBe(2);
    expect(depthOf("\\begin{matrix} {a} \\over b \\end{matrix}")).toBe(3);
    expect(depthOf("\\left( {a \\over b} \\right)")).toBe(3);
  });

  test("an infix in a script's group counts for that group", () => {
    expect(depthOf("x^{a \\over b}")).toBe(3);
    // KaTeX refuses `x^\over y`; the scan takes the infix as the script's token and counts its group.
    expect(depthOf("x^\\over y")).toBe(2);
  });

  test("a word that only starts with an infix's name is no infix", () => {
    expect(depthOf("{a \\overline b}")).toBe(1);
    expect(depthOf("{a \\overbrace{b}}")).toBe(2);
    expect(depthOf("{a \\atopx b}")).toBe(1);
  });
});

// The 4.12 re-review's X-2 (contract spec: scenario "An opener after a character code"): the raw
// token after `\char` and its quote, or after `\show`, is read after blanks and comments, but
// KaTeX's lexer drops blanks only after a control word, so a blank after a quote or a comment is
// that token and the opener after it is a real group. The scan leaves an opener to be counted.
describe("an opener after a character code or \\show", () => {
  const hidden = (open: string, close: string, n: number) => `${open.repeat(n)}x${close.repeat(n)}`;

  test.each([
    ["a blank", "\\char` {"],
    ["a line feed", "\\char`\n{"],
    ["a tab", "\\char`\t{"],
  ])("%s after the backquote: n openers with n closers are n deep", (_what, open) => {
    for (const n of [1, 3, 14, 130]) {
      expect(depthOf(hidden(open, "}", n)), String(n)).toBe(n);
    }
  });

  test("a comment and a line feed, a blank and a group: 1", () => {
    expect(depthOf("\\char`%c\n {x}")).toBe(1);
    expect(depthOf("\\show%c\n {x}")).toBe(1);
    expect(depthOf("\\show%\n {x}")).toBe(1);
  });

  test.each([
    ["\\left(x\\right)"],
    ["\\bgroup x\\egroup"],
    ["\\begingroup x\\endgroup"],
    ["\\begin{matrix}x\\end{matrix}"],
    ["{x}"],
  ])("a blank before %s: that level counts", (group) => {
    expect(depthOf(`\\char\` ${group}`)).toBe(1);
    expect(depthOf(`\\show ${group}`)).toBe(1);
    expect(depthOf(`\\show%\n ${group}`)).toBe(1);
  });

  test("the hidden form of the review: \\char` { 130 times, x, \\over} 130 times", () => {
    const text = `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`;
    expect([...text].length).toBe(1_821);
    // Each group holds an infix: two levels each.
    expect(depthOf(text)).toBe(260);
  });

  test("a token that is no opener is still taken: it closes nothing", () => {
    for (const n of [3, 10, 25]) {
      expect(depthOf(nest("\\sqrt{\\char`}", "", "}", n)), `char ${n}`).toBe(n);
      expect(depthOf(nest("\\sqrt{\\show}", "", "}", n)), `show ${n}`).toBe(n);
    }
    expect(depthOf("\\char`a{x}")).toBe(1);
    expect(depthOf("\\show\\alpha{x}")).toBe(1);
  });

  test("an infix is no token to take either: it keeps its level", () => {
    expect(depthOf("{\\show\\over x}")).toBe(2);
    expect(depthOf("{\\char`\\over x}")).toBe(2);
  });

  test("\\char and \\show at the end of the text take nothing", () => {
    expect(depthOf("{\\char")).toBe(1);
    expect(depthOf("{\\char`")).toBe(1);
    expect(depthOf("{\\show")).toBe(1);
    expect(depthOf("{\\show%")).toBe(1);
  });

  test("hostile texts end: 1,000 {\\over and 600 \\char` {", () => {
    // No timing assertion: the security review probes the run time.
    expect(depthOf("{\\over".repeat(1_000))).toBe(2_000);
    expect(depthOf("\\char` {".repeat(600))).toBe(600);
  });
});
