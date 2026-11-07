// KaTeX's own output, measured before any of it reaches the page (latex-kanban-timeline, task 4.14;
// design decision 7, Bounded output; AD-8, NFR-5). `renderTree` builds the tree `katex.render` itself
// builds before it makes nodes, and `treeSizeOf` gives that tree's depth and node count, so the board
// can refuse an output too deep or too large for the page to lay out, whatever source made it. Nothing
// here makes a node of the page.

import katex, { type KatexOptions } from "katex";

/** What the walk reads of a node: the list its sub-nodes stand in, which every node class of KaTeX 0.19.1 holds. */
export type TreeLike = { readonly children?: readonly TreeLike[] };

/** KaTeX's output tree: measured through `children`, drawn through `toNode`, read as text through `toMarkup`. */
export type KatexTree = TreeLike & { toNode(): Node; toMarkup(): string };

/** A tree's size: the levels from the root (depth 1) to its deepest node, and every node. */
export type TreeSize = { readonly depth: number; readonly nodes: number };

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
 * The depth and node count of `tree`, walked through `children` with an explicit stack, so that a
 * tree of any depth or width is measured with no recursion and no stack overflow.
 */
export const treeSizeOf = (tree: TreeLike): TreeSize => {
  const nodes: TreeLike[] = [tree];
  const levels: number[] = [1];
  let count = 0;
  let depth = 0;
  while (nodes.length > 0) {
    const node = nodes.pop() as TreeLike;
    const level = levels.pop() as number;
    count += 1;
    if (level > depth) depth = level;
    const { children } = node;
    if (Array.isArray(children)) {
      for (const child of children) {
        nodes.push(child);
        levels.push(level + 1);
      }
    }
  }
  return { depth, nodes: count };
};
