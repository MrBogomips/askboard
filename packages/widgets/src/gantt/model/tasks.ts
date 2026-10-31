// The Gantt's rows (design decision 8): one per task, in the order the grid shows them, with the
// fields the grid's cells show and which of them the user may edit. A Gantt with its own tasks
// lists them in the agent's order; a plan's rows come from its Tree's leaves (task 7.6). Every
// date and flag of a row comes from the graph (`schedule.ts`), never from here.

import type { GanttOwnTask, GanttProps } from "@askboard/contract";

/** A Gantt with its own tasks: a list, in the agent's order, each with a label and a duration. */
export type GanttOwnProps = Extract<GanttProps, { readonly tasks: readonly GanttOwnTask[] }>;

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
  /** The task's own duration in working days; a plan's comes from the graph. */
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
