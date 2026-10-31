// The board's graph source (AD-13): a board's items, as the input format writes them and with the
// draft's values in place, mapped onto what `buildGraph` reads. Items are typed only by their
// shape, so `compute` needs no widget type from `contract`; the props it reads are checked as any
// graph source is. Items that hold nothing to compute add nothing.

import { ID_PATTERN } from "@askboard/contract";
import {
  checkId,
  type GanttItem,
  type GraphItem,
  type GraphSource,
  isRecord,
  listOf,
  refuse,
} from "./source.ts";

/** A board item as the input format writes it: its type, its ID and its props. */
export type BoardItem = { readonly type: string; readonly id: string; readonly props?: unknown };

const ID = new RegExp(ID_PATTERN);

/** A list the caller may still change, copied and frozen; anything else is left for the checks. */
const settled = (value: unknown): unknown =>
  Array.isArray(value) ? Object.freeze([...value]) : value;

/** A Gantt with its own tasks: each task's duration, requested start and predecessors. */
const ownTasks = (id: string, props: Record<string, unknown>): GanttItem => {
  const where = `item ${id}`;
  const dependencies: [string, unknown][] = [];
  const starts: [string, unknown][] = [];
  const tasks = listOf<unknown>(props.tasks, "tasks", where).map((task) => {
    if (!isRecord(task)) return refuse(`${where}: a task is not an object`);
    if (typeof task.id !== "string" || !ID.test(task.id)) {
      refuse(`${where}: task ID ${JSON.stringify(task.id)} is not ${ID_PATTERN}`);
    }
    const taskId = task.id as string;
    if (task.dependencies !== undefined) dependencies.push([taskId, settled(task.dependencies)]);
    if (task.start !== undefined) starts.push([taskId, task.start]);
    return Object.freeze({ id: taskId, duration: task.duration as number });
  });
  // Entries, not assignments, so that every ID is an own key, `__proto__` included. The expansion
  // checks durations, predecessors and requested starts, naming the item.
  return Object.freeze({
    kind: "gantt",
    id,
    start: props.start as string,
    tasks: Object.freeze(tasks),
    dependencies: Object.freeze(Object.fromEntries(dependencies)) as GanttItem["dependencies"],
    starts: Object.freeze(Object.fromEntries(starts)) as GanttItem["starts"],
  });
};

/** The graph source of a board's items: every Gantt; a Gantt plan comes with its Tree. */
export const boardGraphSource = (items: readonly BoardItem[]): GraphSource => {
  if (!Array.isArray(items)) refuse("the board's items are not a list");
  const source: GraphItem[] = [];
  for (const item of items as readonly unknown[]) {
    if (!isRecord(item)) return refuse("a board item is not an object");
    if (item.type !== "gantt") continue;
    const id = checkId(item.id, "item", "");
    if (!isRecord(item.props)) return refuse(`item ${id}: props is not an object`);
    // A Gantt plan's mapping reads the Tree it names (gantt-widget, task 7.4).
    if (item.props.workPackages !== undefined) continue;
    source.push(ownTasks(id, item.props));
  }
  return Object.freeze({ items: Object.freeze(source) });
};
