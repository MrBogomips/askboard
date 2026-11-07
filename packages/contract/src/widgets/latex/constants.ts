// The LaTeX's constants and types (latex-kanban-timeline, design decision 3): the limit of its
// expression, the schemas' IDs, its element shape and the shapes of an item and a change. Each
// frozen constant is marked pure, so that a view chunk drops those it does not use.

import type { FieldsShape } from "../element-diff.ts";

/** The longest expression, in characters; an expression may be empty. */
export const LATEX_EXPRESSION_MAX_CHARS = 2_000;

/**
 * The commands that define a macro, as KaTeX 0.19.1 names them (group 4 review S-1, design decision
 * 7): its `def` functions `\def`, `\gdef`, `\edef`, `\xdef`, `\global`, `\long`, `\let` and
 * `\futurelet`, and its macros `\newcommand`, `\renewcommand` and `\providecommand`. A LaTeX
 * holds none: an expansion's limit counts expansions, not what they emit, so a macro repeating a
 * long body froze the board. A KaTeX upgrade re-reads this list (the widgets' render test pins it).
 */
export const LATEX_DEFINING_COMMANDS: readonly string[] = /* @__PURE__ */ Object.freeze([
  "\\def",
  "\\gdef",
  "\\edef",
  "\\xdef",
  "\\global",
  "\\long",
  "\\let",
  "\\futurelet",
  "\\newcommand",
  "\\renewcommand",
  "\\providecommand",
]);

export const LATEX_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:latex-props",
  changes: "urn:askboard:output:latex-changes",
} as const);

/**
 * The LaTeX's shape for the one generic diff (AD-20): its one field, changed as a whole, so that a
 * correction is one `set` of `<item>.expression`.
 */
export const LATEX_SHAPE: FieldsShape = /* @__PURE__ */ Object.freeze({
  fields: /* @__PURE__ */ Object.freeze(["expression"]),
});

export type LatexProps = { readonly expression: string };

export type LatexItem = {
  readonly type: "latex";
  readonly id: string;
  readonly props: LatexProps;
};

/** A LaTeX's only change: the whole expression as the user wrote it. */
export type LatexChange = {
  readonly op: "set";
  /** `<item>.expression`. */
  readonly target: string;
  readonly value: string;
};
