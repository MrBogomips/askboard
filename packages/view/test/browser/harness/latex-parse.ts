// Whether KaTeX parses an expression, decided in Bun through the widgets' own `parseProblem` (the
// public API only), before the act under test draws it (latex-public-api, review S-4). The view
// package does not depend on the widgets, so the module is read by its path, as the frame's is.

import { LATEX_SOURCES } from "./latex-sources.ts";

type Problem = string | { readonly refused: unknown } | undefined;

const widgets = (await import(LATEX_SOURCES.render)) as {
  parseProblem: (expression: string) => Problem;
};

/** True when KaTeX throws for `expression` (a refusal by the scan is not a parse failure). */
export const unparsed = (expression: string): boolean =>
  typeof widgets.parseProblem(expression) === "string";
