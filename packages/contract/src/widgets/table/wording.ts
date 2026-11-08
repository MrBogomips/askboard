// How a request's wording reads a Table's props (table-widget, design decision 2): the expected
// shape and the field list of each of its objects, keyed `table.props.columns[].min`, how a path
// folds into such a key (a row's cell field is `{field}`) and which column or row a path is in.
// Nothing here validates.

import { isRecord, type Segments } from "../../problems.ts";
import { ATOM_LABEL_MAX_CHARS, ATOM_UNIT_MAX_CHARS } from "../shared/atoms.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import {
  TABLE_FIELD_PATTERN,
  TABLE_FORMULA_MAX_CHARS,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  TABLE_MIN_COLUMNS,
  TABLE_TEXT_MAX_CHARS,
} from "./constants.ts";

const DECIMAL = "a decimal string of at most 15 integer digits and 4 decimals, as in 1040.00";

export const TABLE_EXPECTED: Readonly<Record<string, string>> = {
  "table.props": "a Table's props {columns, rows, label?, fixedRows?}",
  "table.props.label": `${text(ATOM_LABEL_MAX_CHARS)}, the grid's caption`,
  "table.props.fixedRows":
    "true, to keep the rows the agent sent: the user edits their cells but adds and deletes none",
  "table.props.columns": `a list of ${TABLE_MIN_COLUMNS} to ${TABLE_MAX_COLUMNS} columns, each {field, label, type, and the keys of its type}`,
  "table.props.columns[]":
    "a column {field, label, type, formula?, total?, and the keys of its type}",
  "table.props.columns[].field": `a field name matching ${TABLE_FIELD_PATTERN}, never id, unique among the columns`,
  "table.props.columns[].label": text(ATOM_LABEL_MAX_CHARS),
  "table.props.columns[].type": '"text", "number", "money", "date" or "toggle"',
  "table.props.columns[].formula": `text of 1 to ${TABLE_FORMULA_MAX_CHARS} characters, for a number, money or date column: [@field] reads a field of the same row`,
  "table.props.columns[].total": '"sum", for a number or money column',
  "table.props.columns[].maxLength": `a whole number from 1 to ${TABLE_TEXT_MAX_CHARS}, for a text column`,
  "table.props.columns[].min":
    "the lowest value: a number for a number column, a decimal string for a money column, a full-date for a date column",
  "table.props.columns[].max":
    "the highest value, not below min: a number for a number column, a decimal string for a money column, a full-date for a date column",
  "table.props.columns[].step": "a number above 0, for a number column",
  "table.props.columns[].integer": "true or false, for a number column",
  "table.props.columns[].unit": `${text(ATOM_UNIT_MAX_CHARS)}, for a number column`,
  "table.props.columns[].currency": `an ISO 4217 code of three capital letters, as in USD, for a money column, which has one (${DECIMAL} in each cell)`,
  "table.props.rows": `a list of at most ${TABLE_MAX_ROWS} rows, each {id, and a value for each input column that has one}`,
  "table.props.rows[]": "a row {id, and a value for each input column that has one}",
  "table.props.rows[].id": `${ID_SHAPE}, unique among the Table's rows`,
  "table.props.rows[].{field}": `a value for the field of an input column: text of 1 to ${TABLE_TEXT_MAX_CHARS} characters for a text column, a number for a number column, a decimal string for a money column, a full-date for a date column, true or false for a toggle column`,
};

export const TABLE_FIELDS: Readonly<Record<string, string>> = {
  "table.props": "a Table's props hold only columns, rows, label and fixedRows",
  "table.props.columns[]":
    "a column holds only field, label, type, formula, total and the keys of its type: maxLength, min, max, step, integer, unit and currency",
  "table.props.rows[]": "a row holds only id and the fields its input columns declare",
};

/** A path from a Table item with a row's cell field folded into `{field}`. */
export const tableRest = (rest: Segments): Segments => {
  if (rest[1] !== "rows" || !isIndex(rest[2])) return rest;
  const [field] = rest.slice(3);
  return field !== undefined && field !== "id" && !isIndex(field)
    ? [...rest.slice(0, 3), "{field}"]
    : rest;
};

/** The column or row a path from a Table item is in, worded `column "rate"` or `row "pm"`. */
export const tableElementOf = (item: unknown, rest: Segments): string | undefined => {
  const key = rest[1];
  if (!isRecord(item) || (key !== "columns" && key !== "rows") || !isIndex(rest[2])) {
    return undefined;
  }
  const list = isRecord(item.props) ? item.props[key] : undefined;
  const element: unknown = Array.isArray(list) ? list[Number(rest[2])] : undefined;
  const name = isRecord(element) ? element[key === "columns" ? "field" : "id"] : undefined;
  return typeof name === "string" ? `${key === "columns" ? "column" : "row"} "${name}"` : undefined;
};
