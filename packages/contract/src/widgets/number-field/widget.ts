// The NumberField's registry entry (atoms, design decisions 1 and 10): its schemas, checks, shape,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A NumberField edits nothing and derives
// nothing: it gives a result, a number.

import type { WidgetType } from "../registry.ts";
import {
  numberFieldPropsProblems,
  numberFieldResultProblems,
  numberFieldResultShape,
} from "./checks.ts";
import numberFieldProps from "./number-field-props.json" with { type: "json" };
import numberFieldResult from "./number-field-result.json" with { type: "json" };
import { NUMBER_FIELD_EXPECTED, NUMBER_FIELD_FIELDS } from "./wording.ts";

export const NUMBER_FIELD_WIDGET: WidgetType = {
  type: "number-field",
  noun: "a NumberField",
  props: numberFieldProps,
  propsProblems: numberFieldPropsProblems,
  result: {
    schema: numberFieldResult,
    shape: numberFieldResultShape,
    problems: numberFieldResultProblems,
  },
  wording: { expected: NUMBER_FIELD_EXPECTED, fields: NUMBER_FIELD_FIELDS },
  example: {
    item: {
      type: "number-field",
      id: "days",
      props: { label: "Days of leave", min: 0, max: 20, step: 0.5, unit: "days" },
    },
  },
  skill: {
    use: "a number the user types, with optional bounds, a step and a unit",
    notes: [
      "`min` and `max` bound it, `integer` takes whole numbers, `step` (counted from `min`, else 0) fixes the grid, and `unit` is shown beside it. Use a Scale for a slider.",
    ],
  },
};
