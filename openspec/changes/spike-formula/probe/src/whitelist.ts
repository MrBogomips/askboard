// The candidate whitelist (design decision 3). AD-13's interim set plus what a molecule's
// derived field needs; every addition names that field, and a candidate no field needs is
// kept only to be measured, marked `neededBy: null`, and proposed for removal.

export interface WhitelistEntry {
  readonly name: string;
  readonly kind: "function" | "operator";
  /** In AD-13's interim set (arithmetic, SUM, MIN, MAX, IF, ROUND). */
  readonly interim: boolean;
  /** The derived field that needs it, or null when no field does. */
  readonly neededBy: string | null;
  readonly excel: string;
}

export const CANDIDATES: readonly WhitelistEntry[] = Object.freeze([
  { name: "+", kind: "operator", interim: true, neededBy: "WBS expected (PERT), Gantt EF", excel: "Addition; booleans count as 1/0, empty as 0, numeric text is converted, other text is #VALUE!" },
  { name: "-", kind: "operator", interim: true, neededBy: "WBS spread, Gantt LS and slack, sales margin", excel: "Subtraction, and unary negation, which binds tighter than ^ (-2^2 = 4)" },
  { name: "*", kind: "operator", interim: true, neededBy: "PERT 4*mostLikely, sales cost and revenue", excel: "Multiplication" },
  { name: "/", kind: "operator", interim: true, neededBy: "PERT /6, sales margin, decision-matrix score", excel: "Division; a zero divisor is #DIV/0!" },
  { name: "^", kind: "operator", interim: true, neededBy: null, excel: "Power, left-associative (2^3^2 = 64); 0^0 is #NUM!" },
  { name: "=", kind: "operator", interim: false, neededBy: "Gantt critical (slack = 0)", excel: "Equality; numbers compared at 15 significant digits, text case-insensitive" },
  { name: "<>", kind: "operator", interim: false, neededBy: "sales belowMinimum (a minimum is set)", excel: "Inequality" },
  { name: "<", kind: "operator", interim: false, neededBy: "sales belowMinimum (margin < minimum)", excel: "Less than; numbers < text < booleans" },
  { name: "<=", kind: "operator", interim: false, neededBy: null, excel: "Less than or equal" },
  { name: ">", kind: "operator", interim: false, neededBy: null, excel: "Greater than" },
  { name: ">=", kind: "operator", interim: false, neededBy: null, excel: "Greater than or equal" },
  { name: "SUM", kind: "function", interim: true, neededBy: "WBS parent expected, sales totals, decision-matrix weight total", excel: "Sum; booleans and text inside references are ignored, typed directly they are converted" },
  { name: "MIN", kind: "function", interim: true, neededBy: "Gantt LF (backward pass)", excel: "Minimum; no numbers gives 0" },
  { name: "MAX", kind: "function", interim: true, neededBy: "Gantt duration floor, ES (forward pass), project finish, best score", excel: "Maximum; no numbers gives 0" },
  { name: "IF", kind: "function", interim: true, neededBy: "sales optional line (included or 0)", excel: "Lazy: only the chosen branch is evaluated; no else gives FALSE" },
  { name: "ROUND", kind: "function", interim: true, neededBy: null, excel: "Half away from zero on the decimal value (ROUND(2.675,2) = 2.68, ROUND(-2.5,0) = -3)" },
  { name: "AND", kind: "function", interim: false, neededBy: "sales belowMinimum (minimum set and margin below it)", excel: "Logical and; text and empty inside references are ignored" },
  { name: "OR", kind: "function", interim: false, neededBy: null, excel: "Logical or" },
  { name: "NOT", kind: "function", interim: false, neededBy: null, excel: "Logical not" },
  { name: "ABS", kind: "function", interim: false, neededBy: null, excel: "Absolute value" },
  { name: "SQRT", kind: "function", interim: false, neededBy: "WBS parent spread (root-sum-square)", excel: "Square root; a negative argument is #NUM!" },
  { name: "SUMSQ", kind: "function", interim: false, neededBy: "WBS parent spread (root-sum-square)", excel: "Sum of squares, same argument rules as SUM" },
  { name: "SUMPRODUCT", kind: "function", interim: false, neededBy: "decision-matrix score", excel: "Sum of element-wise products; lists of different length are #VALUE!; non-numbers count as 0" },
  { name: "ROUNDUP", kind: "function", interim: false, neededBy: "Gantt duration (expected effort rounded up to whole days)", excel: "Away from zero, on the value at 15 significant digits" },
  { name: "CEILING", kind: "function", interim: false, neededBy: null, excel: "Up to a multiple of significance; positive number with negative significance is #NUM!" },
  { name: "AVERAGE", kind: "function", interim: false, neededBy: null, excel: "Mean of the numbers; none is #DIV/0!" },
  { name: "COUNT", kind: "function", interim: false, neededBy: null, excel: "Count of numbers" },
  { name: "WORKDAY", kind: "function", interim: false, neededBy: "Gantt first working day, start and finish dates", excel: "Date plus n working days (Monday to Friday, no holidays); n truncated; WORKDAY(d,0) = d even on a weekend" },
  { name: "NETWORKDAYS", kind: "function", interim: false, neededBy: null, excel: "Working days between two dates, both included; negative when the end is earlier" },
] satisfies WhitelistEntry[]);

/** Functions the probe accepts: every candidate, so each can be measured. */
export const FUNCTIONS: ReadonlySet<string> = new Set(
  CANDIDATES.filter((entry) => entry.kind === "function").map((entry) => entry.name),
);

/** Operators outside the grammar: Excel has them, no derived field needs them. */
export const REFUSED_OPERATORS: ReadonlySet<string> = new Set(["&", "%"]);

/** Excel's limits, applied before any engine parses (8,192 characters; nesting modelled on its 64 levels). */
export const LIMITS = Object.freeze({ maxLength: 8192, maxDepth: 64 });
