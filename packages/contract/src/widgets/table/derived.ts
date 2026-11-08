// The Table's declared derived values (table-widget, design decision 7): which address below the
// item is one an answer's derived values may name: a total, `item.field`, of a column with
// `total`, and a formula column's field of a row, `item.row.field`, of the value the answer holds.
// Plain ECMAScript with no JSON and no Ajv. The columns and the rows are read into a `Set`, so a
// name such as `constructor` or `__proto__` is no address by inheritance.

import { isRecord } from "../../problems.ts";

const DECLARES =
  'a Table declares the total of a column with a total as "<field>", and the field of a formula column of a row as "<row>.<field>"';

const columnsOf = (props: unknown): readonly Record<string, unknown>[] =>
  isRecord(props) && Array.isArray(props.columns) ? props.columns.filter(isRecord) : [];

const fieldsWhere = (
  columns: readonly Record<string, unknown>[],
  has: (column: Record<string, unknown>) => boolean,
): Set<string> =>
  new Set(
    columns
      .filter((column) => typeof column.field === "string" && has(column))
      .map((column) => column.field as string),
  );

const rowIds = (props: unknown): Set<string> =>
  new Set(
    isRecord(props) && Array.isArray(props.rows)
      ? props.rows
          .filter(isRecord)
          .map((row) => row.id)
          .filter((id): id is string => typeof id === "string")
      : [],
  );

/**
 * Why the address `rest` below a Table item is no field the type declares, or `undefined` when it
 * is: one segment names a column with `total: "sum"`; two name a row of `props` and a formula
 * column's field. `props` is the edited value when the answer holds one, else the item's props.
 */
export const tableDerivedProblem = (
  rest: readonly string[],
  props: unknown,
): string | undefined => {
  const columns = columnsOf(props);
  if (rest.length === 1) {
    const totals = fieldsWhere(columns, (column) => column.total === "sum");
    return totals.has(rest[0] as string)
      ? undefined
      : `"${rest[0]}" is no total of the Table: ${DECLARES}`;
  }
  if (rest.length === 2) {
    const [row, field] = rest as readonly [string, string];
    const computed = fieldsWhere(columns, (column) => typeof column.formula === "string");
    if (!rowIds(props).has(row)) return `the Table has no row "${row}": ${DECLARES}`;
    return computed.has(field)
      ? undefined
      : `"${field}" is no formula column of the Table: ${DECLARES}`;
  }
  return DECLARES;
};
