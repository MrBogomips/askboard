// The field error under a task the graph cannot schedule (view spec, "Gantt formula errors"; AD-13,
// FR-14; EXPERIENCE State Patterns, By surface): its predecessors form a cycle, a predecessor names
// no task, or it follows a task that has no dates, named by where `compute` says its error arose.
// The wordings are this change's: EXPERIENCE records none. A formula error never blocks "Answer".

import type { Say } from "./say.ts";
import type { TaskSchedule } from "./schedule.ts";
import type { GanttRow } from "./tasks.ts";

/** The task an address names, in the item `itemId`: `<item>.<task>.<field>`. */
const taskOf = (itemId: string, address: string): string | undefined => {
  const [item, task, field] = address.split(".");
  return item === itemId && field !== undefined ? task : undefined;
};

/** The note under a task's row, from its schedule; undefined for a task the graph scheduled. */
export const scheduleNote = (
  itemId: string,
  row: GanttRow,
  schedule: TaskSchedule | undefined,
  labels: ReadonlyMap<string, string>,
  text: Say,
): string | undefined => {
  if (schedule?.kind !== "error") return undefined;
  const { error, address } = schedule.error;
  const origin = taskOf(itemId, address);
  if (origin === undefined) return text("gantt.note.couldNot");
  if (origin !== row.id) {
    return text("gantt.note.follows", { task: labels.get(origin) ?? origin });
  }
  if (error === "cycle") return text("gantt.note.cycle");
  if (error !== "missing-reference") return text("gantt.note.couldNot");
  const missing = row.dependencies.filter((id) => !labels.has(id));
  return text(missing.length === 1 ? "gantt.note.missingOne" : "gantt.note.missingMany", {
    ids: missing.join(", "),
  });
};
