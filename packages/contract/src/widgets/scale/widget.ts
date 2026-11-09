// The Scale's registry entry (approval-scale-ranking, design decision 1): its schemas, checks,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A Scale edits nothing and derives nothing: it
// gives a result.

import type { WidgetType } from "../registry.ts";
import { scalePropsProblems, scaleResultProblems, scaleResultShape } from "./checks.ts";
import scaleProps from "./scale-props.json" with { type: "json" };
import scaleResult from "./scale-result.json" with { type: "json" };
import { SCALE_EXPECTED, SCALE_FIELDS } from "./wording.ts";

export const SCALE_WIDGET: WidgetType = {
  type: "scale",
  noun: "a Scale",
  props: scaleProps,
  propsProblems: scalePropsProblems,
  result: { schema: scaleResult, shape: scaleResultShape, problems: scaleResultProblems },
  wording: { expected: SCALE_EXPECTED, fields: SCALE_FIELDS },
  example: {
    item: {
      type: "scale",
      id: "confidence",
      props: { min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High" },
    },
  },
  help: {
    mouse:
      "Drag the slider handle, or press a value of the rating, to set a number; nothing is set until you do.",
    answer:
      "The agent receives the value you set, or the low and high values of a range. A scale you did not touch gives no answer.",
  },
  skill: {
    use: "a number on a slider (the Slider), a range between two numbers, or a rating of up to 11 values",
    notes: [
      "Nothing is set until the user sets it: the result is `value`, or `low` and `high` with `range`.",
    ],
  },
};
