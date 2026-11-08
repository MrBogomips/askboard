// The DateField's registry entry (atoms, design decisions 1 and 10): its schemas, checks, shape,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A DateField edits nothing and derives nothing:
// it gives a result, a full-date.

import type { WidgetType } from "../registry.ts";
import {
  dateFieldFieldCheck,
  dateFieldPropsProblems,
  dateFieldResultProblems,
  dateFieldResultShape,
} from "./checks.ts";
import dateFieldProps from "./date-field-props.json" with { type: "json" };
import dateFieldResult from "./date-field-result.json" with { type: "json" };
import { DATE_FIELD_EXPECTED, DATE_FIELD_FIELDS } from "./wording.ts";

export const DATE_FIELD_WIDGET: WidgetType = {
  type: "date-field",
  noun: "a DateField",
  props: dateFieldProps,
  propsProblems: dateFieldPropsProblems,
  fieldCheck: dateFieldFieldCheck,
  result: {
    schema: dateFieldResult,
    shape: dateFieldResultShape,
    problems: dateFieldResultProblems,
  },
  wording: { expected: DATE_FIELD_EXPECTED, fields: DATE_FIELD_FIELDS },
  example: {
    item: {
      type: "date-field",
      id: "start",
      props: { label: "Start date", min: "2026-01-01" },
    },
  },
  skill: {
    use: "a calendar day the user types or picks, optionally within a range",
    notes: [
      "`min` and `max` are full-dates (`2026-03-02`) that bound the days offered. The result is a full-date.",
    ],
  },
};
