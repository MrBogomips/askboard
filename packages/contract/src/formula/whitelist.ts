// The formula whitelist (AD-13), as the formula spike decided it on 2026-10-30 (findings,
// Proposed outcomes, row 2): what the built-in derived fields need, plus `^`, `ROUND` and all six
// comparisons. `compute` holds fixtures with Excel's values for each entry. No other function or
// operator runs; `OR`, `NOT`, `ABS`, `CEILING`, `AVERAGE`, `COUNT` and `NETWORKDAYS` were dropped.

import type { BinaryOperator } from "./grammar.ts";

export type FunctionName =
  | "SUM"
  | "MIN"
  | "MAX"
  | "IF"
  | "ROUND"
  | "AND"
  | "SQRT"
  | "SUMSQ"
  | "SUMPRODUCT"
  | "ROUNDUP"
  | "WORKDAY";

export type FormulaFunction = {
  readonly name: FunctionName;
  /** The least and greatest number of arguments, as in Excel. */
  readonly minArgs: number;
  readonly maxArgs: number;
  /** Excel's semantics, as the fixtures hold them. */
  readonly excel: string;
  /** The derived field that needs it, or why it is listed. */
  readonly neededBy: string;
};

export type FormulaOperator = {
  readonly symbol: BinaryOperator;
  readonly arity: "binary" | "unary";
  readonly excel: string;
  readonly neededBy: string;
};

/** Excel's limit on a function's arguments. */
const MANY = 255;

export const FORMULA_FUNCTIONS: readonly FormulaFunction[] = Object.freeze(
  (
    [
      {
        name: "SUM",
        minArgs: 1,
        maxArgs: MANY,
        excel:
          "Sum; booleans and text inside references are ignored, typed directly they are converted",
        neededBy: "WBS parent expected, sales totals, decision-matrix weight total",
      },
      {
        name: "MIN",
        minArgs: 1,
        maxArgs: MANY,
        excel: "Minimum of the numbers; no numbers gives 0",
        neededBy: "Gantt latest finish (backward pass)",
      },
      {
        name: "MAX",
        minArgs: 1,
        maxArgs: MANY,
        excel: "Maximum of the numbers; no numbers gives 0",
        neededBy: "Gantt duration floor, earliest start (forward pass), finish, best score",
      },
      {
        name: "IF",
        minArgs: 2,
        maxArgs: 3,
        excel:
          "Lazy: only the chosen branch is evaluated; no else gives FALSE; an empty result reads 0",
        neededBy: "Sales optional line (included or 0)",
      },
      {
        name: "ROUND",
        minArgs: 2,
        maxArgs: 2,
        excel:
          "Half away from zero on the decimal value at 15 significant digits: ROUND(2.675,2) = 2.68, ROUND(-2.5,0) = -3",
        neededBy: "AD-13's interim set; molecules and agent formulas use it",
      },
      {
        name: "AND",
        minArgs: 1,
        maxArgs: MANY,
        excel:
          "Logical and over every argument, errors first; text and empty inside references are ignored; no logical value is #VALUE!",
        neededBy: "Sales belowMinimum (a minimum is set and the margin is below it)",
      },
      {
        name: "SQRT",
        minArgs: 1,
        maxArgs: 1,
        excel: "Square root; a negative argument is #NUM!",
        neededBy: "WBS parent spread (root-sum-square)",
      },
      {
        name: "SUMSQ",
        minArgs: 1,
        maxArgs: MANY,
        excel: "Sum of squares, with SUM's argument rules",
        neededBy: "WBS parent spread (root-sum-square)",
      },
      {
        name: "SUMPRODUCT",
        minArgs: 1,
        maxArgs: MANY,
        excel:
          "Sum of element-wise products; lists of different length are #VALUE!; non-numbers count as 0",
        neededBy: "Decision-matrix score",
      },
      {
        name: "ROUNDUP",
        minArgs: 2,
        maxArgs: 2,
        excel: "Away from zero, on the value at 15 significant digits: ROUNDUP((0.1+0.2)*10,0) = 3",
        neededBy: "Gantt duration (expected effort rounded up to whole days)",
      },
      {
        name: "WORKDAY",
        minArgs: 2,
        maxArgs: 2,
        excel:
          "A date plus n working days, Monday to Friday, no holidays; n truncated; WORKDAY(d,0) = d even on a weekend",
        neededBy: "Gantt first working day, start and finish dates",
      },
    ] satisfies FormulaFunction[]
  ).map((entry) => Object.freeze(entry)),
);

export const FORMULA_OPERATORS: readonly FormulaOperator[] = Object.freeze(
  (
    [
      {
        symbol: "+",
        arity: "binary",
        excel:
          "Addition; booleans count as 1 and 0, empty as 0, numeric text is converted, other text is #VALUE!",
        neededBy: "WBS expected (PERT), Gantt earliest finish",
      },
      {
        symbol: "-",
        arity: "binary",
        excel: "Subtraction",
        neededBy: "WBS spread, Gantt latest start and slack, sales margin",
      },
      {
        symbol: "-",
        arity: "unary",
        excel: "Negation; binds tighter than ^ (-2^2 = 4)",
        neededBy: "Agent formulas; Excel's unary minus",
      },
      {
        symbol: "*",
        arity: "binary",
        excel: "Multiplication",
        neededBy: "PERT 4*mostLikely, sales cost and revenue",
      },
      {
        symbol: "/",
        arity: "binary",
        excel: "Division; a zero or empty divisor is #DIV/0!",
        neededBy: "PERT /6, sales margin, decision-matrix score",
      },
      {
        symbol: "^",
        arity: "binary",
        excel: "Power, left-associative (2^3^2 = 64); 0^0 is #NUM!",
        neededBy: "AD-13's interim set",
      },
      {
        symbol: "=",
        arity: "binary",
        excel:
          'Equality; numbers at 15 significant digits, text case-insensitive, empty equals 0, "" and FALSE',
        neededBy: "Gantt critical (slack = 0)",
      },
      {
        symbol: "<>",
        arity: "binary",
        excel: "Inequality, as =",
        neededBy: "Sales belowMinimum (a minimum is set)",
      },
      {
        symbol: "<",
        arity: "binary",
        excel: "Less than; numbers < text < booleans; 1<2<3 is FALSE",
        neededBy: "Sales belowMinimum (margin below the minimum)",
      },
      {
        symbol: "<=",
        arity: "binary",
        excel: "Less than or equal, as <",
        neededBy: "One comparison group with = <> <",
      },
      {
        symbol: ">",
        arity: "binary",
        excel: "Greater than, as <",
        neededBy: "One comparison group with = <> <",
      },
      {
        symbol: ">=",
        arity: "binary",
        excel: "Greater than or equal, as <",
        neededBy: "One comparison group with = <> <",
      },
    ] satisfies FormulaOperator[]
  ).map((entry) => Object.freeze(entry)),
);

/** Excel operators no derived field needs: a formula using one is refused as not whitelisted. */
export const REFUSED_OPERATORS: readonly string[] = Object.freeze(["&", "%"]);
