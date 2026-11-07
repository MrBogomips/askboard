// KaTeX's own output measured (latex-kanban-timeline, task 4.14; view-and-widgets spec: LaTeX output
// bounded; design decision 7, Bounded output): `renderTree` builds the tree `katex.render` would
// draw, and `treeSizeOf` gives its depth, node count and nested fractions without recursion (task
// 4.20 added the fractions).

import { describe, expect, spyOn, test } from "bun:test";
import { LATEX_INFIX_COMMANDS } from "@askboard/contract";
import katex from "katex";
import { renderOptions } from "./render.ts";
import { renderTree, type TreeLike, treeSizeOf } from "./tree.ts";

const sizeOfExpression = (expression: string) =>
  treeSizeOf(renderTree(expression, renderOptions()));
const nest = (open: string, middle: string, close: string, n: number): string =>
  `${open.repeat(n)}${middle}${close.repeat(n)}`;

describe("the size of KaTeX's tree for an expression", () => {
  test("x and {x} are the sizes read once on 0.19.1: a group adds a node, no level", () => {
    expect(sizeOfExpression("x")).toEqual({ depth: 8, nodes: 14, fractions: 0 });
    expect(sizeOfExpression("{x}")).toEqual({ depth: 8, nodes: 15, fractions: 0 });
    expect(sizeOfExpression("")).toEqual({ depth: 7, nodes: 9, fractions: 0 });
  });

  test("a script and a fraction add levels", () => {
    const base = sizeOfExpression("x");
    for (const expression of ["x^{x}", "\\frac{x}{x}"]) {
      const size = sizeOfExpression(expression);
      expect(size.depth, expression).toBeGreaterThan(base.depth);
      expect(size.nodes, expression).toBeGreaterThan(base.nodes);
    }
    expect(sizeOfExpression("x^{x}")).toEqual({ depth: 13, nodes: 27, fractions: 0 });
  });

  test("\\frac{ nested n + 1 times is deeper than nested n times, for n from 1 to 14", () => {
    let last = sizeOfExpression(nest("\\frac{", "x", "}{x}", 0)).depth;
    for (let n = 1; n <= 15; n += 1) {
      const depth = sizeOfExpression(nest("\\frac{", "x", "}{x}", n)).depth;
      expect(depth, `n = ${n}`).toBeGreaterThan(last);
      last = depth;
    }
    expect(sizeOfExpression(nest("\\frac{", "x", "}{x}", 14)).depth).toBe(105);
  });

  test("\\frac{ with \\over y}{x} nested n times is deeper than \\frac{ nested n times", () => {
    for (const n of [1, 2, 3, 7, 10, 14]) {
      const plain = sizeOfExpression(nest("\\frac{", "x", "}{x}", n));
      const infix = sizeOfExpression(nest("\\frac{", "x", "\\over y}{x}", n));
      expect(infix.depth, `n = ${n}`).toBeGreaterThan(plain.depth);
      expect(infix.nodes, `n = ${n}`).toBeGreaterThan(plain.nodes);
    }
  });

  test("the review's hidden form, \\char` { nested 20 times with \\over} closers, is deeper than 100", () => {
    const hidden = nest("\\char` {", "x", "\\over}", 20);
    // The review read a depth of 167 on this form.
    expect(sizeOfExpression(hidden).depth).toBe(167);
    expect(sizeOfExpression(hidden).depth).toBeGreaterThan(100);
  });

  test("the tree is what katex.render would draw: its markup is renderToString's", () => {
    for (const expression of ["x^2 + y_1", "\\frac{1}{2}", "\\sqrt{x}", ""]) {
      expect(renderTree(expression, renderOptions()).toMarkup(), expression).toBe(
        katex.renderToString(expression, renderOptions()),
      );
    }
  });

  test("an expression KaTeX refuses throws, as katex.render does under throwOnError", () => {
    expect(() => renderTree("\\frac{1}{", renderOptions())).toThrow("KaTeX parse error:");
    expect(() => renderTree("\\undefinedcommand", renderOptions())).toThrow(katex.ParseError);
  });
});

describe("the nested fractions of KaTeX's tree (task 4.20)", () => {
  const fractionsOf = (expression: string) => sizeOfExpression(expression).fractions;

  test("none for x; one for \\frac{a}{b}, whose HTML half's span of class mfrac does not count", () => {
    expect(fractionsOf("x")).toBe(0);
    expect(fractionsOf("\\frac{a}{b}")).toBe(1);
    // The HTML half does hold a span of class mfrac, and it has no type.
    expect(renderTree("\\frac{a}{b}", renderOptions()).toMarkup()).toContain('class="mfrac"');
  });

  test("\\frac{ with }{x} nested n times gives n, for n from 1 to 14", () => {
    for (let n = 1; n <= 14; n += 1) {
      expect(fractionsOf(nest("\\frac{", "x", "}{x}", n)), `n = ${n}`).toBe(n);
    }
  });

  test("two fractions side by side are one", () => {
    expect(fractionsOf("\\frac{a}{b}\\frac{c}{d}")).toBe(1);
  });

  test.each([
    ["\\dfrac", "\\dfrac{", "}{x}"],
    ["\\tfrac", "\\tfrac{", "}{x}"],
    ["\\cfrac", "\\cfrac{", "}{x}"],
    ["\\genfrac(){1pt}{}", "\\genfrac(){1pt}{}{", "}{x}"],
    ["\\binom", "\\binom{", "}{x}"],
    ["\\dbinom", "\\dbinom{", "}{x}"],
    ["\\tbinom", "\\tbinom{", "}{x}"],
  ])("%s nested 3 deep in its first argument gives 3", (_name, open, close) => {
    expect(fractionsOf(nest(open, "x", close, 3))).toBe(3);
  });

  test.each([...LATEX_INFIX_COMMANDS])("{ with %s then x} nested 3 deep gives 3", (command) => {
    // \above takes a size before its denominator.
    const tail = command === "\\above" ? `${command}1pt x}` : `${command} x}`;
    expect(fractionsOf(nest("{", "x", tail, 3))).toBe(3);
  });

  test("a hand-built tree of 100,000 nested mfrac gives 100,000, with no stack overflow", () => {
    let node: TreeLike = { type: "mfrac" };
    for (let level = 1; level < 100_000; level += 1) node = { type: "mfrac", children: [node] };
    expect(treeSizeOf(node)).toEqual({ depth: 100_000, nodes: 100_000, fractions: 100_000 });
  });

  test("1,000 of them side by side give 1", () => {
    const children: TreeLike[] = Array.from({ length: 1_000 }, () => ({ type: "mfrac" }));
    expect(treeSizeOf({ children })).toEqual({ depth: 2, nodes: 1_001, fractions: 1 });
  });

  test("a span of class mfrac, which has no type, is not a fraction", () => {
    const span = (children: TreeLike[]) => ({ classes: ["mfrac"], children });
    const tree = span([span([span([{ type: "mfrac" }])])]);
    expect(treeSizeOf(tree as TreeLike).fractions).toBe(1);
    expect(treeSizeOf(span([span([])]) as TreeLike).fractions).toBe(0);
  });

  test("a node of another type holding fractions does not break the chain's count", () => {
    const tree: TreeLike = {
      type: "mrow",
      children: [{ type: "mfrac", children: [{ type: "mrow", children: [{ type: "mfrac" }] }] }],
    };
    expect(treeSizeOf(tree).fractions).toBe(2);
  });
});

describe("treeSizeOf on a tree of plain objects", () => {
  test("a leaf is depth 1 and one node; a parent adds a level and a node", () => {
    expect(treeSizeOf({})).toEqual({ depth: 1, nodes: 1, fractions: 0 });
    expect(treeSizeOf({ children: [] })).toEqual({ depth: 1, nodes: 1, fractions: 0 });
    expect(treeSizeOf({ children: [{}, { children: [{}] }] })).toEqual({
      depth: 3,
      nodes: 4,
      fractions: 0,
    });
  });

  test("a tree 100,000 levels deep is measured with no stack overflow", () => {
    let node: TreeLike = {};
    for (let level = 1; level < 100_000; level += 1) node = { children: [node] };
    expect(treeSizeOf(node)).toEqual({ depth: 100_000, nodes: 100_000, fractions: 0 });
  });

  test("a tree 1,000,000 nodes wide is measured with no stack overflow", () => {
    const children: TreeLike[] = Array.from({ length: 999_999 }, () => ({}));
    expect(treeSizeOf({ children })).toEqual({ depth: 2, nodes: 1_000_000, fractions: 0 });
  });

  test("a node whose children are no list has none", () => {
    expect(treeSizeOf({ children: "text" } as unknown as TreeLike)).toEqual({
      depth: 1,
      nodes: 1,
      fractions: 0,
    });
  });
});

describe("KaTeX's internal function", () => {
  test("renderTree throws an Error naming __renderToDomTree when it is absent or no function", () => {
    const internals = katex as unknown as Record<string, unknown>;
    const original = internals.__renderToDomTree;
    try {
      delete internals.__renderToDomTree;
      expect(() => renderTree("x", renderOptions())).toThrow(Error);
      expect(() => renderTree("x", renderOptions())).toThrow("__renderToDomTree");
      internals.__renderToDomTree = "not a function";
      expect(() => renderTree("x", renderOptions())).toThrow("__renderToDomTree");
    } finally {
      internals.__renderToDomTree = original;
    }
    expect(sizeOfExpression("x").nodes).toBe(14);
  });

  test("renderTree builds no node of the page and calls neither render nor renderToString", () => {
    const spies = [spyOn(katex, "render"), spyOn(katex, "renderToString")];
    try {
      renderTree("x", renderOptions());
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
