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
 * long body froze the board. KaTeX also defines macros by side effect (`\tag` defines `\df@tag`,
 * `\color` defines `\current@color`, with the author's text); their names hold `@`, KaTeX's internal
 * namespace, and the scan refuses every control word holding `@` as well (4.7 re-review X-1), so
 * this list is the definitions the author could write by name. A KaTeX upgrade re-reads this list
 * (the widgets' render test pins it and reads the side-effect definitions in KaTeX's source).
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

/**
 * The control words that open a level in the scan's depth, as KaTeX nests them (design decision 3):
 * `\bgroup` expands to `{`, `\begingroup` and `{` open a group, `\begin` an environment and `\left`
 * a pair of delimiters. The widgets' render test checks that no other KaTeX macro has a body whose
 * braces do not balance.
 */
export const LATEX_LEVEL_OPENERS: readonly string[] = /* @__PURE__ */ Object.freeze([
  "\\bgroup",
  "\\begingroup",
  "\\begin",
  "\\left",
]);

/** The control words that close a level, one each: the openers' counterparts. */
export const LATEX_LEVEL_CLOSERS: readonly string[] = /* @__PURE__ */ Object.freeze([
  "\\egroup",
  "\\endgroup",
  "\\end",
  "\\right",
]);

/**
 * The control words of KaTeX 0.19.1 that read the next token raw, with what they do to it: `consumes`
 * (`\char` and `\show` take it, so a brace after them closes nothing) or `pushesBack` (`\noexpand` and
 * `\expandafter` read it and put it back, so it keeps its meaning). The other readers of raw tokens
 * are the refused definitions and the `@` names (the widgets' render test checks the source).
 */
export const LATEX_RAW_TOKEN_COMMANDS: Readonly<Record<string, "consumes" | "pushesBack">> =
  /* @__PURE__ */ Object.freeze({
    "\\char": "consumes",
    "\\show": "consumes",
    "\\noexpand": "pushesBack",
    "\\expandafter": "pushesBack",
  } as const);

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
