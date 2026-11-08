// The Table's cells and rows (table-widget, design decisions 2 and 3): one check of a cell against
// its column, and the rows' rules, so that the agent's props, the user's edited value in `ask-core`
// and the board's cell reader give one verdict (AD-10, NFR-10). A cell is checked by its input
// atom's own result check over the projection of its column, after the cell's type.
//
// Plain ECMAScript with no JSON and no Ajv. Nothing here throws on a value it cannot read; rows
// and cells are found in `Map`s and `Set`s, so `__proto__` or `constructor` is only data.

import { ID_PATTERN, VIEW_ID_PREFIX } from "../../constants.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { dateFieldResultProblems, dateFieldResultShape } from "../date-field/checks.ts";
import { moneyFieldResultProblems, moneyFieldResultShape } from "../money-field/checks.ts";
import { numberFieldResultProblems, numberFieldResultShape } from "../number-field/checks.ts";
import { codePointCount } from "../shared/atoms.ts";
import { textFieldResultProblems, textFieldResultShape } from "../text-field/checks.ts";
import { TABLE_MAX_ROWS, TABLE_TEXT_MAX_CHARS, type TableOrigin } from "./constants.ts";
import { isColumnType, type Json, pointer, projectionOf, type TableColumns } from "./projection.ts";

const ID = new RegExp(ID_PATTERN);

const at = (message: string): readonly Problem[] => [{ path: "/", message }];

// The atom's result problems, flattened to the cell's own root.
const flat = (problems: readonly Problem[]): readonly Problem[] =>
  problems.map(({ message }) => ({ path: "/", message }));

/**
 * What is wrong with `value` as a cell of `column`, at the cell's root: the cell's own type (text a
 * string of 1 to its `maxLength` code points, `TABLE_TEXT_MAX_CHARS` when absent; a number; money a
 * decimal string in the column's currency; a date a full-date; a toggle a boolean), then its input
 * atom's own result check over the column's bounds. A column that is no column, or whose bounds
 * cannot be read, refuses every value, since nothing can check it. An empty cell has no value at
 * all: `null` and the empty text are refused.
 */
export const tableCellProblems = (value: unknown, column: unknown): readonly Problem[] => {
  if (!isRecord(column) || !isColumnType(column.type)) {
    return at("the column is no column of a Table, so its cell cannot be checked");
  }
  const props = projectionOf(column, column.type);
  switch (column.type) {
    case "text": {
      if (typeof value !== "string" || !textFieldResultShape(value)) {
        return at(`a text cell holds text of 1 to ${TABLE_TEXT_MAX_CHARS} characters`);
      }
      const limit = typeof props.maxLength === "number" ? props.maxLength : TABLE_TEXT_MAX_CHARS;
      if (codePointCount(value) > Math.min(limit, TABLE_TEXT_MAX_CHARS)) {
        return at(
          `the text has ${codePointCount(value)} characters, over the column's limit of ${Math.min(limit, TABLE_TEXT_MAX_CHARS)}`,
        );
      }
      return flat(textFieldResultProblems(value, props));
    }
    case "number":
      return typeof value === "number" && numberFieldResultShape(value)
        ? flat(numberFieldResultProblems(value, props))
        : at("a number cell holds a number within a quadrillion either way");
    case "money": {
      const result = { amount: value, currency: props.currency };
      return typeof value === "string" && moneyFieldResultShape(result)
        ? flat(moneyFieldResultProblems(result, props))
        : at("a money cell holds a decimal string of at most 15 integer digits and 4 decimals");
    }
    case "date":
      return typeof value === "string" && dateFieldResultShape(value)
        ? flat(dateFieldResultProblems(value, props))
        : at("a date cell holds a full-date, as in 2026-03-31");
    case "toggle":
      return typeof value === "boolean" ? [] : at("a toggle cell holds true or false");
  }
};

// A row's ID: a text of the ID pattern, unique in the item, and without the view's prefix when the
// agent sent it.
const idProblems = (
  id: unknown,
  index: number,
  seen: Set<string>,
  origin: TableOrigin,
): Problem[] => {
  const path = pointer("rows", index, "id");
  if (typeof id !== "string") return [{ path, message: "a row has no ID" }];
  const problems: Problem[] = [];
  if (!ID.test(id)) {
    problems.push({ path, message: `the ID ${JSON.stringify(id)} does not match ${ID_PATTERN}` });
  }
  if (seen.has(id))
    problems.push({ path, message: `the ID "${id}" is used by another row already` });
  seen.add(id);
  if (origin === "agent" && id.startsWith(VIEW_ID_PREFIX)) {
    problems.push({
      path,
      message: `the ID "${id}" starts with "${VIEW_ID_PREFIX}", which is reserved for IDs the board makes`,
    });
  }
  return problems;
};

// One row's keys: each is `id`, or the field of an input column with a value of its type.
const cellsProblems = (row: Json, index: number, columns: TableColumns): Problem[] => {
  const id = typeof row.id === "string" ? row.id : String(index);
  return Object.keys(row).flatMap((field): Problem[] => {
    if (field === "id") return [];
    const path = pointer("rows", index, field);
    const column = columns.byField.get(field);
    if (column === undefined) {
      return columns.declared.has(field)
        ? []
        : [
            {
              path,
              message: `the row "${id}" holds the field "${field}", which no column declares`,
            },
          ];
    }
    if (typeof column.formula === "string") {
      return [
        {
          path,
          message: `the row "${id}" holds the field "${field}", which its column computes by a formula: a row holds no value for it`,
        },
      ];
    }
    return tableCellProblems(row[field], column).map(({ message }) => ({
      path,
      message: `the field "${field}" of the row "${id}": ${message}`,
    }));
  });
};

/**
 * What is wrong with a Table's `rows` against its columns: a list of at most `TABLE_MAX_ROWS` rows,
 * each an object with an ID of the pattern, unique among the rows and without the view's prefix when
 * `origin` is the agent, and with keys that are input columns' fields, each value through
 * `tableCellProblems`. Past the row limit only the count is reported, so a forged value costs no
 * walk.
 */
export const tableRowsProblems = (
  rows: unknown,
  columns: TableColumns,
  origin: TableOrigin,
): Problem[] => {
  if (!Array.isArray(rows)) return [{ path: "/rows", message: "the rows are no list" }];
  if (rows.length > TABLE_MAX_ROWS) {
    return [
      {
        path: "/rows",
        message: `the Table holds ${rows.length} rows, over the limit of ${TABLE_MAX_ROWS} rows`,
      },
    ];
  }
  const seen = new Set<string>();
  const problems: Problem[] = [];
  for (const [index, row] of rows.entries()) {
    if (!isRecord(row)) {
      problems.push({ path: pointer("rows", index), message: "a row is no object" });
      continue;
    }
    problems.push(
      ...idProblems(row.id, index, seen, origin),
      ...cellsProblems(row, index, columns),
    );
  }
  return problems;
};
