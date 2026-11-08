// The Table's fixtures (table-widget, design decisions 13 and 14): `TABLE_TYPES`, the entries a test
// gives the shipped registry through `withWidgetTypes` while the type is not registered yet, the
// Table of roles, an edited value of it, and the generator of the worst form a Table's bounds
// admit. Tests only; no shipped unit imports them.

import type { WidgetType } from "../widgets/registry.ts";
import {
  TABLE_FORMULA_MAX_CHARS,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  type TableColumn,
  type TableItem,
  type TableProps,
  type TableRow,
} from "../widgets/table/constants.ts";
import { TABLE_WIDGET } from "../widgets/table/widget.ts";

/**
 * The Table's entries in the registry's order. A test passes them to
 * `withWidgetTypes(...TABLE_TYPES)`; the same test passes before and after the type joins
 * `WIDGET_TYPES`.
 */
export const TABLE_TYPES: readonly WidgetType[] = [TABLE_WIDGET];

/**
 * The Table of roles (contract spec, Table items): a text column, a number column totalled, a money
 * column and a money column computed `[@days] * [@rate]` and totalled; two rows.
 */
export const TABLE_FIXTURE_ITEM = TABLE_WIDGET.example.item as TableItem;

/**
 * The Table of roles as the user edits it (contract spec, Table changes): `pm`'s rate lowered to
 * "960.00" and a row `u-1` after `dev`. Its columns, label and rows' order are the revision's.
 */
export const TABLE_EDITED_PROPS: TableProps = {
  ...TABLE_FIXTURE_ITEM.props,
  rows: [
    { ...(TABLE_FIXTURE_ITEM.props.rows[0] as TableRow), rate: "960.00" },
    TABLE_FIXTURE_ITEM.props.rows[1] as TableRow,
    { id: "u-1", role: "Tester", days: 10, rate: "600.00" },
  ],
};

// A formula of at most the column's limit: `term` joined by `+`, as many as fit.
const chained = (term: string): string => {
  const count = Math.floor((TABLE_FORMULA_MAX_CHARS + 1) / (term.length + 1));
  return Array.from({ length: count }, () => term).join("+");
};

/**
 * The worst form the Table's bounds admit (design decision 13): `rows` rows (200 when absent) of 10
 * columns, one input number column `a` and nine number columns `f1` to `f9` computed from it, each
 * formula the longest the limit allows (`[@a]+[@a]+…`, then `[@f1]+[@f1]+…` and so on, each column
 * reading the one before), and every column totalled.
 */
export const tableWorstForm = (rows: number = TABLE_MAX_ROWS): TableProps => {
  const computed: TableColumn[] = Array.from(
    { length: TABLE_MAX_COLUMNS - 1 },
    (_, index): TableColumn => ({
      field: `f${index + 1}`,
      label: `Formula ${index + 1}`,
      type: "number",
      formula: chained(`[@${index === 0 ? "a" : `f${index}`}]`),
      total: "sum",
    }),
  );
  return {
    label: "The worst form",
    columns: [{ field: "a", label: "Input", type: "number", total: "sum" }, ...computed],
    rows: Array.from(
      { length: rows },
      (_, index): TableRow => ({ id: `r${index + 1}`, a: index % 9 }),
    ),
  };
};
