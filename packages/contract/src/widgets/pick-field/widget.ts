// The PickField's registry entry (form-widget, design decisions 4 and 8): its schemas, checks,
// shape, wording, example and teaching text. It imports no runtime value of `validate.ts`,
// `sets.ts` or a schema set module (the registry's import rule). A PickField edits nothing and
// derives nothing: it gives a result, an option ID or a list of them. It joins `WIDGET_TYPES` only
// with its component's chunk (task 3.3); until then tests give it to the registry through
// `withWidgetTypes(...FORM_TYPES)`.

import type { WidgetType } from "../registry.ts";
import {
  pickFieldFieldCheck,
  pickFieldPropsProblems,
  pickFieldResultProblems,
  pickFieldResultShape,
} from "./checks.ts";
import pickFieldProps from "./pick-field-props.json" with { type: "json" };
import pickFieldResult from "./pick-field-result.json" with { type: "json" };
import { PICK_FIELD_EXPECTED, PICK_FIELD_FIELDS } from "./wording.ts";

export const PICK_FIELD_WIDGET: WidgetType = {
  type: "pick-field",
  noun: "a PickField",
  props: pickFieldProps,
  propsProblems: pickFieldPropsProblems,
  fieldCheck: pickFieldFieldCheck,
  result: {
    schema: pickFieldResult,
    shape: pickFieldResultShape,
    problems: pickFieldResultProblems,
  },
  wording: { expected: PICK_FIELD_EXPECTED, fields: PICK_FIELD_FIELDS },
  example: {
    item: {
      type: "pick-field",
      id: "region",
      props: {
        label: "Region",
        options: [
          { id: "eu", label: "Europe" },
          { id: "us", label: "North America" },
          { id: "apac", label: "Asia-Pacific", description: "Includes Oceania." },
        ],
      },
    },
  },
  help: {
    mouse:
      "Click an option to pick it, or several where the question allows more than one; a long list has a box to filter the options.",
    answer: "The agent receives the option or options you picked.",
  },
  skill: {
    use: "one or several options picked from a list, as in a form",
    notes: [
      "Options are `{id, label, description?}`, 2 to 50. `multiple` allows several, with `minItems` and `maxItems`; the result is an option ID, or a list of IDs. An enum of an MCP form is a PickField, a string a TextField, a number a NumberField, a boolean a Toggle.",
    ],
  },
};
