// The Chart's registry entry (chart-widget, design decision 1): its props and result schemas,
// checks, wording, example and teaching text. It imports no runtime value of `validate.ts`,
// `sets.ts` or a schema set module (the registry's import rule). A Chart edits nothing and derives
// nothing: it gives a result, the highlighted points.

import type { WidgetType } from "../registry.ts";
import chartProps from "./chart-props.json" with { type: "json" };
import chartResult from "./chart-result.json" with { type: "json" };
import { chartPropsProblems, chartResultProblems, chartResultShape } from "./checks.ts";
import { CHART_KEYS } from "./keys.ts";
import { CHART_EXPECTED, CHART_FIELDS, chartElementOf } from "./wording.ts";

export const CHART_WIDGET: WidgetType = {
  type: "chart",
  noun: "a Chart",
  props: chartProps,
  propsProblems: chartPropsProblems,
  result: { schema: chartResult, shape: chartResultShape, problems: chartResultProblems },
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
  keys: CHART_KEYS,
  help: {
    mouse:
      "Click a bar, point or slice to highlight it and click it again to clear it; hover to read its value.",
    answer:
      "The agent receives the points you highlighted. A chart you did not touch gives no answer.",
  },
  skill: {
    use: "a bar, line or pie chart the user reads and may highlight points on",
    notes: [
      "`values` holds one number or null per category, in the categories' order; at most 5 series, and a pie takes one series of at most 5 slices.",
      '`highlights` is `many` (default), `one` or `none`. The result is `points`, each `{series, category}`; an untouched Chart gives no result, and with `highlights: "none"` there is no result at all, so give the question options or another item.',
    ],
  },
};
