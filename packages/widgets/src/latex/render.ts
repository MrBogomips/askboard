// How the LaTeX draws its preview (latex-kanban-timeline, design decision 7; AD-8, NFR-5, NFR-9).
// The expression is agent or user text and is drawn as data: KaTeX builds nodes through the DOM
// API and its CSSOM (the page's policy allows no markup string with styles in it), trusts no
// command (so `\href`, `\url`, `\includegraphics` and the `\html...` family show as the plain text
// of their name, with no link, image, class, ID, style or data attribute from the expression),
// expands a macro at most 1,000 times, and starts every render with an empty macro table, so that
// `\gdef` never outlives its render.

import { LATEX_NESTING_MAX_DEPTH, scanLatex } from "@askboard/contract";
import type { KatexOptions } from "katex";
import {
  type KatexTree,
  LATEX_TREE_BOUNDS,
  renderTree,
  type TreeBounds,
  type TreeSize,
  treeSizeOf,
} from "./tree.ts";

/**
 * Why an expression was not given to KaTeX: it holds a macro definition or an internal command
 * (`command`), or nests deeper than the limit (`depth` and `limit`), as the contract's scan reads it.
 */
export type Refused =
  | { readonly command: string }
  | { readonly depth: number; readonly limit: number };

/**
 * What `renderInto` gives back: KaTeX's message (the empty string for anything but an `Error`) when
 * the expression does not render, the refusal when KaTeX never ran, or the size of an output past
 * the bounds, of which no node was made. An empty result is a drawn preview.
 */
export type Rendered = {
  readonly error?: string;
  readonly refused?: Refused;
  readonly tooComplex?: TreeSize;
};

// What the contract's scan refuses in `expression`, before KaTeX sees it: the bounds on work are on
// the source (design decision 7, Bounded work), so every caller of this module is bounded.
const refusalOf = (expression: string): Refused | undefined => {
  const { refused, depth } = scanLatex(expression);
  if (refused !== undefined) return { command: refused };
  return depth > LATEX_NESTING_MAX_DEPTH ? { depth, limit: LATEX_NESTING_MAX_DEPTH } : undefined;
};

/**
 * The options of one render, built anew for each call: `macros` is a table of its own, which KaTeX
 * writes the render's global definitions into. `trust` is the literal `false`, never a function
 * that decides by command or URL.
 */
export const renderOptions = (): KatexOptions => ({
  displayMode: true,
  throwOnError: true,
  trust: false,
  strict: "ignore",
  maxExpand: 1000,
  maxSize: 20,
  output: "htmlAndMathml",
  macros: {},
});

// An error as a message: any thrown value is one, so that no failure of the preview reaches the page.
// A thrown value that is no `Error` has no text of its own: the empty message, for which the
// component shows the string tables' fixed text (view-and-widgets spec: LaTeX parse errors).
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : "");

// What KaTeX builds for `expression`, measured: the tree, or why there is none.
type Built =
  | { readonly tree: KatexTree }
  | { readonly refused: Refused }
  | { readonly tooComplex: TreeSize }
  | { readonly error: string };

// Design decision 7's steps 1 and 2: the scan's refusal, then KaTeX's output tree and its size
// against `bounds`. No node of the page exists yet.
const build = (expression: string, bounds: TreeBounds): Built => {
  const refused = refusalOf(expression);
  if (refused !== undefined) return { refused };
  try {
    const tree = renderTree(expression, renderOptions());
    const size = treeSizeOf(tree);
    const past =
      size.depth > bounds.depth || size.nodes > bounds.nodes || size.fractions > bounds.fractions;
    return past ? { tooComplex: size } : { tree };
  } catch (error) {
    return { error: messageOf(error) };
  }
};

/**
 * KaTeX's message for an expression that does not render, or nothing for one that does (the empty
 * expression renders), or `{refused}` for one the scan refuses, which KaTeX never sees, or
 * `{tooComplex}` for one whose output is past `bounds`. For tests in Bun, which has no DOM: it builds
 * KaTeX's tree and measures it, and makes no node.
 */
export const parseProblem = (
  expression: string,
  bounds: TreeBounds = LATEX_TREE_BOUNDS,
): string | { readonly refused: Refused } | { readonly tooComplex: TreeSize } | undefined => {
  const built = build(expression, bounds);
  if ("error" in built) return built.error;
  if ("tree" in built) return undefined;
  return built;
};

/** The text shown when the page's document is not in standards mode, where KaTeX's styles fail. */
const QUIRKS_ERROR = "KaTeX doesn't work in quirks mode.";

/**
 * Draws `expression` into `element`, replacing its content, and says what went wrong, if
 * anything, in design decision 7's order: an expression the scan refuses is not given to KaTeX; an
 * output tree past `bounds` is not drawn; every error is caught, a `ParseError` and a browser's
 * `RangeError` on a deep nest alike. A failure of any kind leaves the element as it was. The tree
 * KaTeX built is the one drawn (`toNode`), so no second parse and no scratch node: no node exists
 * before the tree is measured. `katex.render` refuses a document that is not in standards mode and
 * drawing the tree skips that check, so it is made here, and fails closed.
 */
export const renderInto = (
  element: HTMLElement,
  expression: string,
  bounds: TreeBounds = LATEX_TREE_BOUNDS,
): Rendered => {
  const built = build(expression, bounds);
  if (!("tree" in built)) return built;
  try {
    if (element.ownerDocument.compatMode !== "CSS1Compat") return { error: QUIRKS_ERROR };
    element.replaceChildren(built.tree.toNode());
    return {};
  } catch (error) {
    return { error: messageOf(error) };
  }
};
