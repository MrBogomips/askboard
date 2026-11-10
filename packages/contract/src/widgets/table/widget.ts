// The Table's registry entry (table-widget, design decisions 2, 6, 7 and 15): its props schema,
// checks, element shape, changes schema, derived declarations, wording, example and teaching text.
// It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module (the registry's
// import rule). A Table gives no result: it is a review widget, and an untouched Table is unchanged
// (AD-10). Task 6.3 registers the entry.

import type { WidgetType } from "../registry.ts";
import { tablePropsProblems } from "./checks.ts";
import { TABLE_SHAPE } from "./constants.ts";
import { tableDerivedProblem } from "./derived.ts";
import tableChanges from "./table-changes.json" with { type: "json" };
import tableProps from "./table-props.json" with { type: "json" };
import { TABLE_EXPECTED, TABLE_FIELDS, tableElementOf, tableRest } from "./wording.ts";

export const TABLE_WIDGET: WidgetType = {
  type: "table",
  noun: "a Table",
  props: tableProps,
  propsProblems: tablePropsProblems,
  edits: { changes: tableChanges, shape: () => TABLE_SHAPE },
  derived: {
    describe:
      "each total, `item.field`, and each formula column's field of a row, `item.row.field`",
    problem: tableDerivedProblem,
  },
  wording: {
    expected: TABLE_EXPECTED,
    fields: TABLE_FIELDS,
    rest: tableRest,
    element: tableElementOf,
  },
  example: {
    item: {
      type: "table",
      id: "costs",
      props: {
        label: "Roles",
        columns: [
          { field: "role", label: "Role", type: "text" },
          { field: "days", label: "Days", type: "number", min: 0, total: "sum" },
          { field: "rate", label: "Rate", type: "money", currency: "USD" },
          {
            field: "amount",
            label: "Amount",
            type: "money",
            currency: "USD",
            formula: "[@days] * [@rate]",
            total: "sum",
          },
        ],
        rows: [
          { id: "pm", role: "Project manager", days: 18, rate: "1040.00" },
          { id: "dev", role: "Developer", days: 72, rate: "720.00" },
        ],
      },
    },
  },
  help: {
    mouse:
      "Click a cell to edit it, use Add row and Delete row in the toolbar, and click an on or off cell to switch it. Computed columns and totals are read-only.",
    answer:
      "The agent receives the cells you changed, the rows you added or deleted, and the totals and computed cells that follow from them.",
  },
  skill: {
    use: "a grid of typed columns to edit, with totals and formula columns",
    notes: [
      "Columns (1 to 10, unique lower-case `field`): `text` (`maxLength`), `number` (`min`, `max`, `step`, `integer`, `unit`), `money` (`currency`; `min`, `max` as decimal strings), `date` (`min`, `max`), `toggle`. A row is `{id, <field>: value}`; money is a decimal string; leave an empty cell out.",
      'A column with a `formula` is computed and read-only: no value for it in a row. `[@field]` reads that field of the same row; a formula reads single fields only (no `*`, no range), at most 500 characters. `total: "sum"` on a number or money column adds a total that formulas read as `[item.field]`.',
      "`fixedRows: true` keeps your rows: the user edits cells but adds and deletes none. At most 200 rows. The answer gives the changes (`set` of `item.row.field`, `add`, `remove`) and the derived values: each total and the formula cells of rows that moved.",
    ],
  },
};
