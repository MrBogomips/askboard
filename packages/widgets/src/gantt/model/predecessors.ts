// The predecessors panel's boxes (design decision 8; proposal, open question 9): one per other task,
// in the rows' order, a plan's its Tree's leaves, a package the user added there included, checked
// as the panel holds them, and refused with `canPrecede`'s reason when it would close a cycle or
// break the predecessor or the dependents limit. The limits count what the panel holds, not what
// the Gantt held when it opened, so that checking several boxes never goes past them; a plan's
// panel for a task it holds no entry for counts the entry it would create. Plain ECMAScript.

import type { GanttProps } from "@askboard/contract";
import { precedenceIn } from "./edits.ts";
import { type GanttRow, isOwnGantt, planEntry } from "./tasks.ts";

export type PanelBox = {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  /** Why the box may not be checked; undefined when it may. */
  readonly reason: string | undefined;
};

/** The Gantt holding the panel's predecessors for the task, a plan's entry made if need be. */
const withHeld = (value: GanttProps, taskId: string, held: readonly string[]): GanttProps => {
  if (isOwnGantt(value)) {
    return {
      ...value,
      tasks: value.tasks.map((task) =>
        task.id === taskId ? { ...task, dependencies: held } : task,
      ),
    };
  }
  // Built from entries, so that any ID is an own key, `__proto__` included.
  const others = Object.entries(value.tasks).filter(([id]) => id !== taskId);
  const entry = { ...planEntry(value, taskId), dependencies: held };
  return { ...value, tasks: Object.fromEntries([...others, [taskId, entry]]) };
};

/** The rows with the task's predecessors as the panel holds them. */
const rowsWithHeld = (
  rows: readonly GanttRow[],
  taskId: string,
  held: readonly string[],
): readonly GanttRow[] =>
  rows.map((row) => (row.id === taskId ? { ...row, dependencies: held } : row));

/** The boxes of a task's panel, which holds `held` as its predecessors, over the Gantt's rows. */
export const panelBoxes = (
  value: GanttProps,
  rows: readonly GanttRow[],
  taskId: string,
  held: readonly string[],
): readonly PanelBox[] => {
  // The rows and the dependents counted once for every box, not once per box.
  const precedes = precedenceIn(withHeld(value, taskId, held), rowsWithHeld(rows, taskId, held));
  return rows
    .filter((row) => row.id !== taskId)
    .map((row) => {
      const verdict = precedes(taskId, row.id);
      return {
        id: row.id,
        label: row.label,
        checked: held.includes(row.id),
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
