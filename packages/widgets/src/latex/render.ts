// How the LaTeX draws its preview (latex-kanban-timeline, design decision 7; AD-8, NFR-5, NFR-9).
// The expression is agent or user text and is drawn as data: KaTeX builds nodes through the DOM
// API and its CSSOM (the page's policy allows no markup string with styles in it), trusts no
// command (so `\href`, `\url`, `\includegraphics` and the `\html...` family show as the plain text
// of their name, with no link, image, class, ID, style or data attribute from the expression),
// expands a macro at most 1,000 times, and starts every render with an empty macro table, so that
// `\gdef` never outlives its render.

import katex, { type KatexOptions } from "katex";

/** What `renderInto` gives back: KaTeX's message, or a fixed text for anything but an `Error`. */
export type Rendered = { readonly error?: string };

/** The text shown for a thrown value that is no `Error`. */
const UNKNOWN_ERROR = "The expression could not be drawn.";

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
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : UNKNOWN_ERROR;

/**
 * KaTeX's message for an expression that does not render, or nothing for one that does (the empty
 * expression renders). For tests in Bun, which has no DOM: it builds markup that nothing ever puts
 * into a page.
 */
export const parseProblem = (expression: string): string | undefined => {
  try {
    katex.renderToString(expression, renderOptions());
    return undefined;
  } catch (error) {
    return messageOf(error);
  }
};

/**
 * Draws `expression` into `element`, replacing its content, and says what went wrong, if
 * anything: every error is caught, a `ParseError` and a browser's `RangeError` on a deep nest alike.
 * `katex.render` empties its target before it parses, so it draws into a node of the element's
 * document first: an expression that fails leaves what the element held.
 */
export const renderInto = (element: HTMLElement, expression: string): Rendered => {
  try {
    const scratch = element.ownerDocument.createElement("span");
    katex.render(expression, scratch, renderOptions());
    element.replaceChildren(...Array.from(scratch.childNodes));
    return {};
  } catch (error) {
    return { error: messageOf(error) };
  }
};
