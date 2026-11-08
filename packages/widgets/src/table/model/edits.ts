// The Table's edits (table-widget, design decisions 9 and 10; view-and-widgets spec: Adding and
// deleting rows): a cell set, a row added, a row deleted, each giving a new frozen value and leaving
// its input as it was. The model builds no `changes` (AD-20): the contract's diff does, from the
// edited value. Rows are found by position in the list, and a row is rebuilt from its own entries,
// so an ID or a field named `__proto__` or `constructor` is only data. A refusal is a code the
// component words (`table.maxRows`) and says beside the toolbar.

import {
  TABLE_MAX_ROWS,
  type TableCellValue,
  type TableProps,
  type TableRow,
} from "@askboard/contract";
import { nextViewId } from "../../shared/ids.ts";
import { isInputColumn } from "./columns.ts";

/** Where a row is added: before every row, after every row, or after the row with this ID. */
export type RowPlace = "first" | "last" | { readonly after: string };

export type AddRefusal = "maxRows" | "fixed";

export type Added =
  | { readonly kind: "added"; readonly value: TableProps; readonly rowId: string }
  | { readonly kind: "refused"; readonly code: AddRefusal };

export type Deleted =
  | {
      readonly kind: "deleted";
      readonly value: TableProps;
      /** The row that becomes current: the one after the deleted row, else the one before. */
      readonly current: string | undefined;
    }
  | { readonly kind: "refused"; readonly code: "fixed" | "noRow" };

/** A Table the agent fixed the rows of: its user edits cells and adds and deletes none. */
export const fixedRows = (value: TableProps): boolean => value.fixedRows === true;

const withRows = (value: TableProps, rows: readonly TableRow[]): TableProps =>
  Object.freeze({ ...value, rows: Object.freeze(rows) });

const frozenRow = (entries: readonly (readonly [string, TableCellValue])[]): TableRow =>
  Object.freeze(Object.fromEntries(entries)) as TableRow;

/**
 * The value with the cell of `rowId`'s `field` set to `cell`, or emptied when `cell` is undefined.
 * The value itself comes back when nothing changes: an unknown row, a field that is no input
 * column's, `id`, or the same value.
 */
export const setCell = (
  value: TableProps,
  rowId: string,
  field: string,
  cell: TableCellValue | undefined,
): TableProps => {
  const index = value.rows.findIndex((row) => row.id === rowId);
  const row = value.rows[index];
  const column = value.columns.find((candidate) => candidate.field === field);
  if (row === undefined || column === undefined || !isInputColumn(column)) return value;
  const held = Object.hasOwn(row, field) ? row[field] : undefined;
  if (held === cell) return value;
  const kept = Object.entries(row).filter(([key]) => key !== field);
  const entries = cell === undefined ? kept : [...kept, [field, cell] as const];
  const next = value.rows.map((candidate, at) => (at === index ? frozenRow(entries) : candidate));
  return withRows(value, next);
};

const placeAt = (rows: readonly TableRow[], place: RowPlace): number => {
  if (place === "first") return 0;
  if (place === "last") return rows.length;
  const index = rows.findIndex((row) => row.id === place.after);
  return index < 0 ? rows.length : index + 1;
};

/**
 * The value with an empty row, `u-<n>` from `nextViewId`, at `place`; refused at `TABLE_MAX_ROWS`
 * and in a Table with fixed rows.
 */
export const addRow = (value: TableProps, place: RowPlace): Added => {
  if (fixedRows(value)) return { kind: "refused", code: "fixed" };
  if (value.rows.length >= TABLE_MAX_ROWS) return { kind: "refused", code: "maxRows" };
  const rowId = nextViewId(value.rows.map((row) => row.id));
  const at = placeAt(value.rows, place);
  const rows = [...value.rows.slice(0, at), frozenRow([["id", rowId]]), ...value.rows.slice(at)];
  return { kind: "added", value: withRows(value, rows), rowId };
};

/**
 * The value without the row `rowId`, and the row that becomes current; refused for a row the Table
 * does not hold and in a Table with fixed rows.
 */
export const deleteRow = (value: TableProps, rowId: string): Deleted => {
  if (fixedRows(value)) return { kind: "refused", code: "fixed" };
  const index = value.rows.findIndex((row) => row.id === rowId);
  if (index < 0) return { kind: "refused", code: "noRow" };
  const rows = value.rows.filter((_, at) => at !== index);
  const current = (rows[index] ?? rows[index - 1])?.id;
  return { kind: "deleted", value: withRows(value, rows), current };
};
