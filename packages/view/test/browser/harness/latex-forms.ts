// The LaTeX forms task 4.15 measured beyond task 4.10's seventeen constructs (latex-kanban-timeline,
// design decision 7, Measuring), kept as fixed families (latex-public-api, task 3.1): the infix
// forms, the hidden-opener forms, environments and a style-wrapped form. Each nest is a
// `Construct` of `latex-fixtures.ts`. No browser here, and no reading of KaTeX's script.

import { type Construct, construct } from "./latex-fixtures.ts";

/** The infix forms: an infix inside a level adds a level of the scan's count (task 4.13). */
export const INFIX_CONSTRUCTS: readonly Construct[] = [
  construct("\\frac{ \\over y}{x}", "\\frac{", "\\over y}{x}", 2),
  construct("\\frac{ \\atop y}{x}", "\\frac{", "\\atop y}{x}", 2),
  construct("\\frac{ \\above1pt y}{x}", "\\frac{", "\\above1pt y}{x}", 2),
  construct("{ \\choose x}", "{", "\\choose x}", 2),
  construct("{ \\brace x}", "{", "\\brace x}", 2),
  construct("{ \\brack x}", "{", "\\brack x}", 2),
  construct("\\boxed{ \\over y}", "\\boxed{", "\\over y}", 2),
  construct("\\sqrt{ \\over y}", "\\sqrt{", "\\over y}", 2),
  construct("\\left( \\over y\\right)", "\\left(", "\\over y\\right)", 2),
];

/**
 * The openers a character code or `\show` hides from a reader that takes the next token (task 4.13).
 * The scan refuses both commands since task 4.21; the bounds scenarios still send them, to see the
 * refusal.
 */
export const HIDDEN_CONSTRUCTS: readonly Construct[] = [
  construct("\\char` { \\over}", "\\char` {", "\\over}", 2),
  construct("\\char`<LF>{ \\over}", "\\char`\n{", "\\over}", 2),
  construct("\\show%<LF> { \\over}", "\\show%\n {", "\\over}", 2),
];

/** The environments of the realistic set, a cell holding the next level. */
export const ENVIRONMENT_CONSTRUCTS: readonly Construct[] = [
  construct("\\begin{matrix}", "\\begin{matrix}", "\\end{matrix}"),
  construct("\\begin{pmatrix}", "\\begin{pmatrix}", "\\end{pmatrix}"),
  construct("\\begin{array}{c}", "\\begin{array}{c}", "\\end{array}", 1, 1),
  construct("\\begin{aligned}", "\\begin{aligned}", "\\end{aligned}"),
  construct("\\begin{cases}", "\\begin{cases}", "\\end{cases}"),
];

/** Free style commands wrapped around each level (the review's form). */
export const STYLE_CONSTRUCTS: readonly Construct[] = [
  construct(
    "\\frac{\\displaystyle\\color{red}\\Huge }{x}",
    "\\frac{\\displaystyle\\color{red}\\Huge ",
    "}{x}",
    1,
    1,
  ),
];

/** Task 4.15's constructs that are not control words, after task 4.10's seventeen. */
export const EXTRA_CONSTRUCTS: readonly Construct[] = [
  ...INFIX_CONSTRUCTS,
  ...HIDDEN_CONSTRUCTS,
  ...ENVIRONMENT_CONSTRUCTS,
  ...STYLE_CONSTRUCTS,
];
