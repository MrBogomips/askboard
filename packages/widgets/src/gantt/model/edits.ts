// The user's edits of a Gantt's own tasks (design decision 8, AD-20): each takes the Gantt as it
// stands and as the agent sent it, and gives a new frozen value, or the same value when nothing
// changes, since the draft record compares values by identity. A field that comes back to the
// agent's value takes it again, and is left out when the agent sent none; an empty predecessor
// list is left out. So an edit undone by hand gives no change, and `sameGantt` tells the component
// to hold no draft value. Every result is valid as an edited value and diffs to `set`s only.
// A plan's entries come in task 7.6. Plain ECMAScript: no DOM, no `Date`.

import {
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MIN_DURATION,
  type GanttOwnTask,
  ID_PATTERN,
} from "@askboard/contract";
import { isGanttDate } from "./date.ts";
import type { GanttOwnProps } from "./tasks.ts";

type Field = "start" | "duration" | "dependencies";

const ID = new RegExp(ID_PATTERN);

/** Two JSON values alike; a key holding undefined reads as absent. */
const sameJson = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((element, index) => sameJson(element, b[index]));
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => sameJson(left[key], right[key]));
};

/** Predecessor lists alike as sets: their order does not schedule, and absent is empty. */
const samePredecessors = (a: unknown, b: unknown): boolean => {
  const left = new Set(Array.isArray(a) ? a : []);
  const right = new Set(Array.isArray(b) ? b : []);
  return left.size === right.size && [...left].every((id) => right.has(id));
};

const sameField = (field: Field, a: unknown, b: unknown): boolean =>
  field === "dependencies" ? samePredecessors(a, b) : Object.is(a, b);

const indexOfTask = (value: GanttOwnProps, taskId: string): number => {
  const index = value.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) throw new RangeError(`the Gantt has no task ${JSON.stringify(taskId)}`);
  return index;
};

/** The task with one field changed, left out when undefined; the keys in the contract's order. */
const taskWith = (task: GanttOwnTask, field: Field, next: unknown): GanttOwnTask => {
  const fields: Record<Field, unknown> = {
    start: task.start,
    duration: task.duration,
    dependencies: task.dependencies,
  };
  fields[field] = next;
  const { start, duration, dependencies } = fields as Pick<GanttOwnTask, Field>;
  return Object.freeze({
    id: task.id,
    label: task.label,
    duration,
    ...(start === undefined ? {} : { start }),
    ...(dependencies === undefined ? {} : { dependencies }),
  });
};

/** Sets one field of one task to `wanted`, undefined for none. */
const edit = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
  field: Field,
  wanted: unknown,
): GanttOwnProps => {
  const index = indexOfTask(value, taskId);
  const task = value.tasks[index] as GanttOwnTask;
  if (sameField(field, task[field], wanted)) return value;
  const sentTask = sent.tasks.find((candidate) => candidate.id === taskId);
  // Back to the agent's value: the agent's own, or none when it sent none.
  const back = sentTask !== undefined && sameField(field, sentTask[field], wanted);
  const edited = taskWith(task, field, back ? sentTask[field] : wanted);
  const tasks = value.tasks.with(
    index,
    sameJson(edited, sentTask) ? (sentTask as GanttOwnTask) : edited,
  );
  return Object.freeze({ ...value, tasks: Object.freeze(tasks) });
};

/** Asks for a task to start on a day, or as soon after as its predecessors allow. */
export const requestStart = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
  date: string,
): GanttOwnProps => {
  if (!isGanttDate(date)) {
    throw new RangeError(`${JSON.stringify(date)} is no day a Gantt may name`);
  }
  return edit(value, sent, taskId, "start", date);
};

/** Clears a task's requested start: it starts as early as its predecessors allow. */
export const clearStart = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
): GanttOwnProps => edit(value, sent, taskId, "start", undefined);

/** Sets a task's duration, in whole working days. */
export const setDuration = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
  duration: number,
): GanttOwnProps => {
  const whole = Number.isSafeInteger(duration);
  if (!whole || duration < GANTT_MIN_DURATION || duration > GANTT_MAX_DURATION) {
    throw new RangeError(
      `a duration takes whole working days from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION}, not ${duration}`,
    );
  }
  return edit(value, sent, taskId, "duration", duration);
};

/** How many tasks list each task among their predecessors. */
const dependentCounts = (value: GanttOwnProps): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const task of value.tasks) {
    for (const id of new Set(task.dependencies ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

/**
 * Sets a task's predecessors, each kept once, in the order given; none leaves the field out. A
 * task is refused as its own predecessor, as a name that is no ID, and past the predecessor or
 * the dependents limit: `canPrecede` tells the panel which tasks to offer.
 */
export const setPredecessors = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
  predecessors: readonly string[],
): GanttOwnProps => {
  const list = [...new Set(predecessors)];
  for (const id of list) {
    if (typeof id !== "string" || !ID.test(id)) {
      throw new RangeError(`the predecessor ${JSON.stringify(id)} is no task ID`);
    }
    if (id === taskId) throw new RangeError(`task ${taskId} cannot precede itself`);
  }
  if (list.length > GANTT_MAX_PREDECESSORS) {
    throw new RangeError(`task ${taskId}: more than ${GANTT_MAX_PREDECESSORS} predecessors`);
  }
  const next = edit(
    value,
    sent,
    taskId,
    "dependencies",
    list.length === 0 ? undefined : Object.freeze(list),
  );
  const counts = dependentCounts(next);
  const over = list.find((id) => (counts.get(id) ?? 0) > GANTT_MAX_DEPENDENTS);
  if (over !== undefined) {
    throw new RangeError(`task ${over}: more than ${GANTT_MAX_DEPENDENTS} dependent tasks`);
  }
  return next;
};

/** Whether the Gantt is the agent's value again: the component then holds no draft value. */
export const sameGantt = (value: GanttOwnProps, sent: GanttOwnProps): boolean =>
  sameJson(value, sent);

export type Precedence = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const OK: Precedence = Object.freeze({ ok: true });

const refused = (reason: string): Precedence => Object.freeze({ ok: false, reason });

/** The tasks that depend on a task, directly or through others: a walk over the predecessors. */
const dependentsOf = (value: GanttOwnProps, taskId: string): ReadonlySet<string> => {
  const successors = new Map<string, string[]>();
  for (const task of value.tasks) {
    for (const id of task.dependencies ?? []) {
      const list = successors.get(id);
      if (list === undefined) successors.set(id, [task.id]);
      else list.push(task.id);
    }
  }
  const reached = new Set<string>();
  const queue = [taskId];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    for (const next of successors.get(id) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
};

// One walk per Gantt value and task, since the panel asks for every other task in turn.
const WALKS = new WeakMap<GanttOwnProps, Map<string, ReadonlySet<string>>>();

const walkFrom = (value: GanttOwnProps, taskId: string): ReadonlySet<string> => {
  let walks = WALKS.get(value);
  if (walks === undefined) {
    walks = new Map();
    WALKS.set(value, walks);
  }
  let reached = walks.get(taskId);
  if (reached === undefined) {
    reached = dependentsOf(value, taskId);
    walks.set(taskId, reached);
  }
  return reached;
};

/**
 * Whether the predecessors panel may check `candidate` for `task`, or why not: it would close a
 * cycle, or break the predecessor or the dependents limit. A predecessor already listed may stay.
 */
export const canPrecede = (
  value: GanttOwnProps,
  taskId: string,
  candidateId: string,
): Precedence => {
  const task = value.tasks[indexOfTask(value, taskId)] as GanttOwnTask;
  const candidate = value.tasks[indexOfTask(value, candidateId)] as GanttOwnTask;
  if (candidateId === taskId) return refused(`${task.label} cannot come before itself`);
  const listed = task.dependencies ?? [];
  if (listed.includes(candidateId)) return OK;
  if (walkFrom(value, taskId).has(candidateId)) {
    return refused(`${candidate.label} already depends on ${task.label}`);
  }
  if (listed.length >= GANTT_MAX_PREDECESSORS) {
    return refused(
      `${task.label} already has ${GANTT_MAX_PREDECESSORS} predecessors, the most a task can have`,
    );
  }
  if ((dependentCounts(value).get(candidateId) ?? 0) >= GANTT_MAX_DEPENDENTS) {
    return refused(
      `${candidate.label} already has ${GANTT_MAX_DEPENDENTS} dependent tasks, the most a task can have`,
    );
  }
  return OK;
};
