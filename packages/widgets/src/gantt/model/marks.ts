// The Gantt's change marks (design decision 8; proposal, open question 15; EXPERIENCE Change
// highlight): per task, which of its fields the user changed against the agent's value, compared
// as the diff compares them, so the marks and the answer's changes agree. A task moved only by a
// predecessor is not marked: its fields are the agent's. In a plan, a package the user added in
// its Tree is marked too, and one re-estimated there, its duration in the live graph no longer the
// sent graph's. The toolbar counts the tasks changed in this item, each once: in a plan, only the
// tasks its own entries change, since the Tree counts its own changes.

import type { Baseline, TaskSchedule } from "./schedule.ts";
import { type GanttOwnProps, type GanttPlanProps, type GanttRow, planEntry } from "./tasks.ts";

export type TaskMarks = {
  readonly start: boolean;
  readonly duration: boolean;
  readonly dependencies: boolean;
  /** Any of them: the bar takes the change outline. */
  readonly changed: boolean;
  /**
   * In a plan, a duration that only follows an estimate or a package the user changed in the Tree
   * (design decision 11): the derived mark, never the change outline, and not counted as the
   * user's.
   */
  readonly derived?: boolean;
  /** In a plan, a package the user added in its Tree: its row takes the added mark. */
  readonly added?: boolean;
};

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.length === b.length &&
    a.every((id, at) => id === b[at]));

/** A plan's marks: its `derived` says the task was re-estimated in the plan's Tree. */
export type PlanTaskMarks = TaskMarks & {
  /** A package the user added in the plan's Tree: the agent sent no such task. */
  readonly added: boolean;
  readonly derived: boolean;
};

/** Each task's marks, by task ID, in task order. */
export const ownTaskMarks = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
): ReadonlyMap<string, TaskMarks> => {
  const before = new Map(sent.tasks.map((task) => [task.id, task]));
  return new Map(
    value.tasks.map((task) => {
      const agent = before.get(task.id);
      const start = task.start !== agent?.start;
      const duration = task.duration !== agent?.duration;
      const dependencies = !sameList(task.dependencies, agent?.dependencies);
      const changed = start || duration || dependencies;
      return [task.id, Object.freeze({ start, duration, dependencies, changed })];
    }),
  );
};

/** Whether a plan's entries for a task differ in its start or its predecessors. */
const entryMarks = (plan: GanttPlanProps, sent: GanttPlanProps, taskId: string) => {
  const entry = planEntry(plan, taskId);
  const agent = planEntry(sent, taskId);
  return {
    start: entry?.start !== agent?.start,
    dependencies: !sameList(entry?.dependencies, agent?.dependencies),
  };
};

/**
 * Each row's marks in a plan, by task ID in the rows' order. `schedules` and `baselines` are the
 * rows' schedules in the live graph and their baselines, in the rows' order: a task re-estimated
 * is one whose duration differs from its baseline's while the live graph schedules it: it takes
 * the derived mark and does not count as the user's change.
 */
export const planTaskMarks = (
  value: GanttPlanProps,
  sent: GanttPlanProps,
  rows: readonly GanttRow[],
  schedules: readonly (TaskSchedule | undefined)[],
  baselines: readonly (Baseline | undefined)[],
): ReadonlyMap<string, PlanTaskMarks> =>
  new Map(
    rows.map((row, index) => {
      const { start, dependencies } = entryMarks(value, sent, row.id);
      const schedule = schedules[index];
      const baseline = baselines[index];
      // A duration the user asked for in the Gantt is `direct` (a later task); until then the only
      // duration that differs from the baseline's follows the Tree.
      const derived =
        schedule?.kind === "scheduled" &&
        baseline !== undefined &&
        schedule.duration !== baseline.duration;
      const added = !row.sent;
      const changed = start || dependencies || added;
      return [
        row.id,
        Object.freeze({ start, duration: false, dependencies, added, derived, changed }),
      ];
    }),
  );

/**
 * How many tasks a plan's own entries change, each once: the count "Your changes" shows in a plan,
 * the tasks its diff names, whether or not the Tree still holds them.
 */
export const planChangeCount = (value: GanttPlanProps, sent: GanttPlanProps): number => {
  const ids = new Set([...Object.keys(value.tasks), ...Object.keys(sent.tasks)]);
  return [...ids].filter((id) => {
    const { start, dependencies } = entryMarks(value, sent, id);
    return start || dependencies;
  }).length;
};

/** How many tasks the user changed: the count "Your changes" shows. */
export const changeCount = (marks: ReadonlyMap<string, TaskMarks>): number =>
  [...marks.values()].filter((mark) => mark.changed).length;

/**
 * How many tasks follow the Tree, each once: the derived mark on a task the user did not also
 * change, so that the marks and the counter agree (design decision 11; review F-07).
 */
export const derivedCount = (marks: ReadonlyMap<string, TaskMarks>): number =>
  [...marks.values()].filter((mark) => mark.derived === true && !mark.changed).length;
