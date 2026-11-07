// The Gantt's registry entry (widget-registry, design decision 1): its schemas, checks, plan link,
// shape, derived declarations, wording and example, each reused from the Gantt's own modules. It
// imports no runtime value of `validate.ts`, `sets.ts` or a schema set module (the registry's
// import rule).

import type { WidgetType } from "../registry.ts";
import { ganttPlanLinkProblems, ganttPropsProblems } from "./checks.ts";
import ganttChanges from "./gantt-changes.json" with { type: "json" };
import ganttProps from "./gantt-props.json" with { type: "json" };
import { GANTT_ANSWER_DERIVED, ganttShape } from "./index.ts";
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
};
