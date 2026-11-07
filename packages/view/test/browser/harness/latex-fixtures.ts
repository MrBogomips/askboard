// The LaTeX nests the depth probe and the bounds browser file render (latex-kanban-timeline, tasks
// 4.10, 4.11 and 6.8): one construct nested to a depth the contract's scan reads, alone, repeated
// side by side to 2,000 code points, and as a branching nest. No browser here, so the fixtures have
// a unit test beside them.

import { readFileSync } from "node:fs";
import { LATEX_EXPRESSION_MAX_CHARS, scanLatex } from "@askboard/contract";

/** A construct nested: `open` repeated, `middle`, then `close` repeated; a level adds `levelDepth`. */
export type Construct = {
  readonly name: string;
  readonly open: string;
  readonly middle: string;
  readonly close: string;
  readonly levelDepth: 1 | 2;
};

const construct = (
  name: string,
  open: string,
  close: string,
  levelDepth: 1 | 2 = 1,
  middle = "x",
): Construct => ({ name, open, middle, close, levelDepth });

/** The constructs of task 4.10, each in the form the review named it. */
export const LATEX_CONSTRUCTS: readonly Construct[] = [
  construct("\\frac{ }{x}", "\\frac{", "}{x}"),
  construct("{ \\over x}", "{", "\\over x}"),
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

const levelsOf = (c: Construct, depth: number) => ({
  levels: Math.floor(depth / c.levelDepth),
  // An odd depth with two-level constructs gets one plain group around the nest.
  wrapped: depth % c.levelDepth !== 0,
});

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

/** The depth the contract's scan reads in a fixture: what the probe records it under. */
export const depthOfFixture = (expression: string): number => scanLatex(expression).depth;

/** The control words KaTeX names, from its source (functions' `names`, `defineMacro` names). */
export const katexControlWords = (katexModule: string): readonly string[] => {
  const source = readFileSync(katexModule, "utf8");
  const literals = (text: string) =>
    [...text.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map(
      ([, body]) => JSON.parse(`"${body}"`) as string,
    );
  const found = new Set<string>();
  for (const [, body] of source.matchAll(/names:\s*\[((?:[^\]"]|"(?:[^"\\\n]|\\.)*")*)\]/g)) {
    for (const name of literals(body ?? "")) found.add(name);
  }
  for (const [, name] of source.matchAll(/defineMacro\(("(?:[^"\\\n]|\\.)*")/g)) {
    found.add(JSON.parse(name ?? '""') as string);
  }
  return [...found].filter((name) => /^\\[A-Za-z@]+$/.test(name)).sort();
};

/** A control word nested to `depth`, as task 4.5's guard nests it: `\name{\name{…x…}}`. */
export const nestControlWord = (name: string, depth: number): string =>
  `${`${name}{`.repeat(depth)}x${"}".repeat(depth)}`;
