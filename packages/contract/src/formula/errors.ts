// What a node in formula error reads as, on the board and in the agent's warnings (AD-6, AD-13).
// AskBoard's own kinds: no engine's error codes cross a unit boundary.

export const FORMULA_ERROR_KINDS = Object.freeze([
  /** Outside the grammar, or a function given the wrong number of arguments. */
  "syntax",
  /** Over a limit of `limits.ts`. */
  "over-limit",
  /** A function or operator outside the whitelist. */
  "not-whitelisted",
  /** A node, child or item that does not exist, or a wildcard that matches no node. */
  "missing-reference",
  /** On a cycle of references, or reading one. */
  "cycle",
  /** Over amounts in more than one currency, or reading such a formula. */
  "mixed-currencies",
  /** A value of the wrong kind or out of range: Excel's #VALUE! and #NUM!. */
  "value",
  /** Excel's #DIV/0!. */
  "division-by-zero",
] as const);

export type FormulaErrorKind = (typeof FORMULA_ERROR_KINDS)[number];
