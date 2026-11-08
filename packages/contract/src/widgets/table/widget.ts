// The Table's registry entry (table-widget, design decision 2): its props schema, checks, wording
// and example. It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module (the
// registry's import rule). The entry gives no edits, derived values or teaching text yet: task 1.4
// adds them, and task 6.3 registers the entry.

import type { WidgetType } from "../registry.ts";
import { tablePropsProblems } from "./checks.ts";
import tableProps from "./table-props.json" with { type: "json" };
import { TABLE_EXPECTED, TABLE_FIELDS, tableElementOf, tableRest } from "./wording.ts";

export const TABLE_WIDGET: WidgetType = {
  type: "table",
  noun: "a Table",
  props: tableProps,
  propsProblems: tablePropsProblems,
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
};
