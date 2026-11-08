// The Table's rules that its schema cannot say (table-widget, design decision 2): column fields
// unique, each column's bounds as its input atom checks them, a formula and a total only where the
// type takes them, and the Table's own limits. Each column is checked by its input atom's own props
// check over a projection of the keys the atom reads, so a column's bounds mean what the atom's
// mean; the atom's problems are re-pathed under the column and keep their words.
//
// Plain ECMAScript with no JSON and no Ajv: the table chunk bundles it and checks props no schema
// has seen (the board's `valueFits`). Nothing here throws on a value it cannot read, and every map
// is a `Set` or a `Map`, so a name such as `constructor` or `__proto__` is only data (AD-10).

import { isFieldName } from "../../formula/grammar.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { dateFieldPropsProblems } from "../date-field/checks.ts";
import { moneyFieldPropsProblems } from "../money-field/checks.ts";
import { numberFieldPropsProblems } from "../number-field/checks.ts";
import { ATOM_LABEL_MAX_CHARS, codePointCount } from "../shared/atoms.ts";
import { textFieldPropsProblems } from "../text-field/checks.ts";
import { togglePropsProblems } from "../toggle/checks.ts";
import {
  TABLE_COLUMN_TYPES,
  TABLE_FIELD_PATTERN,
  TABLE_FORMULA_MAX_CHARS,
  TABLE_MAX_COLUMNS,
  TABLE_MIN_COLUMNS,
  TABLE_TEXT_MAX_CHARS,
  type TableColumnType,
  type TableOrigin,
} from "./constants.ts";

const FIELD = new RegExp(TABLE_FIELD_PATTERN);
const PROPS_KEYS: ReadonlySet<string> = new Set(["label", "fixedRows", "columns", "rows"]);
// A column's own keys, which no input atom reads; every other key belongs to its type's atom.
const COLUMN_KEYS: ReadonlySet<string> = new Set(["field", "label", "type", "formula", "total"]);
/** The keys of a column's input atom that a Table column takes, by type. */
const ATOM_KEYS: Readonly<Record<TableColumnType, readonly string[]>> = {
  text: ["maxLength"],
  number: ["min", "max", "step", "integer", "unit"],
  money: ["currency", "min", "max"],
  date: ["min", "max"],
  toggle: [],
};
const COMPUTED: readonly TableColumnType[] = ["number", "money", "date"];
const TOTALLED: readonly TableColumnType[] = ["number", "money"];

type Json = Record<string, unknown>;

/** What a Table's columns come to for the rows' checks: each field's type and its column. */
export type TableColumns = ReadonlyMap<string, Json & { readonly type: TableColumnType }>;

const isColumnType = (type: unknown): type is TableColumnType =>
  typeof type === "string" && (TABLE_COLUMN_TYPES as readonly string[]).includes(type);

const pointer = (...parts: readonly (string | number)[]): string =>
  parts.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

// The atom's props check over a projection: the label and the keys the column's type takes.
const atomProblems = (type: TableColumnType, projection: Json): readonly Problem[] => {
  switch (type) {
    case "text":
      return textFieldPropsProblems(projection);
    case "number":
      return numberFieldPropsProblems(projection);
    case "money":
      return moneyFieldPropsProblems(projection);
    case "date":
      return dateFieldPropsProblems(projection);
    case "toggle":
      return togglePropsProblems(projection);
  }
};

// The atom's problems, each re-pathed under the column.
const repathed = (at: number, problems: readonly Problem[]): Problem[] =>
  problems.map(({ path, message }) => ({
    path: pointer("columns", at) + (path === "/" ? "" : path),
    message,
  }));

const fieldProblems = (column: Json, at: number, seen: Set<string>): Problem[] => {
  const { field } = column;
  const path = pointer("columns", at, "field");
  if (typeof field !== "string") return [{ path, message: "a column has no field" }];
  if (!FIELD.test(field) || !isFieldName(field)) {
    return [
      {
        path,
        message: `the field ${JSON.stringify(field)} does not match ${TABLE_FIELD_PATTERN}: a lower-case letter, then letters and digits, never id`,
      },
    ];
  }
  if (seen.has(field)) {
    return [{ path, message: `the field "${field}" is declared by another column already` }];
  }
  seen.add(field);
  return [];
};

// The keys the column's type does not take, worded as the atoms word an unknown key.
const foreignKeyProblems = (column: Json, type: TableColumnType, at: number): Problem[] =>
  Object.keys(column)
    .filter((key) => !COLUMN_KEYS.has(key) && !ATOM_KEYS[type].includes(key))
    .map((key) => ({ path: pointer("columns", at, key), message: `unknown field "${key}"` }));

const projectionOf = (column: Json, type: TableColumnType): Json => {
  const keys = ["label", ...ATOM_KEYS[type]].filter((key) => Object.hasOwn(column, key));
  return Object.fromEntries(
    keys
      .map((key): [string, unknown] => [key, column[key]])
      .filter(([, value]) => value !== undefined),
  );
};

// A text column's own bound, and a money column's one currency (no `currencies`, as the atom has).
const typeProblems = (column: Json, type: TableColumnType, at: number): Problem[] => {
  if (
    type === "text" &&
    typeof column.maxLength === "number" &&
    column.maxLength > TABLE_TEXT_MAX_CHARS
  ) {
    return [
      {
        path: pointer("columns", at, "maxLength"),
        message: `maxLength is a whole number from 1 to ${TABLE_TEXT_MAX_CHARS}, the most a Table's text cell holds`,
      },
    ];
  }
  return [];
};

const formulaProblems = (column: Json, type: TableColumnType, at: number): Problem[] => {
  const { formula, total } = column;
  const problems: Problem[] = [];
  if (formula !== undefined) {
    const path = pointer("columns", at, "formula");
    if (!COMPUTED.includes(type)) {
      problems.push({
        path,
        message: `a ${type} column cannot be computed: a formula is for number, money and date columns`,
      });
    } else if (typeof formula !== "string" || codePointCount(formula) < 1) {
      problems.push({
        path,
        message: `the formula is text of 1 to ${TABLE_FORMULA_MAX_CHARS} characters`,
      });
    } else if (codePointCount(formula) > TABLE_FORMULA_MAX_CHARS) {
      problems.push({
        path,
        message: `the formula holds ${codePointCount(formula)} characters, over the limit of ${TABLE_FORMULA_MAX_CHARS}`,
      });
    }
  }
  if (total !== undefined) {
    const path = pointer("columns", at, "total");
    if (!TOTALLED.includes(type)) {
      problems.push({
        path,
        message: `a ${type} column has no total: a total is for number and money columns`,
      });
    } else if (total !== "sum") {
      problems.push({ path, message: 'the total is "sum", the only total a column has' });
    }
  }
  return problems;
};

const labelOk = (label: unknown): boolean =>
  typeof label === "string" &&
  codePointCount(label) >= 1 &&
  codePointCount(label) <= ATOM_LABEL_MAX_CHARS;

// One column's problems; its field joins `fields` when it is a fresh, valid one.
const columnProblems = (
  column: unknown,
  at: number,
  seen: Set<string>,
): { readonly problems: Problem[]; readonly valid: boolean } => {
  if (!isRecord(column)) {
    return {
      problems: [{ path: pointer("columns", at), message: "a column is no object" }],
      valid: false,
    };
  }
  const problems = fieldProblems(column, at, seen);
  const { type } = column;
  if (!isColumnType(type)) {
    const message = `the column is of the type ${JSON.stringify(type ?? null)}, where a column is text, number, money, date or toggle`;
    problems.push({ path: pointer("columns", at, "type"), message });
    if (!labelOk(column.label)) {
      problems.push({
        path: pointer("columns", at, "label"),
        message: `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`,
      });
    }
    return { problems, valid: false };
  }
  problems.push(...foreignKeyProblems(column, type, at));
  const projection = projectionOf(column, type);
  const noCurrency = type === "money" && projection.currency === undefined;
  const fromAtom = atomProblems(type, projection).filter(
    ({ path }) => !(noCurrency && path === "/currency"),
  );
  problems.push(...repathed(at, fromAtom));
  if (noCurrency) {
    problems.push({
      path: pointer("columns", at, "currency"),
      message: "a money column has a currency, an ISO 4217 code of three capital letters",
    });
  }
  problems.push(...typeProblems(column, type, at), ...formulaProblems(column, type, at));
  return { problems, valid: problems.length === 0 };
};

/**
 * The problems of a Table's `columns`, and the valid columns by field for the rows' checks: a list of
 * 1 to `TABLE_MAX_COLUMNS` columns, each with a fresh field of the pattern, a type of the five, the
 * keys of its type only and bounds as its input atom checks them, a formula only on a number, money
 * or date column and a total of `sum` only on a number or money column.
 */
export const tableColumnsProblems = (
  columns: unknown,
): { readonly problems: Problem[]; readonly byField: TableColumns } => {
  const byField = new Map<string, Json & { readonly type: TableColumnType }>();
  if (!Array.isArray(columns)) {
    return { problems: [{ path: "/columns", message: "the columns are no list" }], byField };
  }
  const problems: Problem[] = [];
  if (columns.length < TABLE_MIN_COLUMNS || columns.length > TABLE_MAX_COLUMNS) {
    problems.push({
      path: "/columns",
      message: `the Table holds ${columns.length} columns, and a Table has ${TABLE_MIN_COLUMNS} to ${TABLE_MAX_COLUMNS}`,
    });
  }
  const seen = new Set<string>();
  columns.forEach((column: unknown, at) => {
    const found = columnProblems(column, at, seen);
    problems.push(...found.problems);
    if (found.valid && isRecord(column)) {
      byField.set(column.field as string, column as Json & { readonly type: TableColumnType });
    }
  });
  return { problems, byField };
};

/**
 * What a schema cannot say about a Table's props: the columns' rules (`tableColumnsProblems`) and
 * no key the Table does not have. The rows' rules join them in `cells.ts`'s `tableRowsProblems`.
 * Never throws: anything it cannot read as a Table is a problem.
 */
export const tablePropsProblems = (props: unknown, _origin: TableOrigin): readonly Problem[] => {
  if (!isRecord(props)) {
    return [
      { path: "/", message: "a Table's props are an object {columns, rows, label?, fixedRows?}" },
    ];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => !PROPS_KEYS.has(key))
    .map((key) => ({ path: pointer(key), message: `unknown field "${key}"` }));
  if (props.label !== undefined && !labelOk(props.label)) {
    problems.push({
      path: "/label",
      message: `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`,
    });
  }
  if (props.fixedRows !== undefined && props.fixedRows !== true) {
    problems.push({
      path: "/fixedRows",
      message: "fixedRows is true, or absent for a Table whose rows the user may add and delete",
    });
  }
  return [...problems, ...tableColumnsProblems(props.columns).problems];
};
