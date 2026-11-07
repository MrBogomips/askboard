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

  test("a brace KaTeX reads as text closes nothing: a comment, a \\verb body (\\char and \\show are refused, task 4.21)", () => {
    for (const n of [3, 10, 25]) {
      expect(depthOf(nest("\\sqrt{%\n", "", "}", n)), `comment ${n}`).toBe(n);
      expect(depthOf(nest("\\sqrt{\\verb|}|", "", "}", n)), `verb ${n}`).toBe(n);
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

// The 4.12 re-review's X-2 asked the scan to read the token after `\char` and a backquote, and after
// `\show`; the 4.19 re-review's X-1 found more tokens it cannot read as KaTeX does (a `\verb` taken
// whole), so both commands are refused instead (task 4.21; `latex-unread-tokens.test.ts`).

// latex-public-api (contract spec: LaTeX nesting bounded, scenarios "Stacked combining marks" and
// "Accented text"; design decision 3): a run of n code points of U+0300 to U+036F reaches n + 1
// levels below the level that holds it, in a comment and in a \verb body too.
describe("stacked combining marks", () => {
  const marks = (n: number, mark = "̂"): string => mark.repeat(n);

  test("x and n marks reads n + 1, and a run of one is 2", () => {
    expect(depthOf("x")).toBe(0);
    expect(depthOf(`x${marks(1)}`)).toBe(2);
    expect(depthOf(`x${marks(10)}`)).toBe(11);
    expect(depthOf(`x${marks(11)}`)).toBe(12);
    expect(depthOf(`x${marks(130)}`)).toBe(131);
  });

  test("the whole block counts, whichever mark: first and last of U+0300 to U+036F, and a mix", () => {
    expect(depthOf(`x${marks(5, "̀")}`)).toBe(6);
    expect(depthOf(`x${marks(5, "ͯ")}`)).toBe(6);
    expect(depthOf(`x̀́̂ͯ`)).toBe(5);
    // The code points just outside the block end a run.
    expect(depthOf(`x${marks(5, "˿")}`)).toBe(0);
    expect(depthOf(`x${marks(5, "Ͱ")}`)).toBe(0);
  });

  test("the + 1 stands for the script: x^y and 10 marks read 11, as x and 10 marks do", () => {
    expect(depthOf(`x^y${marks(10)}`)).toBe(11);
    expect(depthOf(`x^y${marks(10)}`)).toBe(depthOf(`x${marks(10)}`));
  });

  test("a zero-width joiner between marks makes each its own run of one", () => {
    expect(depthOf(`x${"‍̂".repeat(20)}`)).toBe(2);
  });

  test("any other code point ends a run, a blank included", () => {
    expect(depthOf(`x${marks(5)} ${marks(5)}`)).toBe(6);
    expect(depthOf(`x${marks(5)}y${marks(5)}`)).toBe(6);
  });

  test("a mark as the first code point counts", () => {
    expect(depthOf(marks(1))).toBe(2);
    expect(depthOf(marks(10))).toBe(11);
  });

  test("marks in a comment and in a \\verb body count", () => {
    expect(depthOf(`%${marks(10)}`)).toBe(11);
    expect(depthOf(`x % ${marks(10)}\ny`)).toBe(11);
    expect(depthOf(`\\verb|${marks(10)}|`)).toBe(11);
  });

  test("the level that holds the run counts below it: marks inside a group add to the group", () => {
    expect(depthOf(`{x${marks(10)}}`)).toBe(12);
    expect(depthOf(`\\text{caf${"é"}}`)).toBe(3);
    expect(depthOf(`\\frac{x${marks(3)}}{y}`)).toBe(5);
  });

  test("a run ends at the end of the text, and a surrogate pair is no mark", () => {
    expect(depthOf(`x${marks(2)}\u{1d400}`)).toBe(3);
    expect(depthOf(`x\u{1d400}\u{1d400}`)).toBe(0);
  });

  test("a hostile text of 2,000 marks ends, reading 2,001", () => {
    expect(depthOf(marks(2_000))).toBe(2_001);
  });
});
