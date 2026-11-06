// What a Gantt with its own tasks and a Gantt plan do each their own way (design decision 8): where
// the rows come from, the agent's tasks or the leaves of the plan's Tree as it stands; which
// tasks are marked, a plan's also when added or re-estimated in its Tree; and what the toolbar
// counts, in a plan only the tasks its own entries change, since the Tree counts its own. A value
// and the agent's value are always of one kind. Plain ECMAScript.

import type { GanttProps, TreeNode } from "@askboard/contract";
import {
  changeCount,
  derivedCount,
  ownTaskMarks,
  planChangeCount,
  planTaskMarks,
  type TaskMarks,
} from "./marks.ts";
import type { Baseline, TaskSchedule } from "./schedule.ts";
import { type GanttRow, isOwnGantt, ownTaskRows, planTaskRows } from "./tasks.ts";

/** A plan's Tree: its nodes as they stand, and as the agent sent them. */
export type PlanTree = {
  readonly nodes: readonly TreeNode[];
  readonly sentNodes: readonly TreeNode[];
};

/** The Gantt's rows: its own tasks, or its plan's Tree's leaves joined with its entries. */
export const ganttRows = (value: GanttProps, tree: PlanTree | undefined): readonly GanttRow[] => {
  if (isOwnGantt(value)) return ownTaskRows(value);
  if (tree === undefined) throw new RangeError("a Gantt plan's rows are its Tree's leaves");
  return planTaskRows(value, tree.nodes, tree.sentNodes);
};

export type GanttMarks = {
  /** What the user changed, by task ID, in the rows' order. */
  readonly marks: ReadonlyMap<string, TaskMarks>;
  /** The tasks "Your changes" counts. */
  readonly count: number;
  /** The tasks that follow the plan's Tree: "M follow from the WBS". Always 0 for a Gantt's own. */
  readonly derived: number;
};

/**
 * Each row's marks and the toolbar's count. `schedules` and `baselines` are the rows' schedules
 * in the live graph and, in a plan, their baselines: a task re-estimated in its Tree is one whose
 * duration is no longer its baseline's.
 */
export const ganttMarks = (
  value: GanttProps,
  sent: GanttProps,
  rows: readonly GanttRow[],
  schedules: readonly (TaskSchedule | undefined)[],
  baselines: readonly (Baseline | undefined)[] | undefined,
): GanttMarks => {
  if (isOwnGantt(value) && isOwnGantt(sent)) {
    const marks = ownTaskMarks(value, sent);
    return { marks, count: changeCount(marks), derived: 0 };
  }
  if (isOwnGantt(value) || isOwnGantt(sent)) {
    throw new RangeError("a Gantt's marks take its value and the agent's of one kind");
  }
  const marks = planTaskMarks(value, sent, rows, schedules, baselines ?? []);
  return { marks, count: planChangeCount(value, sent), derived: derivedCount(marks) };
};
