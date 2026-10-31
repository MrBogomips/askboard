// The Gantt (FR-11, FR-15): its props, part of the input format, and its changes, part of the
// output format (AD-7). Both schemas are standalone: they belong to no schema set until the input
// format reaches 1.1, and nothing compiles them when this module loads. Its validators and its
// shapes for the one generic diff come with the widget seams (gantt-widget, tasks 2.2 and 2.3).

import ganttChanges from "./gantt-changes.json" with { type: "json" };
import ganttProps from "./gantt-props.json" with { type: "json" };

export const ganttPropsSchema = ganttProps;
export const ganttChangesSchema = ganttChanges;

export const GANTT_SCHEMA_IDS = Object.freeze({
  props: "urn:askboard:input:gantt-props",
  changes: "urn:askboard:output:gantt-changes",
} as const);

/** At most this many tasks in a Gantt, or entries in a plan. */
export const GANTT_MAX_TASKS = 500;
/** At most this many predecessors of one task. */
export const GANTT_MAX_PREDECESSORS = 50;
/** At most this many tasks depending on one task, so each scheduling formula fits its limit. */
export const GANTT_MAX_DEPENDENTS = 50;
/** A task's duration, in whole working days. */
export const GANTT_MIN_DURATION = 1;
export const GANTT_MAX_DURATION = 2_000;
export const GANTT_LABEL_MAX_CHARS = 200;
/** The days a Gantt's dates may name: the range the compute graph's dates hold. */
export const GANTT_FIRST_DATE = "1900-03-01";
export const GANTT_LAST_DATE = "9999-12-31";

/** The number fields of the Tree a Gantt plan's `workPackages` names: its PERT estimates. */
export const GANTT_PLAN_ESTIMATES = Object.freeze([
  "optimistic",
  "mostLikely",
  "pessimistic",
] as const);

/**
 * The derived values a Gantt's answer carries (F7), each from the graph: `finish`, the plan's end
 * as a `full-date`, is `<item>.finishDate`; `criticalPath`, the critical tasks' IDs in task order,
 * lists the tasks whose `<item>.<task>.critical` is true.
 */
export const GANTT_ANSWER_DERIVED = Object.freeze({
  finish: "finishDate",
  criticalPath: "critical",
} as const);

/** A task of a Gantt with its own tasks. */
export type GanttOwnTask = {
  readonly id: string;
  readonly label: string;
  /** Whole working days, from 1. */
  readonly duration: number;
  /** The start the user or the agent asked for, a `full-date`. */
  readonly start?: string;
  readonly dependencies?: readonly string[];
};

/** What a Gantt plan says of one of its Tree's leaves. */
export type GanttPlanEntry = {
  readonly start?: string;
  readonly dependencies?: readonly string[];
};

export type GanttProps =
  | {
      readonly start: string;
      readonly workPackages?: undefined;
      readonly tasks: readonly GanttOwnTask[];
    }
  | {
      readonly start: string;
      /** The Tree item whose leaves are the plan's tasks. */
      readonly workPackages: string;
      readonly tasks: Readonly<Record<string, GanttPlanEntry>>;
    };

export type GanttItem = {
  readonly type: "gantt";
  readonly id: string;
  readonly props: GanttProps;
};

export type GanttChange = {
  readonly op: "set";
  /** `item.task.duration`, `item.task.start` or `item.task.dependencies`. */
  readonly target: string;
  readonly value: number | string | readonly string[] | null;
};
