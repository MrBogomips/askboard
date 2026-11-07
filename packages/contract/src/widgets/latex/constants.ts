// The LaTeX's constants and types (latex-kanban-timeline, design decision 3): the limit of its
// expression, the schemas' IDs, its element shape and the shapes of an item and a change. Each
// frozen constant is marked pure, so that a view chunk drops those it does not use.

import type { FieldsShape } from "../element-diff.ts";

/** The longest expression, in characters; an expression may be empty. */
export const LATEX_EXPRESSION_MAX_CHARS = 2_000;

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
