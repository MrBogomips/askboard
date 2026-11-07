// The LaTeX nests the bounds browser file renders (latex-kanban-timeline, tasks
// 4.10, 4.11 and 6.8): one construct nested to a depth the contract's scan reads, alone, repeated
// side by side to 2,000 code points, and as a branching nest. No browser here, so the fixtures have
// a unit test beside them.

import { LATEX_EXPRESSION_MAX_CHARS, scanLatex } from "@askboard/contract";

/**
 * A construct nested: `open` repeated, `middle`, then `close` repeated; a level adds `levelDepth` to
 * the scan's depth, after the `offset` the nest as a whole adds (an `array`'s column group).
 */
export type Construct = {
  readonly name: string;
  readonly open: string;
  readonly middle: string;
  readonly close: string;
  readonly levelDepth: number;
  readonly offset: number;
};

export const construct = (
  name: string,
  open: string,
  close: string,
  levelDepth = 1,
  offset = 0,
): Construct => ({ name, open, middle: "x", close, levelDepth, offset });

/** The constructs of task 4.10, each in the form the review named it. */
export const LATEX_CONSTRUCTS: readonly Construct[] = [
  construct("\\frac{ }{x}", "\\frac{", "}{x}"),
  construct("{ \\over x}", "{", "\\over x}", 2),
  construct("x^{ }", "x^{", "}", 2),
  construct("x_{ }", "x_{", "}", 2),
  construct("x^\\frac{ }{x}", "x^\\frac{", "}{x}"),
  construct("\\sqrt{ }", "\\sqrt{", "}"),
  construct("\\hat{ }", "\\hat{", "}"),
  construct("\\overbrace{ }", "\\overbrace{", "}"),
  construct("\\underbrace{ }", "\\underbrace{", "}"),
  construct("\\cancel{ }", "\\cancel{", "}"),
  construct("\\stackrel{x}{ }", "\\stackrel{x}{", "}"),
  construct("\\boxed{ }", "\\boxed{", "}"),
  construct("\\binom{ }{x}", "\\binom{", "}{x}"),
  construct("\\left( \\right)", "\\left(", "\\right)"),
  construct("\\begin{matrix}", "\\begin{matrix}", "\\end{matrix}"),
  construct("\\text{$ $}", "\\text{$", "$}"),
  construct("{ }", "{", "}"),
];

const levelsOf = (c: Construct, depth: number) => {
  const own = depth - c.offset;
  return {
    levels: Math.floor(own / c.levelDepth),
    // An odd depth with two-level constructs gets one plain group around the nest.
    wrapped: own % c.levelDepth !== 0,
  };
};

const wrap = (text: string, wrapped: boolean): string => (wrapped ? `{${text}}` : text);

/** The construct nested to `depth` levels of the scan's count, once. */
export const nestAlone = (c: Construct, depth: number): string => {
  const { levels, wrapped } = levelsOf(c, depth);
  return wrap(`${c.open.repeat(levels)}${c.middle}${c.close.repeat(levels)}`, wrapped);
};

/** The nest repeated side by side while it fits in the limit of the expression. */
export const nestSideBySide = (c: Construct, depth: number): string => {
  const one = nestAlone(c, depth);
  return one.repeat(Math.max(1, Math.floor(LATEX_EXPRESSION_MAX_CHARS / one.length)));
};

// The chain with its `copies` deepest levels each holding two of the level below.
const chain = (c: Construct, levels: number, copies: number): string => {
  let text = c.middle;
  for (let level = 1; level <= levels; level += 1) {
    text = `${c.open}${text}${level <= copies ? text : ""}${c.close}`;
  }
  return text;
};

/**
 * A branching nest: the chain with as many of its deepest levels holding two copies as the limit of
 * the expression allows, so that work which doubles with each level meets the doubling in every one.
 */
export const nestBranching = (c: Construct, depth: number): string => {
  const { levels, wrapped } = levelsOf(c, depth);
  let best = wrap(chain(c, levels, 0), wrapped);
  for (let copies = 1; copies <= levels; copies += 1) {
    const text = wrap(chain(c, levels, copies), wrapped);
    if ([...text].length > LATEX_EXPRESSION_MAX_CHARS) break;
    best = text;
  }
  return best;
};

export type Shape = "alone" | "side by side" | "branching";

export const SHAPES: readonly Shape[] = ["alone", "side by side", "branching"];

export const fixtureFor = (c: Construct, shape: Shape, depth: number): string =>
  shape === "alone"
    ? nestAlone(c, depth)
    : shape === "side by side"
      ? nestSideBySide(c, depth)
      : nestBranching(c, depth);

/** The depth the contract's scan reads in a fixture: what the fixtures are checked against. */
export const depthOfFixture = (expression: string): number => scanLatex(expression).depth;
