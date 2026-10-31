// The predecessors panel's boxes (design decision 8; proposal, open question 9): one per other task,
// in the Gantt's order, checked as the panel holds them, and refused with `canPrecede`'s reason
// when it would close a cycle or break the predecessor or the dependents limit. The limits count
// what the panel holds, not what the Gantt held when it opened, so that checking several boxes
// never goes past them. Plain ECMAScript.

import { canPrecede } from "./edits.ts";
import type { GanttOwnProps } from "./tasks.ts";

export type PanelBox = {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  /** Why the box may not be checked; undefined when it may. */
  readonly reason: string | undefined;
};

/** The Gantt with the task's predecessors as the panel holds them. */
const withHeld = (
  value: GanttOwnProps,
  taskId: string,
  held: readonly string[],
): GanttOwnProps => ({
  ...value,
  tasks: value.tasks.map((task) => (task.id === taskId ? { ...task, dependencies: held } : task)),
});

/** The boxes of a task's panel, which holds `held` as its predecessors. */
export const panelBoxes = (
  value: GanttOwnProps,
  taskId: string,
  held: readonly string[],
): readonly PanelBox[] => {
  const pending = withHeld(value, taskId, held);
  return value.tasks
    .filter((task) => task.id !== taskId)
    .map((task) => {
      const verdict = canPrecede(pending, taskId, task.id);
      return {
        id: task.id,
        label: task.label,
        checked: held.includes(task.id),
        reason: verdict.ok ? undefined : verdict.reason,
      };
    });
};

/** The predecessors held once a box is checked, after those held, or unchecked. */
export const toggled = (
  held: readonly string[],
  taskId: string,
  checked: boolean,
): readonly string[] => {
  if (!checked) return held.filter((id) => id !== taskId);
  return held.includes(taskId) ? held : [...held, taskId];
};
