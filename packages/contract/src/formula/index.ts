// The formula language every unit reads (AD-13): grammar, whitelist, limits and error kinds.

export { FORMULA_ERROR_KINDS, type FormulaErrorKind } from "./errors.ts";
export {
  BINARY_OPERATOR_PRECEDENCE,
  type BinaryOperator,
  CELL_PATTERN,
  FIELD_NAME_PATTERN,
  isFieldName,
  parseCell,
  REFERENCE_WILDCARD,
  ROW_REFERENCE_PREFIX,
  SHEET_MAX_COLUMN,
  SHEET_MAX_ROW,
} from "./grammar.ts";
export { FORMULA_MAX_CHARS, FORMULA_MAX_DEPTH, RANGE_MAX_CELLS } from "./limits.ts";
export {
  FORMULA_FUNCTIONS,
  FORMULA_OPERATORS,
  type FormulaFunction,
  type FormulaOperator,
  type FunctionName,
  REFUSED_OPERATORS,
} from "./whitelist.ts";
