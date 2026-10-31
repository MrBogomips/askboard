// Formula limits (AD-13, formula spike row 10). The graph checks them, with the grammar and the
// whitelist, before any engine runs; a formula over a limit is a formula error.

/** The longest formula, in UTF-16 code units: Excel's 8,192 characters. */
export const FORMULA_MAX_CHARS = 8_192;

/** The deepest nesting of parentheses, calls and runs of unary signs, modelled on Excel's 64. */
export const FORMULA_MAX_DEPTH = 64;

/** The most cells a range `[item.A1:B3]` may hold. */
export const RANGE_MAX_CELLS = 65_536;
