// The Gantt's registry entry (widget-registry, design decision 1): its schemas, checks, plan link,
// shape, derived declarations, wording and example, each reused from the Gantt's own modules. It
// imports no runtime value of `validate.ts`, `sets.ts` or a schema set module (the registry's
// import rule).

import type { WidgetType } from "../registry.ts";
import { ganttPlanLinkProblems, ganttPropsProblems } from "./checks.ts";
import ganttChanges from "./gantt-changes.json" with { type: "json" };
import ganttProps from "./gantt-props.json" with { type: "json" };
import { GANTT_ANSWER_DERIVED, ganttShape } from "./index.ts";
import { GANTT_KEYS } from "./keys.ts";
import {
  GANTT_EXPECTED,
  GANTT_FIELDS,
  ganttElementOf,
  ganttRest,
  ganttSchemaErrors,
} from "./wording.ts";

// A Gantt declares `finish` and `criticalPath`, each alone below the item.
const derivedProblem = (rest: readonly string[]): string | undefined => {
  const declared = Object.keys(GANTT_ANSWER_DERIVED);
  return rest.length === 1 && declared.includes(rest[0] ?? "")
    ? undefined
    : `a Gantt declares ${declared.join(" and ")}`;
};

export const GANTT_WIDGET: WidgetType = {
  type: "gantt",
  noun: "a Gantt",
  props: ganttProps,
  propsProblems: ganttPropsProblems,
  checksInvalidProps: true,
  itemProblems: ganttPlanLinkProblems,
  edits: {
    changes: ganttChanges,
    shape: (props) => ganttShape(typeof props === "object" && props !== null ? props : {}),
  },
  derived: {
    describe: `the plan's ${Object.keys(GANTT_ANSWER_DERIVED).join(" and ")}`,
    problem: derivedProblem,
  },
  wording: {
    expected: GANTT_EXPECTED,
    fields: GANTT_FIELDS,
    rest: ganttRest,
    element: ganttElementOf,
    schemaErrors: ganttSchemaErrors,
  },
  example: {
    item: {
      type: "gantt",
      id: "plan",
      props: { start: "2026-01-05", tasks: [{ id: "build", label: "Build", duration: 5 }] },
    },
  },
  keys: GANTT_KEYS,
  help: {
    mouse:
      "Click a start, duration or dependencies cell to edit it, drag a bar to move it or its end to resize it (Escape cancels a drag), drag the edge of the Task column to resize it, and pick Day, Week or Month to zoom a plan.",
    answer:
      "The agent receives the starts, durations and dependencies you changed; the dates and the critical path are worked out from them.",
  },
  skill: {
    use: "a schedule the user adjusts: tasks, durations, dependencies, with dates and the critical path computed",
    notes: [
      "Without `workPackages`, `tasks` is a list of tasks, each with its label and duration. With `workPackages`, the ID of a Tree item in the same question whose leaves are the tasks, `tasks` maps a leaf ID to its requested `duration`, `start` or `dependencies`.",
    ],
  },
};
