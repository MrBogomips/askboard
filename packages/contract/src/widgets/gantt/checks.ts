// The Gantt's checks (design decision 2): what its schemas cannot say. Which form `tasks` takes
// beside `workPackages`, the widget element ID rule for tasks and predecessors, days that exist,
// the dependents limit, a plan's link to its Tree, and what a change may set. Problems name the
// task, the plan or the operation and the field. Unknown tasks and cycles are no problem: they are
// the compute graph's warnings (AD-13), a task naming itself among them, since a self-loop is a
// cycle (task 9.1). Each check skips a part the schema refuses, so it runs on any value, except an
// operation of AD-20's other kinds, which the schema refuses without naming it. Plain ECMAScript.

import { VIEW_ID_PREFIX } from "../../constants.ts";
import type { Problem } from "../../validate.ts";
import {
  GANTT_FIRST_DATE,
  GANTT_LAST_DATE,
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MIN_DURATION,
  GANTT_PLAN_ESTIMATES,
} from "./index.ts";

/** Who wrote the value: the agent, or the view as the user edited it (AD-7, F10). */
export type GanttOrigin = "agent" | "edited";

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const daysIn = (year: number, month: number): number => {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

/**
 * A day that exists, from the Gantt's first day to its last, as a `full-date`. Exported for the
 * widget whose days are the Gantt's (latex-kanban-timeline).
 */
export const isGanttDate = (value: unknown): value is string => {
  const match = typeof value === "string" ? FULL_DATE.exec(value) : null;
  if (match === null) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const real = month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
  return real && (value as string) >= GANTT_FIRST_DATE && (value as string) <= GANTT_LAST_DATE;
};

const DAYS = `a day from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
const RESERVED = `starts with ${VIEW_ID_PREFIX}, reserved for IDs the board makes`;
const PLAN_NAMES = "a plan's tasks take their names from its Tree";

const isReserved = (id: unknown): boolean =>
  typeof id === "string" && id.startsWith(VIEW_ID_PREFIX);

/** A task's requested start and predecessors, wherever the task sits: `path` is the task's. */
const taskFieldProblems = (task: Json, id: string, path: string, origin: GanttOrigin) => {
  const problems: Problem[] = [];
  if (task.start !== undefined && typeof task.start === "string" && !isGanttDate(task.start)) {
    problems.push({
      path: `${path}/start`,
      message: `task ${id}: ${JSON.stringify(task.start)} is not ${DAYS}`,
    });
  }
  if (!Array.isArray(task.dependencies)) return problems;
  const seen = new Set<unknown>();
  for (const predecessor of task.dependencies) {
    const at = `${path}/dependencies`;
    if (seen.has(predecessor)) {
      problems.push({
        path: at,
        message: `task ${id}: predecessor ${predecessor} is listed twice`,
      });
    }
    seen.add(predecessor);
    if (origin === "agent" && isReserved(predecessor)) {
      problems.push({ path: at, message: `task ${id}: predecessor ${predecessor} ${RESERVED}` });
    }
  }
  return problems;
};

/** At most `GANTT_MAX_DEPENDENTS` tasks may list one task among their predecessors. */
const dependentsProblems = (tasks: readonly [string, string, Json][]): Problem[] => {
  const dependents = new Map<unknown, number>();
  for (const [, , task] of tasks) {
    if (!Array.isArray(task.dependencies)) continue;
    for (const predecessor of new Set(task.dependencies)) {
      dependents.set(predecessor, (dependents.get(predecessor) ?? 0) + 1);
    }
  }
  const paths = new Map(tasks.map(([id, path]) => [id, path]));
  return [...dependents]
    .filter(([, count]) => count > GANTT_MAX_DEPENDENTS)
    .map(([id, count]) => ({
      path: paths.get(id as string) ?? "/tasks",
      message: `task ${id} has ${count} dependent tasks, more than the limit of ${GANTT_MAX_DEPENDENTS}`,
    }));
};

/** A Gantt's own tasks: IDs used once, the view's prefix only in an edited value. */
const ownTaskProblems = (tasks: readonly unknown[], origin: GanttOrigin): Problem[] => {
  const problems: Problem[] = [];
  const seen = new Set<unknown>();
  const checked: [string, string, Json][] = [];
  tasks.forEach((task, index) => {
    if (!isRecord(task) || typeof task.id !== "string") return;
    const path = `/tasks/${index}`;
    if (seen.has(task.id)) {
      problems.push({ path: `${path}/id`, message: `task ID ${task.id} is used twice` });
    }
    seen.add(task.id);
    if (origin === "agent" && isReserved(task.id)) {
      problems.push({ path: `${path}/id`, message: `task ID ${task.id} ${RESERVED}` });
    }
    problems.push(...taskFieldProblems(task, task.id, path, origin));
    checked.push([task.id, path, task]);
  });
  return [...problems, ...dependentsProblems(checked)];
};

/** A task's duration, from the Gantt's least to its greatest, in whole working days. */
const durationProblem = (task: string, value: unknown): string | undefined => {
  const whole = Number.isSafeInteger(value);
  const inRange = whole && (value as number) >= GANTT_MIN_DURATION;
  if (inRange && (value as number) <= GANTT_MAX_DURATION) return undefined;
  return `task ${task}: duration takes whole working days from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION}, not ${JSON.stringify(value)}`;
};

/** A plan's entries: no name, a requested duration within range, the view's prefix only in an edited value. */
const planEntryProblems = (entries: Json, origin: GanttOrigin): Problem[] => {
  const problems: Problem[] = [];
  const checked: [string, string, Json][] = [];
  for (const [id, entry] of Object.entries(entries)) {
    if (!isRecord(entry)) continue;
    const path = `/tasks/${id}`;
    if (origin === "agent" && isReserved(id)) {
      problems.push({ path, message: `task ${id} ${RESERVED}` });
    }
    if (entry.label !== undefined) {
      problems.push({ path: `${path}/label`, message: `task ${id}: ${PLAN_NAMES}` });
    }
    const requested =
      entry.duration === undefined ? undefined : durationProblem(id, entry.duration);
    if (requested !== undefined) problems.push({ path: `${path}/duration`, message: requested });
    problems.push(...taskFieldProblems(entry, id, path, origin));
    checked.push([id, path, entry]);
  }
  return [...problems, ...dependentsProblems(checked)];
};

/** What a Gantt's props schema cannot say. */
export const ganttPropsProblems = (props: unknown, origin: GanttOrigin): readonly Problem[] => {
  if (!isRecord(props)) return [];
  const problems: Problem[] = [];
  if (props.start !== undefined && typeof props.start === "string" && !isGanttDate(props.start)) {
    problems.push({ path: "/start", message: `${JSON.stringify(props.start)} is not ${DAYS}` });
  }
  const isPlan = props.workPackages !== undefined;
  if (isPlan && Array.isArray(props.tasks)) {
    problems.push({
      path: "/tasks",
      message: "a plan's tasks are a map by task ID, its Tree giving their names and order",
    });
  } else if (!isPlan && isRecord(props.tasks)) {
    problems.push({ path: "/tasks", message: "a Gantt without workPackages lists its tasks" });
  } else if (Array.isArray(props.tasks)) {
    problems.push(...ownTaskProblems(props.tasks, origin));
  } else if (isRecord(props.tasks)) {
    problems.push(...planEntryProblems(props.tasks, origin));
  }
  return problems;
};

/**
 * A Gantt plan's link (AD-10): its `workPackages` names a Tree in its question whose columns declare
 * the three estimates as numbers. `gantt` is the plan's item, `{type, id, props}`, and `question`
 * the question that holds it; a Gantt with its own tasks has no link. Problems name the plan and
 * the item, at the plan's `/workPackages`.
 */
export const ganttPlanLinkProblems = (gantt: unknown, question: unknown): readonly Problem[] => {
  if (!isRecord(gantt) || !isRecord(gantt.props)) return [];
  const name = gantt.props.workPackages;
  if (typeof name !== "string") return [];
  const refused = (message: string): readonly Problem[] => [
    { path: "/workPackages", message: `plan ${String(gantt.id)}: ${message}` },
  ];
  const props = isRecord(question) && isRecord(question.props) ? question.props : {};
  const items: readonly unknown[] = Array.isArray(props.items) ? props.items : [];
  const item = items.find((candidate) => isRecord(candidate) && candidate.id === name);
  if (!isRecord(item)) return refused(`its work packages ${name} name no item of its question`);
  if (item.type !== "tree") {
    return refused(`its work packages ${name} name a ${String(item.type)}, not a Tree`);
  }
  const columns =
    isRecord(item.props) && Array.isArray(item.props.columns) ? item.props.columns : [];
  const declares = (field: string) =>
    columns.some(
      (column) => isRecord(column) && column.field === field && column.type === "number",
    );
  const missing = GANTT_PLAN_ESTIMATES.filter((field) => !declares(field));
  if (missing.length === 0) return [];
  return refused(
    `the Tree ${name} has no number column ${missing.join(", ")}: a plan's durations follow its estimates`,
  );
};

/** The IDs of a Gantt's own tasks, or undefined for a plan, whose tasks its Tree holds. */
const ownTaskIds = (props: unknown): ReadonlySet<unknown> | undefined => {
  if (!isRecord(props) || props.workPackages !== undefined || !Array.isArray(props.tasks)) {
    return undefined;
  }
  return new Set(props.tasks.map((task) => (isRecord(task) ? task.id : undefined)));
};

/** The fields a change may set on a task. */
const FIELDS: ReadonlySet<string> = new Set(["duration", "start", "dependencies"]);

/** AD-20's operations a Gantt never takes: it adds, removes or moves no task. */
const NOT_SET: ReadonlySet<unknown> = new Set(["add", "remove", "move"]);

const valueProblem = (
  task: string,
  field: string,
  value: unknown,
  isPlan: boolean,
): string | undefined => {
  if (field === "duration") {
    // A plan's request is cleared with null; a Gantt's own task always has its duration.
    return value === null && isPlan ? undefined : durationProblem(task, value);
  }
  if (field === "start") {
    if (value === null || isGanttDate(value)) return undefined;
    return `task ${task}: start takes ${DAYS} or null, not ${JSON.stringify(value)}`;
  }
  if (field !== "dependencies" || value === null) return undefined;
  if (!Array.isArray(value) || !value.every((id) => typeof id === "string")) {
    return `task ${task}: dependencies takes a list of task IDs or null`;
  }
  if (new Set(value).size !== value.length) return `task ${task}: a predecessor is listed twice`;
  if (value.length > GANTT_MAX_PREDECESSORS) {
    return `task ${task}: more than ${GANTT_MAX_PREDECESSORS} predecessors`;
  }
  return undefined;
};

/** What a Gantt's changes schema cannot say, against the Gantt's props, sent or edited. */
export const ganttChangesProblems = (
  itemId: string,
  changes: unknown,
  props: unknown,
): readonly Problem[] => {
  if (!Array.isArray(changes)) return [];
  const own = ownTaskIds(props);
  const isPlan = isRecord(props) && props.workPackages !== undefined;
  const problems: Problem[] = [];
  changes.forEach((change, index) => {
    if (isRecord(change) && NOT_SET.has(change.op)) {
      const kind = `${change.op === "add" ? "an" : "a"} ${change.op}`;
      problems.push({
        path: `/${index}/op`,
        message: `operation ${index} is ${kind}: a Gantt's changes are set operations only`,
      });
      return;
    }
    if (!isRecord(change) || change.op !== "set" || typeof change.target !== "string") return;
    const parts = change.target.split(".");
    const [item, task, field] = parts as [string, string, string];
    // A target of another form, or of another field, is the schema's.
    if (parts.length !== 3 || !FIELDS.has(field)) return;
    const at = `/${index}/target`;
    if (item !== itemId) {
      problems.push({
        path: at,
        message: `operation ${index} targets ${item}, not the Gantt ${itemId}`,
      });
      return;
    }
    if (own !== undefined && !own.has(task)) {
      problems.push({ path: at, message: `task ${task} is no task of the Gantt ${itemId}` });
      return;
    }
    const message = valueProblem(task, field, change.value, isPlan);
    if (message !== undefined) problems.push({ path: `/${index}/value`, message });
  });
  return problems;
};
