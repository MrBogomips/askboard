// The Gantt (FR-11, FR-15): its props, part of the input format, and its changes, part of the
// output format (AD-7). Both schemas are standalone: they belong to no schema set until the input
// format reaches 1.1, and nothing compiles them when this module loads. Its validators are in
// `validate.ts`, on the seams' shared widget validator; its shapes for the one generic diff are here.
// Each frozen constant is marked pure, so that a view chunk drops those it does not use, the
// schema IDs among them.

import type { ElementShape } from "../element-diff.ts";
import ganttChanges from "./gantt-changes.json" with { type: "json" };
import ganttProps from "./gantt-props.json" with { type: "json" };

export const ganttPropsSchema = ganttProps;
export const ganttChangesSchema = ganttChanges;

export const GANTT_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
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
/**
 * The days a Gantt's dates may name. The compute graph holds 1900-03-01 too, but finds a plan's
 * first working day from the day before its start, which must be a day it holds.
 */
export const GANTT_FIRST_DATE = "1900-03-02";
export const GANTT_LAST_DATE = "9999-12-31";

/** The number fields of the Tree a Gantt plan's `workPackages` names: its PERT estimates. */
export const GANTT_PLAN_ESTIMATES = /* @__PURE__ */ Object.freeze([
  "optimistic",
  "mostLikely",
  "pessimistic",
] as const);

/**
 * The derived values a Gantt's answer carries (F7), each from the graph: `finish`, the plan's end
 * as a `full-date`, is `<item>.finishDate`; `criticalPath`, the critical tasks' IDs in task order,
 * lists the tasks whose `<item>.<task>.critical` is true.
 */
export const GANTT_ANSWER_DERIVED = /* @__PURE__ */ Object.freeze({
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
  /** The requested duration in whole working days, which wins over the estimates' (input 1.5). */
  readonly duration?: number;
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

/** A Gantt's own tasks for the one generic diff (AD-20): a flat list, every key but `id` a field. */
export const GANTT_SHAPE: ElementShape = /* @__PURE__ */ Object.freeze({ elements: "tasks" });

/** A plan's tasks: a map from task ID to an entry, which gives only `set`s. */
export const GANTT_PLAN_SHAPE: ElementShape = /* @__PURE__ */ Object.freeze({
  elements: "tasks",
  keyed: true,
});

/** The shape of a Gantt's props: a plan's when they name its work packages. */
export const ganttShape = (props: object): ElementShape =>
  (props as { readonly workPackages?: unknown }).workPackages === undefined
    ? GANTT_SHAPE
    : GANTT_PLAN_SHAPE;
