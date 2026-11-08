// The formula grammar's terminals (AD-13): field names, spreadsheet cells and the binary
// operators' precedence. A reference is `[item.field]`, `[item.child.field]`, `[item.child.*.field]`,
// `[item.*.field]`, `[item.A1]` or `[item.A1:B3]`, with IDs as `ID_PATTERN`. `compute`'s lexer and
// parser follow these; patterns are strings, as in `constants.ts`.

/** A field name: a letter, then letters and digits. `isFieldName` also refuses cell-like names. */
export const FIELD_NAME_PATTERN = "^[A-Za-z][A-Za-z0-9]{0,63}$";

/** A spreadsheet cell, upper case only: column letters, then a row from 1 (`A1`). */
export const CELL_PATTERN = "^([A-Z]{1,3})([1-9][0-9]{0,6})$";

/** The last column, `XFD`, and the last row of a sheet, as in Excel. */
export const SHEET_MAX_COLUMN = 16_384;
export const SHEET_MAX_ROW = 1_048_576;

/** In a reference, a `*` stands for the children of the node before it, in document order. */
export const REFERENCE_WILDCARD = "*";

/**
 * In a formula on a child's field, a reference `[@field]` reads that field of the same child, as
 * Excel's this-row reference (table-widget, design decision 4). The prefix is no character of an
 * ID, a field name or a cell, so the form is never read as another; `compute`'s lexer reads it and
 * `referenceText` writes it back as `@field`.
 */
export const ROW_REFERENCE_PREFIX = "@";

export type BinaryOperator = "+" | "-" | "*" | "/" | "^" | "=" | "<>" | "<" | "<=" | ">" | ">=";

/**
 * Each binary operator's precedence, higher binding tighter: comparisons, then `+ -`, then `* /`,
 * then `^`. Every binary operator is left-associative (`2^3^2` is 64), and unary minus binds
 * tighter than `^` (`-2^2` is 4), as in Excel.
 */
export const BINARY_OPERATOR_PRECEDENCE: Readonly<Record<BinaryOperator, number>> = Object.freeze({
  "=": 1,
  "<>": 1,
  "<": 1,
  "<=": 1,
  ">": 1,
  ">=": 1,
  "+": 2,
  "-": 2,
  "*": 3,
  "/": 3,
  "^": 4,
});

const CELL = new RegExp(CELL_PATTERN);
const FIELD_NAME = new RegExp(FIELD_NAME_PATTERN);

const cellWithin = (match: RegExpExecArray | null): { column: number; row: number } | undefined => {
  if (match === null) return undefined;
  let column = 0;
  for (const letter of match[1] ?? "") column = column * 26 + letter.charCodeAt(0) - 64;
  const row = Number(match[2]);
  return column <= SHEET_MAX_COLUMN && row <= SHEET_MAX_ROW ? { column, row } : undefined;
};

/** A cell's column and row, both from 1, or undefined when the text is not a cell of the sheet. */
export const parseCell = (text: string): { column: number; row: number } | undefined =>
  cellWithin(CELL.exec(text));

/**
 * Whether a name may be a field: it matches `FIELD_NAME_PATTERN` and is no cell, so `[item.A1]` is
 * always a cell (AD-13). Cells are upper case: `a1` or `q1` may be a field.
 */
export const isFieldName = (name: string): boolean =>
  FIELD_NAME.test(name) && parseCell(name) === undefined;
