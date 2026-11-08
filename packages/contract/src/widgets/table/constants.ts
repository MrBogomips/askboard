// The Table's constants and types (table-widget, design decision 2): its limits, the pattern of a
// column's field, the schemas' IDs and the shapes of an item, its columns and its rows. Plain
// ECMAScript with no JSON import, so that the Table's chunk can bundle what it reads from here.
// Each frozen constant is marked pure, so that a view chunk drops those it does not use.

/** A Table holds at most this many rows (design decision 13: lowered only through `/opsx:update`). */
export const TABLE_MAX_ROWS = 200;
/** A Table holds at least this many columns, and at most `TABLE_MAX_COLUMNS`. */
export const TABLE_MIN_COLUMNS = 1;
export const TABLE_MAX_COLUMNS = 10;
/** A text cell, and a text column's `maxLength`, hold at most this many code points. */
export const TABLE_TEXT_MAX_CHARS = 500;
/** A column's formula holds at most this many characters. */
export const TABLE_FORMULA_MAX_CHARS = 500;

/**
 * A column's field: one of AD-13's reference segments that compute reads as a field name, never as
 * a cell (cells are upper case), and never the row's own `id`.
 */
export const TABLE_FIELD_PATTERN = "^(?!id$)[a-z][A-Za-z0-9]{0,63}$";

export const TABLE_COLUMN_TYPES = /* @__PURE__ */ Object.freeze([
  "text",
  "number",
  "money",
  "date",
  "toggle",
] as const);

export type TableColumnType = (typeof TABLE_COLUMN_TYPES)[number];

/** Whose value a Table is: the agent's props (the view's ID prefix refused) or the user's edit. */
export type TableOrigin = "agent" | "edited";

export const TABLE_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:table-props",
  changes: "urn:askboard:output:table-changes",
} as const);

/** A column of any type: its field, its label, its type, and the keys its type takes. */
export type TableColumn = {
  readonly field: string;
  readonly label: string;
  readonly type: TableColumnType;
  /** A computed column, read-only: number, money and date only. */
  readonly formula?: string;
  /** A total of the column over the rows: number and money only. */
  readonly total?: "sum";
  /** A text column: at most this many code points, `TABLE_TEXT_MAX_CHARS` when absent. */
  readonly maxLength?: number;
  /** A number column: a number; a money column: a decimal string; a date column: a full-date. */
  readonly min?: number | string;
  readonly max?: number | string;
  readonly step?: number;
  readonly integer?: boolean;
  readonly unit?: string;
  /** A money column: its currency, an ISO 4217 code. */
  readonly currency?: string;
};

/** A cell's value: a string (text, a money amount, a date), a number or a boolean; absent when empty. */
export type TableCellValue = string | number | boolean;

/** A row: its ID and a value for each input column that has one. */
export type TableRow = {
  readonly id: string;
  readonly [field: string]: TableCellValue;
};

export type TableProps = {
  readonly label?: string;
  readonly fixedRows?: true;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
};

export type TableItem = {
  readonly type: "table";
  readonly id: string;
  readonly props: TableProps;
};
