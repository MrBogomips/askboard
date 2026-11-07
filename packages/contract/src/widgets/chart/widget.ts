// The Chart's registry entry (chart-widget, design decision 1): its props schema, checks, wording
// and example. It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module (the
// registry's import rule). A Chart edits nothing and derives nothing: it will give a result, the
// highlighted points (task 1.2).

import type { WidgetType } from "../registry.ts";
import chartProps from "./chart-props.json" with { type: "json" };
import { chartPropsProblems } from "./checks.ts";
import { CHART_EXPECTED, CHART_FIELDS, chartElementOf } from "./wording.ts";

export const CHART_WIDGET: WidgetType = {
  type: "chart",
  noun: "a Chart",
  props: chartProps,
  propsProblems: chartPropsProblems,
  wording: { expected: CHART_EXPECTED, fields: CHART_FIELDS, element: chartElementOf },
  example: {
    item: {
      type: "chart",
      id: "failures",
      props: {
        kind: "bar",
        categories: [
          { id: "fix-a", label: "Fix A" },
          { id: "fix-b", label: "Fix B" },
          { id: "fix-c", label: "Fix C" },
        ],
        series: [
          { id: "fails", label: "Failures", values: [4, 9, 2] },
          { id: "reruns", label: "Reruns", values: [1, 3, null] },
        ],
        unit: "runs",
      },
    },
  },
};
