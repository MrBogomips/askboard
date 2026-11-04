// The rules that carry a Tree's edits into the Gantt plans over it (molecules design decision 12;
// F20; view spec, "An added package's predecessors", "Deleting a package with dependents"), with
// a pert Tree or without: they belong to the link. A package the user adds gets the predecessors
// of the package it was added after, or under; deleting packages connects each task that depended
// on them to their own predecessors, and sets their entries back to the agent's. The plans are read
// board-wide, as the Gantt's own `linkedTree` reads the link, each with the value the board shows
// for it (design decision 11). Every write goes through the Gantt model's `setPredecessors`, so the
// plan's invariants have one implementation; a write that would take a plan past a limit is
// refused, naming it, and never throws (review L8). Plain ECMAScript.

import {
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  type GanttPlanEntry,
} from "@askboard/contract";
import type { BoardContent } from "@askboard/view/catalog";
import { sameGantt, setPredecessors } from "../gantt/model/edits.ts";
import { type GanttPlanProps, planEntry } from "../gantt/model/tasks.ts";

/** A plan over a Tree: its item's ID, the value the board shows for it, and its props as sent. */
export type LinkedPlan = {
  readonly id: string;
  readonly value: GanttPlanProps;
  readonly sent: GanttPlanProps;
};

/** The plan limit a linked write would pass. */
export type PlanLimit = "predecessors" | "dependents" | "entries";

/** A linked write refused: the limit, the most it allows, and the task past it, if one is. */
export type PlanRefusal = {
  readonly ok: false;
  readonly limit: PlanLimit;
  readonly most: number;
  readonly taskId?: string;
};

/** The plans' values after a linked edit, by plan ID, `undefined` for a plan as sent again. */
export type LinkedValues = {
  readonly ok: true;
  readonly values: Readonly<Record<string, GanttPlanProps | undefined>>;
};

/** A linked write: the plan after it, or its refusal. */
export type PlanEdit = { readonly ok: true; readonly plan: GanttPlanProps } | PlanRefusal;

const MOST: Readonly<Record<PlanLimit, number>> = {
  predecessors: GANTT_MAX_PREDECESSORS,
  dependents: GANTT_MAX_DEPENDENTS,
  entries: GANTT_MAX_TASKS,
};

const done = (plan: GanttPlanProps): PlanEdit => Object.freeze({ ok: true, plan });

const refused = (limit: PlanLimit, taskId?: string): PlanRefusal =>
  Object.freeze(
    taskId === undefined
      ? { ok: false, limit, most: MOST[limit] }
      : { ok: false, limit, most: MOST[limit], taskId },
  );

const isPlanOf = (props: unknown, treeId: string): boolean =>
  typeof props === "object" &&
  props !== null &&
  (props as { readonly workPackages?: unknown }).workPackages === treeId;

/** Every Gantt plan on the board naming the Tree `treeId`, in the board's order. */
export const linkedPlans = (
  board: Pick<BoardContent, "items" | "shown">,
  treeId: string,
): readonly LinkedPlan[] =>
  Object.freeze(
    board.items
      .filter((item) => item.type === "gantt" && isPlanOf(item.props, treeId))
      .map((item) => {
        const sent = item.props as GanttPlanProps;
        const value = (board.shown.get(item.id) as GanttPlanProps | undefined) ?? sent;
        return Object.freeze({ id: item.id, value, sent });
      }),
  );

/** A package's predecessors in the plan: its entry's dependencies, or none. */
export const predecessorsOf = (plan: GanttPlanProps, packageId: string): readonly string[] =>
  planEntry(plan, packageId)?.dependencies ?? [];

// The first limit `tasks` would pass once each task of `changed` holds its list in place of its
// entry's: a changed task's predecessors, then the dependents of a task a changed list or `named`
// names, then the entries, counted as a new entry for a changed task that holds none and gets a
// list.
const limitPassed = (
  tasks: Readonly<Record<string, GanttPlanEntry>>,
  changed: ReadonlyMap<string, readonly string[]>,
  named: readonly string[] = [],
): PlanRefusal | undefined => {
  for (const [taskId, list] of changed) {
    if (list.length > GANTT_MAX_PREDECESSORS) return refused("predecessors", taskId);
  }
  const lists = new Map(Object.entries(tasks).map(([id, entry]) => [id, entry.dependencies ?? []]));
  for (const [taskId, list] of changed) lists.set(taskId, list);
  const counts = new Map<string, number>();
  for (const list of lists.values()) {
    for (const id of new Set(list)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const list of [...changed.values(), named]) {
    const over = list.find((id) => (counts.get(id) ?? 0) > GANTT_MAX_DEPENDENTS);
    if (over !== undefined) return refused("dependents", over);
  }
  const added = [...changed].filter(([id, list]) => list.length > 0 && !Object.hasOwn(tasks, id));
  return Object.keys(tasks).length + added.length > GANTT_MAX_TASKS
    ? refused("entries")
    : undefined;
};

/**
 * The plan once the package `added` is named in its Tree after, or under, the package `anchor`: the
 * added package gets the anchor's predecessors, never itself; none when the anchor has none.
 */
export const afterAdd = (
  plan: GanttPlanProps,
  sentPlan: GanttPlanProps,
  added: string,
  anchor: string,
): PlanEdit => {
  const list = predecessorsOf(plan, anchor).filter((id) => id !== added);
  const refusal = limitPassed(plan.tasks, new Map([[added, list]]));
  return refusal ?? done(setPredecessors(plan, sentPlan, added, list));
};

/** The tasks of the plans outside `packageIds` that list any of them, each once, in order. */
export const dependentsOf = (
  plans: readonly GanttPlanProps[],
  packageIds: readonly string[],
): readonly string[] => {
  const gone = new Set(packageIds);
  const found = new Set<string>();
  for (const plan of plans) {
    for (const [id, entry] of Object.entries(plan.tasks)) {
      if (!gone.has(id) && (entry.dependencies ?? []).some((name) => gone.has(name))) found.add(id);
    }
  }
  return Object.freeze([...found]);
};

// `list` with each deleted package replaced by its predecessors in the plan, followed through
// other deleted packages, each kept once in its first place; a stand-in is never the task `self`.
const reconnected = (
  plan: GanttPlanProps,
  gone: ReadonlySet<string>,
  list: readonly string[],
  self: string,
): readonly string[] => {
  const kept = new Set<string>();
  const followed = new Set<string>();
  const walk = (ids: readonly string[], standIns: boolean): void => {
    for (const id of ids) {
      if (!gone.has(id)) {
        if (!standIns || id !== self) kept.add(id);
      } else if (!followed.has(id)) {
        followed.add(id);
        walk(predecessorsOf(plan, id), true);
      }
    }
  };
  walk(list, false);
  return [...kept];
};

// The plan with each deleted package's entry the agent's again: the agent's own entry, in place
// or last, or none when the agent sent none.
const withEntriesBack = (
  plan: GanttPlanProps,
  sentPlan: GanttPlanProps,
  gone: ReadonlySet<string>,
): GanttPlanProps => {
  const entries = Object.entries(plan.tasks).flatMap(([id, entry]): [string, GanttPlanEntry][] => {
    if (!gone.has(id)) return [[id, entry]];
    const agent = planEntry(sentPlan, id);
    return agent === undefined ? [] : [[id, agent]];
  });
  for (const id of gone) {
    const agent = planEntry(sentPlan, id);
    if (agent !== undefined && !Object.hasOwn(plan.tasks, id)) entries.push([id, agent]);
  }
  const same =
    entries.length === Object.keys(plan.tasks).length &&
    entries.every(([id, entry]) => planEntry(plan, id) === entry);
  return same
    ? plan
    : Object.freeze({ ...plan, tasks: Object.freeze(Object.fromEntries(entries)) });
};

/**
 * The plan once the packages `deleted` leave its Tree, a deleted branch's every package listed:
 * each other task that names one is connected to its predecessors instead (`reconnected`), and each
 * deleted package's entry is set back to the agent's. The entries go back first, so that no write
 * counts a dependent the result does not hold.
 */
export const afterDelete = (
  plan: GanttPlanProps,
  sentPlan: GanttPlanProps,
  deleted: readonly string[],
): PlanEdit => {
  const gone = new Set(deleted);
  const changed = new Map<string, readonly string[]>();
  for (const [id, entry] of Object.entries(plan.tasks)) {
    const list = entry.dependencies ?? [];
    if (!gone.has(id) && list.some((name) => gone.has(name))) {
      changed.set(id, reconnected(plan, gone, list, id));
    }
  }
  const back = withEntriesBack(plan, sentPlan, gone);
  // The agent's entries put back may name a task the user has given dependents since.
  const named = [...gone].flatMap((id) => predecessorsOf(back, id));
  const refusal = limitPassed(back.tasks, changed, named);
  if (refusal !== undefined) return refusal;
  let next = back;
  for (const [taskId, list] of changed) next = setPredecessors(next, sentPlan, taskId, list);
  return done(next);
};

/**
 * The values a linked edit gives the plans over a Tree, by plan ID, as one draft update: each plan
 * `edit` changes, its edited value, or `undefined` once it is its props as sent again (`sameGantt`);
 * a plan it leaves as the board shows it is not named. A refusal of any plan's edit refuses the
 * whole edit, so that a linked edit is whole or not at all (design decision 11; review L8).
 */
export const linkedEdit = (
  plans: readonly LinkedPlan[],
  edit: (plan: LinkedPlan) => PlanEdit,
): LinkedValues | PlanRefusal => {
  const values: Record<string, GanttPlanProps | undefined> = {};
  for (const plan of plans) {
    const edited = edit(plan);
    if (!edited.ok) return edited;
    if (sameGantt(edited.plan, plan.value)) continue;
    values[plan.id] = sameGantt(edited.plan, plan.sent) ? undefined : edited.plan;
  }
  return Object.freeze({ ok: true, values: Object.freeze(values) });
};
