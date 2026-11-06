// The Gantt's rows (design decision 8): one per task, in the order the grid shows them, with the
// fields the grid's cells show and which of them the user may edit. A Gantt with its own tasks
// lists them in the agent's order. A plan's tasks are its Tree's leaves as the Tree stands, in
// document order, named by their labels, each joined by ID with the plan's entry for it, if any;
// a parent is no task, and an entry that names no leaf gives no row (proposal, open question 10).
// The leaves are read as the Tree's own model reads its rows, and as `compute` reads a WBS: a node
// with no child is a leaf. Every date and flag of a row comes from the graph (`schedule.ts`),
// never from here.

import type { GanttOwnTask, GanttPlanEntry, GanttProps, TreeNode } from "@askboard/contract";
import { visibleRows } from "../../tree/model/rows.ts";

/** A Gantt with its own tasks: a list, in the agent's order, each with a label and a duration. */
export type GanttOwnProps = Extract<GanttProps, { readonly tasks: readonly GanttOwnTask[] }>;

/** A Gantt plan: its Tree's leaves are its tasks, and `tasks` maps a task ID to its entry. */
export type GanttPlanProps = Extract<GanttProps, { readonly workPackages: string }>;

/** The grid's columns, in order: "Task", "Start", "Duration", "Depends on". */
export const GANTT_COLUMNS = Object.freeze(["task", "start", "duration", "dependencies"] as const);

export type GanttColumn = (typeof GANTT_COLUMNS)[number];

export type GanttCell = { readonly column: GanttColumn; readonly editable: boolean };

export type GanttRow = {
  readonly id: string;
  readonly label: string;
  /** Whether the agent sent the task: a package the user adds in a plan's Tree was not. */
  readonly sent: boolean;
  /** The requested start, a `full-date`; undefined when the task has none. */
  readonly start: string | undefined;
  /** The task's own duration in working days, or a plan task's requested one; else the graph's. */
  readonly duration: number | undefined;
  /** The task's predecessors, by task ID; empty when it has none. */
  readonly dependencies: readonly string[];
  /** The row's cells, in the grid's column order. */
  readonly cells: readonly GanttCell[];
};

const NONE: readonly string[] = Object.freeze([]);

// In a Gantt with its own tasks, every cell but the name is the user's to edit.
const OWN_CELLS: readonly GanttCell[] = Object.freeze(
  GANTT_COLUMNS.map((column) => Object.freeze({ column, editable: column !== "task" })),
);

// In a plan, a duration is the user's to request, as a start is: only the name is not editable.
const PLAN_CELLS: readonly GanttCell[] = OWN_CELLS;

/** Whether the props are a Gantt's own tasks rather than a plan over a Tree. */
export const isOwnGantt = (props: GanttProps): props is GanttOwnProps =>
  props.workPackages === undefined && Array.isArray(props.tasks);

/** The rows of a Gantt with its own tasks, as sent or as edited. They all come from the agent. */
export const ownTaskRows = (props: GanttOwnProps): readonly GanttRow[] =>
  Object.freeze(
    props.tasks.map((task) =>
      Object.freeze({
        id: task.id,
        label: task.label,
        sent: true,
        start: task.start,
        duration: task.duration,
        dependencies:
          task.dependencies === undefined ? NONE : Object.freeze([...task.dependencies]),
        cells: OWN_CELLS,
      }),
    ),
  );

/** The plan's entry for a task, read only under its own key, whatever the task's ID. */
export const planEntry = (plan: GanttPlanProps, taskId: string): GanttPlanEntry | undefined =>
  Object.hasOwn(plan.tasks, taskId) ? plan.tasks[taskId] : undefined;

// Every node shows: no branch is collapsed.
const ALL_EXPANDED: ReadonlySet<string> = new Set();

/** A Tree's leaves, in document order. */
const leavesOf = (nodes: readonly TreeNode[]): readonly TreeNode[] =>
  visibleRows(nodes, ALL_EXPANDED).flatMap((row) => (row.hasChildren ? [] : [row.node]));

/**
 * The rows of a plan: the leaves of its Tree's nodes as they stand, each joined with the plan's
 * entry for it. A row was sent when its task is a leaf of the Tree as the agent sent it.
 */
export const planTaskRows = (
  plan: GanttPlanProps,
  nodes: readonly TreeNode[],
  sentNodes: readonly TreeNode[],
): readonly GanttRow[] => {
  const sent = new Set(leavesOf(sentNodes).map((node) => node.id));
  return Object.freeze(
    leavesOf(nodes).map((node) => {
      const entry = planEntry(plan, node.id);
      return Object.freeze({
        id: node.id,
        label: node.label,
        sent: sent.has(node.id),
        start: entry?.start,
        duration: entry?.duration,
        dependencies:
          entry?.dependencies === undefined ? NONE : Object.freeze([...entry.dependencies]),
        cells: PLAN_CELLS,
      });
    }),
  );
};
