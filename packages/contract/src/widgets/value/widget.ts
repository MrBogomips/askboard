// The Value's registry entry (atoms, design decisions 1 and 10): its schema, check, wording,
// example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a schema
// set module (the registry's import rule). A Value gives no result, edits nothing and derives
// nothing: it shows a figure the agent gives.

import type { WidgetType } from "../registry.ts";
import { valuePropsProblems } from "./checks.ts";
import valueProps from "./value-props.json" with { type: "json" };
import { VALUE_EXPECTED, VALUE_FIELDS_WORDING } from "./wording.ts";

export const VALUE_WIDGET: WidgetType = {
  type: "value",
  noun: "a Value",
  props: valueProps,
  propsProblems: valuePropsProblems,
  wording: { expected: VALUE_EXPECTED, fields: VALUE_FIELDS_WORDING },
  example: {
    item: {
      type: "value",
      id: "budget",
      props: { label: "Budget", kind: "money", amount: "12480.50", currency: "EUR" },
    },
  },
  skill: {
    use: "a figure the user reads: a number, percentage, amount, date or duration",
    notes: [
      "`kind` is `number` or `percent` with `value` (a percentage is a ratio: 0.185 shows 18.5%), `money` with `amount` and `currency`, `date` with `date`, or `duration` with `days`. It gives no answer.",
    ],
  },
};
