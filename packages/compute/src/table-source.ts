// The Table's graph source (table-widget, design decision 5; AD-13): a `table` board item as one
// `fields` item named by the Table. Its rows are the children, each holding every input column (null
// when the row has no value, so the node set depends on the columns and the row IDs only); its formula
// columns are the item's `columns`, read as `[@field]` in each row; its total columns are the item's
// own fields, `SUM([item.*.field])`. `compute` imports no registry: the props are read as the input
// format writes them and checked as any graph source is, and a source that is no Table is refused
// with a `GraphSourceError` naming the item. Every map is built with `Object.fromEntries` and
// read with `Object.hasOwn`, so a row ID or a field such as `constructor` is only data.

import { isFieldName } from "@askboard/contract";
import type { BoardSource } from "./board-sources.ts";
import {
  checkId,
  type FieldInput,
  type Fields,
  type GraphChild,
  isRecord,
  listOf,
  refuse,
} from "./source.ts";
import type { ValueType } from "./types.ts";

/** A column's type as the graph types its nodes: a toggle is a boolean. */
const NODE_TYPES: Readonly<Record<string, ValueType>> = Object.freeze({
  text: "text",
  number: "number",
  money: "money",
  date: "date",
  toggle: "boolean",
});

type Column = {
  readonly field: string;
  readonly type: ValueType;
  readonly formula?: string;
  readonly total: boolean;
  readonly currency?: string;
};

const columnOf = (column: unknown, where: string, seen: Set<string>): Column => {
  if (!isRecord(column)) return refuse(`${where}: a column is not an object`);
  const { field, type, formula, currency } = column;
  if (typeof field !== "string" || !isFieldName(field) || field === "id") {
    refuse(`${where}: ${JSON.stringify(field)} is not a column field`);
  }
  if (seen.has(field as string)) refuse(`${where}: the column ${field} is declared twice`);
  seen.add(field as string);
  const nodeType =
    typeof type === "string" && Object.hasOwn(NODE_TYPES, type) ? NODE_TYPES[type] : undefined;
  if (nodeType === undefined)
    refuse(`${where}: column ${field} has the unknown type ${JSON.stringify(type)}`);
  if (formula !== undefined && typeof formula !== "string") {
    refuse(`${where}: the formula of column ${field} is not text`);
  }
  return {
    field: field as string,
    type: nodeType as ValueType,
    ...(typeof formula === "string" ? { formula } : {}),
    total: column.total === "sum" && (nodeType === "number" || nodeType === "money"),
    ...(typeof currency === "string" ? { currency } : {}),
  };
};

/** A column's node: its type, a money node in the column's currency. */
const node = (column: Column, rest: Partial<FieldInput>): FieldInput => ({
  type: column.type,
  ...rest,
  ...(column.currency === undefined ? {} : { currency: column.currency }),
});

const rowOf = (row: unknown, columns: readonly Column[], where: string): GraphChild => {
  if (!isRecord(row)) return refuse(`${where}: a row is not an object`);
  const id = checkId(row.id, "row", `${where}: `);
  const fields = columns
    .filter(({ formula }) => formula === undefined)
    .map(({ field, ...column }) => {
      const value = Object.hasOwn(row, field) ? row[field] : null;
      return [
        field,
        node({ field, ...column }, { value: (value ?? null) as FieldInput["value"] }),
      ] as const;
    });
  return { id, fields: Object.fromEntries(fields) };
};

/** The sum of a column over the rows; none, a sum is 0. */
const totalOf = (item: string, column: Column, rows: number): FieldInput =>
  node(column, { formula: rows === 0 ? "0" : `SUM([${item}.*.${column.field}])` });

export const tableSource: BoardSource = (item) => {
  const id = checkId(item.id, "item", "");
  const where = `item ${id}`;
  const { props } = item;
  if (!isRecord(props)) return refuse(`${where}: props is not an object`);
  const seen = new Set<string>();
  const columns = listOf<unknown>(props.columns, "columns", where).map((column) =>
    columnOf(column, where, seen),
  );
  const rows = listOf<unknown>(props.rows, "rows", where);
  const ids = new Set<string>();
  const children = rows.map((row) => {
    const child = rowOf(row, columns, where);
    if (ids.has(child.id)) refuse(`${where}: row ID ${child.id} is used twice`);
    ids.add(child.id);
    return child;
  });
  const totals: [string, FieldInput][] = columns
    .filter(({ total }) => total)
    .map((column) => [column.field, totalOf(id, column, rows.length)]);
  const formulas: [string, FieldInput][] = columns
    .filter(({ formula }) => formula !== undefined)
    .map((column) => [column.field, node(column, { formula: column.formula })]);
  return [
    Object.freeze({
      kind: "fields",
      id,
      fields: Object.fromEntries(totals) as Fields,
      columns: Object.fromEntries(formulas) as Fields,
      children,
    }),
  ];
};
