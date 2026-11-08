// The Row's registry entry (layouts, design decisions 1 and 3): its schema, check, wording, example
// and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module
// (the registry's import rule). A Row gives no result, edits nothing and derives nothing.

import type { WidgetType } from "../registry.ts";
import { rowPropsProblems } from "./checks.ts";
import rowProps from "./row-props.json" with { type: "json" };
import { ROW_EXPECTED, ROW_FIELDS, rowRest } from "./wording.ts";

export const ROW_WIDGET: WidgetType = {
  type: "row",
  noun: "a Row",
  props: rowProps,
  propsProblems: rowPropsProblems,
  wording: { expected: ROW_EXPECTED, fields: ROW_FIELDS, rest: rowRest },
  example: {
    item: {
      type: "row",
      id: "arrange-row",
      props: {
        items: [
          { type: "number-field", id: "arrange-row-qty", props: { label: "Quantity", min: 0 } },
          { type: "text-field", id: "arrange-row-unit", props: { label: "Unit" } },
        ],
        widths: { "arrange-row-qty": 2 },
      },
    },
  },
  skill: {
    use: "2 to 4 items side by side; a narrow board stacks them",
    notes: [
      "`widths` gives weights from 1 to 4, keyed by item ID; an item with none weighs 1. Put wide widgets (a Tree, a Gantt, a schedule or a board view) in a Stack or a tab, not a Row.",
    ],
  },
};
