// What the Table's column checks and its cell check share (table-widget, design decision 3): the
// keys of a column's input atom, the projection of a column onto them, and the JSON Pointer a
// problem is at. A leaf module of `table/`: plain ECMAScript with no JSON and no Ajv.

import { TABLE_COLUMN_TYPES, type TableColumnType } from "./constants.ts";

export type Json = Record<string, unknown>;

/** A column the Table's checks found sound, with its type. */
export type TableColumnEntry = Json & { readonly type: TableColumnType };

/**
 * What a Table's columns come to for the rows' checks: the sound columns by field, and every field
 * a column declared, sound or not, so that a row's value for a refused column is not refused twice.
 */
export type TableColumns = {
  readonly byField: ReadonlyMap<string, TableColumnEntry>;
  readonly declared: ReadonlySet<string>;
};

/** A column's own keys, which no input atom reads; every other key belongs to its type's atom. */
export const COLUMN_KEYS: ReadonlySet<string> = new Set([
  "field",
  "label",
  "type",
  "formula",
  "total",
]);

/** The keys of a column's input atom that a Table column takes, by type. */
export const ATOM_KEYS: Readonly<Record<TableColumnType, readonly string[]>> = {
  text: ["maxLength"],
  number: ["min", "max", "step", "integer", "unit"],
  money: ["currency", "min", "max"],
  date: ["min", "max"],
  toggle: [],
};

export const isColumnType = (type: unknown): type is TableColumnType =>
  typeof type === "string" && (TABLE_COLUMN_TYPES as readonly string[]).includes(type);

/** A JSON Pointer to `parts`. */
export const pointer = (...parts: readonly (string | number)[]): string =>
  parts.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

/** The props of the column's input atom: its label and the keys its type takes, those present. */
export const projectionOf = (column: Json, type: TableColumnType): Json => {
  const keys = ["label", ...ATOM_KEYS[type]].filter((key) => Object.hasOwn(column, key));
  return Object.fromEntries(
    keys
      .map((key): [string, unknown] => [key, column[key]])
      .filter(([, value]) => value !== undefined),
  );
};
