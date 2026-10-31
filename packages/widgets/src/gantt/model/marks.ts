// The Gantt's change marks (design decision 8; proposal, open question 15; EXPERIENCE Change
// highlight): per task, which of its fields the user changed against the agent's value, compared
// as the diff compares them, so the marks and the answer's changes agree. A task moved only by a
// predecessor is not marked: its fields are the agent's. The toolbar counts the tasks changed in
// this item, each once. A plan's marks (a package added or re-estimated in its Tree) come in 7.6.

import type { GanttOwnProps } from "./tasks.ts";

export type TaskMarks = {
  readonly start: boolean;
  readonly duration: boolean;
  readonly dependencies: boolean;
  /** Any of them: the bar takes the change outline. */
  readonly changed: boolean;
};

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.length === b.length &&
    a.every((id, at) => id === b[at]));

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

/** How many tasks the user changed: the count "Your changes" shows. */
export const changeCount = (marks: ReadonlyMap<string, TaskMarks>): number =>
  [...marks.values()].filter((mark) => mark.changed).length;

/** The toolbar's counter (EXPERIENCE State Patterns, Widget). */
export const changeCounter = (count: number): string =>
  count === 0 ? "Changes vs agent's original · none yet" : `Your changes: ${count}`;
