// The user's edits of a Gantt (design decision 8, AD-20), of its own tasks or of a plan's
// entries: each takes the Gantt as it stands and as the agent sent it, and gives a new frozen
// value, or the same value when nothing changes, since the draft record compares values by
// identity. A field that comes back to the agent's value takes it again, and is left out when the
// agent sent none; an empty predecessor list is left out. A plan's entry is created by its first
// field and deleted once it holds none, unless the agent sent it empty; a plan's durations follow
// its Tree, so only a Gantt's own tasks take `setDuration`. So an edit undone by hand gives no
// change, and `sameGantt` tells the component to hold no draft value. Every result is valid as an
// edited value and diffs to `set`s only, with `GANTT_SHAPE` or `GANTT_PLAN_SHAPE`. Plain
// ECMAScript: no DOM, no `Date`.

import {
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_MIN_DURATION,
  type GanttOwnTask,
  type GanttPlanEntry,
  type GanttProps,
  ID_PATTERN,
} from "@askboard/contract";
import { isGanttDate } from "./date.ts";
import {
  type GanttOwnProps,
  type GanttPlanProps,
  type GanttRow,
  isOwnGantt,
  planEntry,
} from "./tasks.ts";

type Field = "start" | "duration" | "dependencies";

/** The fields of a plan's entry, and those both kinds of Gantt share. */
type EntryField = Exclude<Field, "duration">;

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

/** Sets one field of one of a Gantt's own tasks to `wanted`, undefined for none. */
const editTask = (
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

/** The entry with one field changed, left out when undefined; the keys in the contract's order. */
const entryWith = (
  entry: GanttPlanEntry | undefined,
  field: EntryField,
  next: unknown,
): GanttPlanEntry => {
  const fields: Record<EntryField, unknown> = {
    start: entry?.start,
    dependencies: entry?.dependencies,
  };
  fields[field] = next;
  const { start, dependencies } = fields as GanttPlanEntry;
  return Object.freeze({
    ...(start === undefined ? {} : { start }),
    ...(dependencies === undefined ? {} : { dependencies }),
  });
};

/**
 * Sets one field of a plan's entry for a task to `wanted`, undefined for none. The entry keeps its
 * place among the others; a new one comes last. Any ID names an own key, `__proto__` included.
 */
const editEntry = (
  value: GanttPlanProps,
  sent: GanttPlanProps,
  taskId: string,
  field: EntryField,
  wanted: unknown,
): GanttPlanProps => {
  if (!ID.test(taskId)) throw new RangeError(`${JSON.stringify(taskId)} is no task ID`);
  const entry = planEntry(value, taskId);
  if (sameField(field, entry?.[field], wanted)) return value;
  if (entry === undefined && Object.keys(value.tasks).length >= GANTT_MAX_TASKS) {
    throw new RangeError(`the plan already holds ${GANTT_MAX_TASKS} entries, the most it can`);
  }
  const agent = planEntry(sent, taskId);
  // Back to the agent's value: the agent's own, or none when it sent none.
  const back = agent !== undefined && sameField(field, agent[field], wanted);
  const edited = entryWith(entry, field, back ? agent[field] : wanted);
  // Back to the agent's entry: the agent's own; else an entry left with no field is none.
  const empty = Object.keys(edited).length === 0;
  const next = agent !== undefined && sameJson(edited, agent) ? agent : empty ? undefined : edited;
  const entries = Object.entries(value.tasks);
  const at = entries.findIndex(([id]) => id === taskId);
  const kept: [string, GanttPlanEntry][] = next === undefined ? [] : [[taskId, next]];
  const tasks = at < 0 ? [...entries, ...kept] : entries.toSpliced(at, 1, ...kept);
  return Object.freeze({ ...value, tasks: Object.freeze(Object.fromEntries(tasks)) });
};

/** Sets one field of one task, a Gantt's own or a plan's entry, beside the agent's of its kind. */
const edit = <V extends GanttProps>(
  value: V,
  sent: V,
  taskId: string,
  field: EntryField,
  wanted: unknown,
): V => {
  const own = isOwnGantt(value);
  if (own !== isOwnGantt(sent)) {
    throw new RangeError("a Gantt's edit takes its value and the agent's of one kind");
  }
  const next = own
    ? editTask(value, sent as GanttOwnProps, taskId, field, wanted)
    : editEntry(value as GanttPlanProps, sent as GanttPlanProps, taskId, field, wanted);
  return next as V;
};

/** Asks for a task to start on a day, or as soon after as its predecessors allow. */
export const requestStart = <V extends GanttProps>(
  value: V,
  sent: V,
  taskId: string,
  date: string,
): V => {
  if (!isGanttDate(date)) {
    throw new RangeError(`${JSON.stringify(date)} is no day a Gantt may name`);
  }
  return edit(value, sent, taskId, "start", date);
};

/** Clears a task's requested start: it starts as early as its predecessors allow. */
export const clearStart = <V extends GanttProps>(value: V, sent: V, taskId: string): V =>
  edit(value, sent, taskId, "start", undefined);

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
  return editTask(value, sent, taskId, "duration", duration);
};

/** How many tasks list each task among their predecessors; in a plan, every entry counts. */
const dependentCounts = (value: GanttProps): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  const tasks = isOwnGantt(value) ? value.tasks : Object.values(value.tasks);
  for (const task of tasks) {
    for (const id of new Set(task.dependencies ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

/** The predecessors a task holds now, a Gantt's own task's or a plan entry's; none when absent. */
const heldPredecessors = (value: GanttProps, taskId: string): readonly string[] => {
  if (!isOwnGantt(value)) return planEntry(value, taskId)?.dependencies ?? [];
  return value.tasks.find((task) => task.id === taskId)?.dependencies ?? [];
};

/**
 * Sets a task's predecessors, each kept once, in the order given; none leaves the field out. A
 * name that is no ID is refused, and so are a list past the predecessor limit and a task past
 * the dependents limit: `canPrecede` tells the panel which tasks to offer. A task is refused as
 * its own predecessor unless it holds itself already: the contract accepts the self-loop the
 * agent may send, a cycle `compute` reports, so the panel commits it as it holds it (design
 * decision 2, task 9.1); the user never adds one.
 */
export const setPredecessors = <V extends GanttProps>(
  value: V,
  sent: V,
  taskId: string,
  predecessors: readonly string[],
): V => {
  const list = [...new Set(predecessors)];
  for (const id of list) {
    if (typeof id !== "string" || !ID.test(id)) {
      throw new RangeError(`the predecessor ${JSON.stringify(id)} is no task ID`);
    }
  }
  if (list.includes(taskId) && !heldPredecessors(value, taskId).includes(taskId)) {
    throw new RangeError(`task ${taskId} cannot precede itself`);
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
export const sameGantt = (value: GanttProps, sent: GanttProps): boolean => sameJson(value, sent);

export type Precedence = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const OK: Precedence = Object.freeze({ ok: true });

const refused = (reason: string): Precedence => Object.freeze({ ok: false, reason });

/** The rows by task ID, the first row of an ID kept. */
const rowsById = (rows: readonly GanttRow[]): ReadonlyMap<string, GanttRow> => {
  const byId = new Map<string, GanttRow>();
  for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
  return byId;
};

/** A task's row; a task that is no row is refused. */
const rowOf = (byId: ReadonlyMap<string, GanttRow>, taskId: string): GanttRow => {
  const row = byId.get(taskId);
  if (row === undefined) throw new RangeError(`the Gantt has no task ${JSON.stringify(taskId)}`);
  return row;
};

/**
 * The tasks that depend on a task, directly or through others: a walk over the rows'
 * predecessors. In a plan, an entry that names no leaf is no row, and the graph holds no such
 * task, so the walk never goes through it.
 */
const dependentsOf = (rows: readonly GanttRow[], taskId: string): ReadonlySet<string> => {
  const successors = new Map<string, string[]>();
  for (const row of rows) {
    for (const id of row.dependencies) {
      const list = successors.get(id);
      if (list === undefined) successors.set(id, [row.id]);
      else list.push(row.id);
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

// One walk per rows list and task, since the panel asks for every other task in turn.
const WALKS = new WeakMap<readonly GanttRow[], Map<string, ReadonlySet<string>>>();

const walkFrom = (rows: readonly GanttRow[], taskId: string): ReadonlySet<string> => {
  let walks = WALKS.get(rows);
  if (walks === undefined) {
    walks = new Map();
    WALKS.set(rows, walks);
  }
  let reached = walks.get(taskId);
  if (reached === undefined) {
    reached = dependentsOf(rows, taskId);
    walks.set(taskId, reached);
  }
  return reached;
};

/**
 * `canPrecede` over one Gantt and its rows, for any task and candidate: the rows by ID and the
 * dependents counted once, so that a panel asking for every other task in turn counts them once.
 */
export const precedenceIn = (
  value: GanttProps,
  rows: readonly GanttRow[],
): ((taskId: string, candidateId: string) => Precedence) => {
  const byId = rowsById(rows);
  const dependents = dependentCounts(value);
  return (taskId, candidateId) => {
    const task = rowOf(byId, taskId);
    const candidate = rowOf(byId, candidateId);
    if (candidateId === taskId) return refused(`${task.label} cannot come before itself`);
    const listed = task.dependencies;
    if (listed.includes(candidateId)) return OK;
    if (walkFrom(rows, taskId).has(candidateId)) {
      return refused(`${candidate.label} already depends on ${task.label}`);
    }
    if (listed.length >= GANTT_MAX_PREDECESSORS) {
      return refused(
        `${task.label} already has ${GANTT_MAX_PREDECESSORS} predecessors, the most a task can have`,
      );
    }
    if ((dependents.get(candidateId) ?? 0) >= GANTT_MAX_DEPENDENTS) {
      return refused(
        `${candidate.label} already has ${GANTT_MAX_DEPENDENTS} dependent tasks, the most a task can have`,
      );
    }
    return OK;
  };
};

/**
 * Whether the predecessors panel may check `candidate` for `task`, or why not: it would close a
 * cycle, or break the predecessor or the dependents limit. `rows` are the Gantt's tasks as the
 * grid shows them, a plan's its Tree's leaves, which name the tasks and give their predecessors;
 * the dependents are counted over every task of `value`, every entry of a plan, as
 * `setPredecessors` counts them. A predecessor already listed may stay.
 */
export const canPrecede = (
  value: GanttProps,
  rows: readonly GanttRow[],
  taskId: string,
  candidateId: string,
): Precedence => precedenceIn(value, rows)(taskId, candidateId);
