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

  test("n nested constructs are n deep, and a script and its group make 2n", () => {
    for (const n of [1, 2, 5, 12, 40]) {
      expect(depthOf(nest("\\sqrt{", "x", "}", n)), `sqrt ${n}`).toBe(n);
      expect(depthOf(nest("\\frac{", "x", "}{x}", n)), `frac ${n}`).toBe(n);
      expect(depthOf(nest("{", "x", "\\over x}", n)), `over ${n}`).toBe(n);
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
