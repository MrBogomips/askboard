// KaTeX's own output, measured before any of it reaches the page (latex-kanban-timeline, tasks 4.14
// and 4.20; design decision 7, Bounded output; AD-8, NFR-5). `renderTree` builds the tree
// `katex.render` itself builds before it makes nodes, and `treeSizeOf` gives that tree's depth, node
// count and nested fractions, so the board can refuse an output too deep, too large or too nested in
// MathML fractions for the page to lay out, whatever source made it. Nothing here makes a node of the
// page.

import katex, { type KatexOptions } from "katex";

/** What the walk reads of a node: the list its sub-nodes stand in, which every node class of KaTeX 0.19.1 holds. */
export type TreeLike = {
  readonly type?: string;
  readonly children?: readonly TreeLike[];
};

/** KaTeX's output tree: measured through `children`, drawn through `toNode`, read as text through `toMarkup`. */
export type KatexTree = TreeLike & { toNode(): Node; toMarkup(): string };

/**
 * A tree's size: the levels from the root (depth 1) to its deepest node, every node, and the most
 * MathML fractions (nodes of type `mfrac`) on one path from the root. The HTML half's spans of class
 * `mfrac` have no `type` and do not count.
 */
export type TreeSize = {
  readonly depth: number;
  readonly nodes: number;
  readonly fractions: number;
};

const FRACTION = "mfrac";

/** The bounds of an output tree: past any one of them the preview is not drawn (task 4.16). */
export type TreeBounds = {
  readonly depth: number;
  readonly nodes: number;
  readonly fractions: number;
};

// The bounds, from task 4.15's measurement (design decision 7, Measuring, "Measured:"), by rules 1 to
// 3 in order, on 2026-11-07 on an Apple M3 Max in Chromium 156.0.8078.4 and WebKit 27.2 with KaTeX's
// fonts loaded: every fixture within them rendered in under 500 ms in both engines, 351 ms at most
// in WebKit. A KaTeX upgrade re-runs the probe `latex-depth-probe.ts` in the view's browser tests.

/** The most nodes in an output tree: the flat fixtures' (`x`, `\le`, a matrix, `\frac{a}{b}`) 500 ms limit. */
export const LATEX_TREE_MAX_NODES = 21_344;

/** The most MathML fractions nested on one path: WebKit's layout costs about 1.7 times more per level. */
export const LATEX_TREE_MAX_FRACTIONS = 11;

/** The deepest output tree: the deepest measured within the two bounds above (172 ms at most; the sweep reached depth 319 in Chromium with no crash). */
export const LATEX_TREE_MAX_DEPTH = 245;

/** What `renderInto` and `parseProblem` measure an output against unless told otherwise. */
export const LATEX_TREE_BOUNDS: TreeBounds = /* @__PURE__ */ Object.freeze({
  depth: LATEX_TREE_MAX_DEPTH,
  nodes: LATEX_TREE_MAX_NODES,
  fractions: LATEX_TREE_MAX_FRACTIONS,
});

// KaTeX's types do not declare `__renderToDomTree`, which its documentation calls unstable; the
// widgets' render test pins KaTeX at 0.19.1 and reads the function in its source.
type TreeBuilder = (expression: string, options: KatexOptions) => KatexTree;

const INTERNAL = "__renderToDomTree";

/**
 * The tree KaTeX builds for `expression`, as `katex.render` builds it before it makes nodes
 * (`renderToDomTree(expression, options).toNode()`): drawing this tree is drawing what `render` would.
 * With `throwOnError` it throws as `render` does. The function is looked up on every call and checked:
 * if KaTeX stops offering it, this throws an `Error` naming it, and nothing is drawn.
 */
export const renderTree = (expression: string, options: KatexOptions): KatexTree => {
  const build = (katex as unknown as Record<string, unknown>)[INTERNAL];
  if (typeof build !== "function") {
    throw new Error(`KaTeX offers no ${INTERNAL} function, so the expression cannot be measured`);
  }
  return (build as TreeBuilder)(expression, options);
};

/**
 * The depth, node count and nested fractions of `tree`, walked through `children` with explicit
 * stacks, so that a tree of any depth or width is measured with no recursion and no stack overflow.
 */
export const treeSizeOf = (tree: TreeLike): TreeSize => {
  const nodes: TreeLike[] = [tree];
  const levels: number[] = [1];
  const chains: number[] = [0];
  let count = 0;
  let depth = 0;
  let fractions = 0;
  while (nodes.length > 0) {
    const node = nodes.pop() as TreeLike;
    const level = levels.pop() as number;
    const chain = (chains.pop() as number) + (node.type === FRACTION ? 1 : 0);
    count += 1;
    if (level > depth) depth = level;
    if (chain > fractions) fractions = chain;
    const { children } = node;
    if (Array.isArray(children)) {
      for (const child of children) {
        nodes.push(child);
        levels.push(level + 1);
        chains.push(chain);
      }
    }
  }
  return { depth, nodes: count, fractions };
};
