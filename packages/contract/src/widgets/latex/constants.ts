// The LaTeX's constants and types (latex-kanban-timeline, design decision 3): the limit of its
// expression, the schemas' IDs, its element shape and the shapes of an item and a change. Each
// frozen constant is marked pure, so that a view chunk drops those it does not use.

import type { FieldsShape } from "../element-diff.ts";

/** The longest expression, in characters; an expression may be empty. */
export const LATEX_EXPRESSION_MAX_CHARS = 2_000;

/**
 * The commands that define a macro, as KaTeX's documentation names them (Supported Functions) (group 4 review S-1, design decision
 * 7): its `def` functions `\def`, `\gdef`, `\edef`, `\xdef`, `\global`, `\long`, `\let` and
 * `\futurelet`, and its macros `\newcommand`, `\renewcommand` and `\providecommand`. A LaTeX
 * holds none: an expansion's limit counts expansions, not what they emit, so a macro repeating a
 * long body froze the board. KaTeX also defines macros by side effect (`\tag` defines `\df@tag`,
 * `\color` defines `\current@color`, with the author's text); their names hold `@`, KaTeX's internal
 * namespace, and the scan refuses every control word holding `@` as well (4.7 re-review X-1), so
 * this list is the definitions the author could write by name. A KaTeX upgrade re-reads its release
 * notes for a new defining command (latex-public-api, risks K-3).
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
 * a pair of delimiters, as KaTeX's documentation lists them.
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
 * The infix commands of KaTeX's documentation (Supported Functions, "Infix": design decision 3,
 * 4.12 re-review X-1): each makes a fraction of everything before it in its group, so the numerator nests one
 * level deeper with no brace, and the scan adds a level to the group that holds one.
 */
export const LATEX_INFIX_COMMANDS: readonly string[] = /* @__PURE__ */ Object.freeze([
  "\\over",
  "\\choose",
  "\\atop",
  "\\brace",
  "\\brack",
  "\\above",
]);

/**
 * The control words of KaTeX that read the next token raw, with what the check does about
 * it (design decision 3, 4.19 re-review X-1). `\show` and `\char` with a backquote take a token
 * whole, a `\verb|}|` included, which the scan does not read as KaTeX's lexer does: the check
 * refuses `refused` always and `refusedWithBackquote` when a backquote follows (an author writes
 * `\char"263A` or decimal digits instead, which read no token raw). `pushesBack` (`\noexpand` and
 * `\expandafter`) reads the token and puts it back, so it keeps its meaning. The other readers of
 * raw tokens are the refused definitions and the `@` names.
 */
export const LATEX_RAW_TOKEN_COMMANDS: Readonly<
  Record<string, "refused" | "refusedWithBackquote" | "pushesBack">
> = /* @__PURE__ */ Object.freeze({
  "\\char": "refusedWithBackquote",
  "\\show": "refused",
  "\\noexpand": "pushesBack",
  "\\expandafter": "pushesBack",
} as const);

/**
 * The deepest nest an expression may hold, in the levels the scan counts (design decisions 3 and 7).
 * It is the one bound on nesting, for the agent and the board alike (latex-public-api): the limit
 * comes from one measurement in Chromium and WebKit, at which every form the scan counts drew in
 * 211 ms or less, far under the depth at which a browser fails.
 */
export const LATEX_NESTING_MAX_DEPTH = 11;

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
