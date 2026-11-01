// What a graph already built can take through `set` and `recalc`, in place of a rebuild (the
// gantt-widget design's "Risks / Trade-offs", applied in task 6.8, where a drop at the limits took
// more than 100 ms): a Gantt's changed duration, a number input, and the moved start of a task
// that holds a request before and after, whose `startOffset` is a number input too. Anything that
// changes the graph's formulas or nodes rebuilds: a first or a cleared request, predecessors, the
// plan's start, tasks added, removed or reordered, a plan, a Tree, any other item. A value the
// graph source would refuse rebuilds too, so that the rebuild refuses it, naming the item. Plain
// ECMAScript: the working-day calendar is `compute`'s.

import { firstWorkingDateFrom, workingDaysBetween } from "@askboard/compute";
import type { BoardContentItem } from "./board-graph.ts";

/** An input node's address and its new value. */
export type InputChange = readonly [address: string, value: number];

type Task = Readonly<Record<string, unknown>>;

type OwnGantt = { readonly start: string; readonly tasks: readonly unknown[] };

const isRecord = (value: unknown): value is Task =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A Gantt's own tasks, as the graph source reads them; undefined for a plan or anything else. */
const ownGantt = (props: unknown): OwnGantt | undefined =>
  isRecord(props) &&
  props.workPackages === undefined &&
  typeof props.start === "string" &&
  Array.isArray(props.tasks)
    ? (props as OwnGantt)
    : undefined;

const sameList = (a: unknown, b: unknown): boolean =>
  a === b ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((id, at) => id === b[at]));

/**
 * The working days from the plan's first working day to the first working day on or after the
 * request, 0 when it comes no later: `compute`'s `startOffset`. Undefined for what is no day, which
 * the rebuild then refuses: the calendar helpers throw a `RangeError` for it.
 */
export const startOffset = (planStart: string, requested: string): number | undefined => {
  try {
    const first = firstWorkingDateFrom(planStart);
    return Math.max(0, workingDaysBetween(first, firstWorkingDateFrom(requested)));
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
};

/** One task's input changes, or undefined when only a rebuild can take them. */
const taskChanges = (
  itemId: string,
  planStart: string,
  before: unknown,
  after: unknown,
): InputChange[] | undefined => {
  if (!isRecord(before) || !isRecord(after) || before.id !== after.id) return undefined;
  if (!sameList(before.dependencies, after.dependencies)) return undefined;
  if ((before.start === undefined) !== (after.start === undefined)) return undefined;
  const at = (field: string) => `${itemId}.${String(after.id)}.${field}`;
  const changes: InputChange[] = [];
  if (before.duration !== after.duration) {
    const { duration } = after;
    if (typeof duration !== "number" || !Number.isSafeInteger(duration) || duration < 1) {
      return undefined;
    }
    changes.push([at("duration"), duration]);
  }
  if (before.start !== after.start) {
    const offset =
      typeof after.start === "string" ? startOffset(planStart, after.start) : undefined;
    if (offset === undefined) return undefined;
    changes.push([at("startOffset"), offset]);
  }
  return changes;
};

/** One item's input changes, or undefined when only a rebuild can take them. */
const itemChanges = (
  before: BoardContentItem,
  after: BoardContentItem,
): readonly InputChange[] | undefined => {
  if (before.type !== after.type || before.id !== after.id) return undefined;
  if (before.props === after.props) return [];
  const was = ownGantt(before.props);
  const is = ownGantt(after.props);
  if (was === undefined || is === undefined) return undefined;
  if (was.start !== is.start || was.tasks.length !== is.tasks.length) return undefined;
  const changes: InputChange[] = [];
  for (const [index, task] of is.tasks.entries()) {
    const found = taskChanges(after.id, is.start, was.tasks[index], task);
    if (found === undefined) return undefined;
    changes.push(...found);
  }
  return changes;
};

/**
 * The input changes that take the graph of the items `before` to that of the items `after`, in
 * the items' and their tasks' order; undefined when only a rebuild gives it.
 */
export const inputChanges = (
  before: readonly BoardContentItem[],
  after: readonly BoardContentItem[],
): readonly InputChange[] | undefined => {
  if (before.length !== after.length) return undefined;
  const changes: InputChange[] = [];
  for (const [index, item] of after.entries()) {
    const found = itemChanges(before[index] as BoardContentItem, item);
    if (found === undefined) return undefined;
    changes.push(...found);
  }
  return changes;
};
