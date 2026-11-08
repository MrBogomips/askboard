// The board's graph source (AD-13): a board's items, as the input format writes them and with the
// draft's values in place, mapped onto what `buildGraph` reads. Items are typed only by their
// shape, so `compute` needs no widget type from `contract`; the props it reads are checked as any
// graph source is. A Gantt plan reads the Tree it names, which becomes its WBS once, however many
// plans name it; a Tree with `pert` (the WBS with PERT, molecules design decision 10) is a WBS on
// its own, and once when a plan also names it. Items that hold nothing to compute, a Tree with no
// `pert` that no plan names among them, add nothing.

import { ID_PATTERN } from "@askboard/contract";
import { BOARD_SOURCES, type BoardSource } from "./board-sources.ts";
import {
  checkId,
  type GanttItem,
  type GanttPlanItem,
  type GraphItem,
  type GraphSource,
  isRecord,
  listOf,
  refuse,
  type WbsNode,
  type WbsPertItem,
} from "./source.ts";

/** A board item as the input format writes it: its type, its ID and its props. */
export type BoardSourceItem = {
  readonly type: string;
  readonly id: string;
  readonly props?: unknown;
};

const ID = new RegExp(ID_PATTERN);

/** The keys of a Tree's node that the WBS reads (`pert.ts`): its name and other columns are not. */
const WBS_KEYS = ["id", "optimistic", "mostLikely", "pessimistic"] as const;

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

/** A Tree a plan names, as its WBS, and the IDs of its leaves: the plan's tasks. */
type WorkPackages = { readonly item: WbsPertItem; readonly leaves: ReadonlySet<unknown> };

type Copy = { readonly node: unknown; readonly into: unknown[] };

/**
 * A Tree as a WBS: its nodes copied and frozen with only the keys the WBS reads, in an explicit
 * walk, as `pert.ts` walks them. A node that is no object and children that are no list are kept
 * for the expansion to refuse.
 */
const workPackages = (item: Record<string, unknown>): WorkPackages => {
  const id = checkId(item.id, "item", "");
  if (!isRecord(item.props)) return refuse(`item ${id}: props is not an object`);
  if (!Array.isArray(item.props.nodes)) return refuse(`item ${id}: nodes is not a list`);
  const top: unknown[] = [];
  const lists = [top];
  const leaves = new Set<unknown>();
  const stack: Copy[] = item.props.nodes.map((node) => ({ node, into: top })).reverse();
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const { node, into } = next;
    if (!isRecord(node)) {
      into.push(node);
      continue;
    }
    const copy: Record<string, unknown> = {};
    for (const key of WBS_KEYS) if (node[key] !== undefined) copy[key] = node[key];
    const { children } = node;
    if (Array.isArray(children)) {
      const below: unknown[] = [];
      lists.push(below);
      copy.children = below;
      for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], into: below });
    } else if (children !== undefined) copy.children = children;
    if (children === undefined || (Array.isArray(children) && children.length === 0)) {
      leaves.add(node.id);
    }
    into.push(Object.freeze(copy));
  }
  for (const list of lists) Object.freeze(list);
  const nodes = top as readonly WbsNode[];
  return { item: Object.freeze({ kind: "wbs-pert", id, nodes }), leaves };
};

/**
 * The Trees the board computes, each mapped once, by ID: those the board's plans name and those
 * with `pert`. The first item with an ID counts.
 */
const wbsTrees = (items: readonly unknown[]): ReadonlyMap<unknown, WorkPackages> => {
  const named = new Set<unknown>();
  for (const item of items) {
    if (isRecord(item) && item.type === "gantt" && isRecord(item.props)) {
      named.add(item.props.workPackages);
    }
  }
  const trees = new Map<unknown, WorkPackages>();
  for (const item of items) {
    if (!isRecord(item) || item.type !== "tree" || typeof item.id !== "string") continue;
    const computed = named.has(item.id) || (isRecord(item.props) && item.props.pert === true);
    if (computed && !trees.has(item.id)) trees.set(item.id, workPackages(item));
  }
  return trees;
};

/**
 * A Gantt plan: each entry for a leaf of its Tree gives that task's requested start, requested
 * duration and predecessors; an entry for anything else adds nothing to the schedule, is never read,
 * and is recorded in `strays`, so that `compute`'s expansion warns of it (wbs-gantt-consistency).
 * Without its Tree there is no leaf, and the expansion warns that the work packages name no WBS.
 */
const planTasks = (
  id: string,
  props: Record<string, unknown>,
  leaves: ReadonlySet<unknown>,
): GanttPlanItem => {
  const where = `item ${id}`;
  const { tasks = {} } = props;
  if (!isRecord(tasks)) return refuse(`${where}: a plan's tasks are not a map by task ID`);
  const dependencies: [string, unknown][] = [];
  const starts: [string, unknown][] = [];
  const durations: [string, unknown][] = [];
  const strays: string[] = [];
  for (const [task, entry] of Object.entries(tasks)) {
    if (!leaves.has(task)) {
      strays.push(task);
      continue;
    }
    if (!isRecord(entry)) return refuse(`${where}: the entry of ${task} is not an object`);
    if (entry.dependencies !== undefined) dependencies.push([task, settled(entry.dependencies)]);
    if (entry.start !== undefined) starts.push([task, entry.start]);
    if (entry.duration !== undefined) durations.push([task, entry.duration]);
  }
  return Object.freeze({
    kind: "gantt-plan",
    id,
    workPackages: props.workPackages as string,
    start: props.start as string,
    dependencies: Object.freeze(Object.fromEntries(dependencies)) as GanttPlanItem["dependencies"],
    starts: Object.freeze(Object.fromEntries(starts)) as GanttPlanItem["starts"],
    durations: Object.freeze(Object.fromEntries(durations)) as GanttPlanItem["durations"],
    ...(strays.length === 0 ? {} : { strays: Object.freeze(strays) }),
  });
};

// What the table maps a board item of another type to: nothing for a type with no entry of its own
// (an inherited name such as `constructor` is none).
const sourcedItems = (
  sources: Readonly<Record<string, BoardSource>>,
  item: Record<string, unknown>,
): readonly GraphItem[] => {
  const { type } = item;
  if (typeof type !== "string" || !Object.hasOwn(sources, type)) return [];
  return (sources[type] as BoardSource)(item as BoardSourceItem);
};

/**
 * The graph source of a board's items: every Gantt, and each Tree a Gantt plan names or with
 * `pert`, in order; and, for an item of any other type, what that type's entry in `sources` maps it
 * to, in board order. A type with no entry adds nothing.
 */
export const boardGraphSource = (
  items: readonly BoardSourceItem[],
  sources: Readonly<Record<string, BoardSource>> = BOARD_SOURCES,
): GraphSource => {
  if (!Array.isArray(items)) refuse("the board's items are not a list");
  const trees = wbsTrees(items);
  const mapped = new Set<WorkPackages>();
  const source: GraphItem[] = [];
  for (const item of items as readonly unknown[]) {
    if (!isRecord(item)) return refuse("a board item is not an object");
    const tree = item.type === "tree" ? trees.get(item.id) : undefined;
    if (tree !== undefined && !mapped.has(tree)) {
      mapped.add(tree);
      source.push(tree.item);
    }
    if (item.type !== "gantt") {
      if (item.type !== "tree") source.push(...sourcedItems(sources, item));
      continue;
    }
    const id = checkId(item.id, "item", "");
    if (!isRecord(item.props)) return refuse(`item ${id}: props is not an object`);
    const { workPackages } = item.props;
    if (workPackages === undefined) source.push(ownTasks(id, item.props));
    else source.push(planTasks(id, item.props, trees.get(workPackages)?.leaves ?? new Set()));
  }
  return Object.freeze({ items: Object.freeze(source) });
};
