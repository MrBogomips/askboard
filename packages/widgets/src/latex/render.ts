// How the LaTeX draws its preview (latex-kanban-timeline, design decision 7, and latex-public-api,
// design decisions 1 and 2; AD-8, NFR-5, NFR-9). Only KaTeX's documented interface is used:
// `render`, `renderToString`, `ParseError` and the options. The expression is agent or user text
// and is drawn as data: KaTeX builds nodes through the DOM
// API and its CSSOM (the page's policy allows no markup string with styles in it), trusts no
// command (so `\href`, `\url`, `\includegraphics` and the `\html...` family show as the plain text
// of their name, with no link, image, class, ID, style or data attribute from the expression),
// expands a macro at most 1,000 times, and starts every render with an empty macro table, so that
// `\gdef` never outlives its render.

import { LATEX_NESTING_MAX_DEPTH, scanLatex } from "@askboard/contract";
import katex, { type KatexOptions } from "katex";

/**
 * Why an expression was not given to KaTeX: it holds a macro definition or an internal command
 * (`command`), or nests deeper than the limit (`depth` and `limit`), as the contract's scan reads it.
 */
export type Refused =
  | { readonly command: string }
  | { readonly depth: number; readonly limit: number };

/**
 * What `renderInto` gives back: KaTeX's message (the empty string for anything but an `Error`) when
 * the expression does not render, or the refusal when KaTeX never ran. An empty result is a drawn
 * preview.
 */
export type Rendered = {
  readonly error?: string;
  readonly refused?: Refused;
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

/**
 * KaTeX's message for an expression that does not render, or nothing for one that does (the empty
 * expression renders), or `{refused}` for one the scan refuses, which KaTeX never sees. For tests in
 * Bun, which has no DOM: `renderToString` only tells whether KaTeX throws, and its markup is never
 * used.
 */
export const parseProblem = (
  expression: string,
): string | { readonly refused: Refused } | undefined => {
  const refused = refusalOf(expression);
  if (refused !== undefined) return { refused };
  try {
    katex.renderToString(expression, renderOptions());
    return undefined;
  } catch (error) {
    return messageOf(error);
  }
};

/**
 * Draws `expression` into `element`, replacing its content, and says what went wrong, if anything:
 * an expression the scan refuses is not given to KaTeX; otherwise `katex.render` builds the nodes
 * in a `span` that is never attached to the page, and only on success its children replace the
 * element's (`katex.render` empties its target before it parses, which would lose the last render
 * on a parse error). Every error is caught, a `ParseError` and a browser's `RangeError` on a deep
 * nest alike, and a failure of any kind leaves the element as it was.
 */
export const renderInto = (element: HTMLElement, expression: string): Rendered => {
  const refused = refusalOf(expression);
  if (refused !== undefined) return { refused };
  try {
    const scratch = element.ownerDocument.createElement("span");
    katex.render(expression, scratch, renderOptions());
    element.replaceChildren(...Array.from(scratch.childNodes));
    return {};
  } catch (error) {
    return { error: messageOf(error) };
  }
};
