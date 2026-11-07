// The Timeline's registry entry (latex-kanban-timeline, design decision 5): its schemas, check,
// shape, wording, example and teaching text. It imports no runtime value of `validate.ts`,
// `sets.ts` or a schema set module (the registry's import rule). A Timeline gives no result and
// derives nothing: the user moves entries, which the answer reports as `set`s of their lane and
// days.

import type { WidgetType } from "../registry.ts";
import { timelinePropsProblems } from "./checks.ts";
import { TIMELINE_SHAPE } from "./constants.ts";
import timelineChanges from "./timeline-changes.json" with { type: "json" };
import timelineProps from "./timeline-props.json" with { type: "json" };
import { TIMELINE_EXPECTED, TIMELINE_FIELDS, timelineElementOf } from "./wording.ts";

export const TIMELINE_WIDGET: WidgetType = {
  type: "timeline",
  noun: "a Timeline",
  props: timelineProps,
  propsProblems: timelinePropsProblems,
  edits: { changes: timelineChanges, shape: () => TIMELINE_SHAPE },
  wording: {
    expected: TIMELINE_EXPECTED,
    fields: TIMELINE_FIELDS,
    element: timelineElementOf,
  },
  example: {
    item: {
      type: "timeline",
      id: "roadmap",
      props: {
        lanes: [
          { id: "web", label: "Web" },
          { id: "mobile", label: "Mobile" },
        ],
        entries: [
          {
            id: "checkout",
            label: "New checkout",
            lane: "web",
            start: "2026-01-05",
            end: "2026-02-27",
          },
          { id: "launch", label: "Public launch", lane: "mobile", date: "2026-03-02" },
        ],
      },
    },
  },
  skill: {
    use: "milestones and date ranges the user moves in time and across lanes, as in a roadmap",
    notes: [
      "An entry is a milestone with `date` or a range with `start` and `end` (inclusive), in a `lane`; the answer's changes are `set`s of `lane`, `date`, `start` and `end`.",
    ],
  },
};
