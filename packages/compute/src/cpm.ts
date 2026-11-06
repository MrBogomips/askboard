// CPM scheduling (FR-12, AD-13 "In-house computations"): a Gantt plan becomes a `fields` item whose
// tasks are its WBS's leaves, and a Gantt with its own tasks one whose tasks are its list, both
// scheduled in working days by formulas over the whitelist, so the schedule recalculates with the
// rest of the graph. Dependencies are finish to start, without lag. Forward: earliest start is the
// latest earliest finish of the predecessors, or later when the user requested a later start.
// Backward: latest finish is the earliest latest start of the successors, or the plan's finish. A
// task is critical at zero slack. Dates count working days from the first working day on or after
// the start.

import { ID_PATTERN } from "@askboard/contract";
import { countWorkingDays, firstWorkingDay, serialOf } from "./dates.ts";
import {
  type FieldInput,
  type Fields,
  type FieldsItem,
  type GanttItem,
  type GanttPlanItem,
  type GraphChild,
  isRecord,
  listOf,
  refuse,
} from "./source.ts";
import type { FormulaError } from "./types.ts";

const ID = new RegExp(ID_PATTERN);

export type ExpandedPlan = {
  readonly item: FieldsItem;
  readonly warnings: readonly FormulaError[];
};

/** What both kinds schedule: the item, its start, and each task with its duration's input. */
type Schedule = {
  readonly id: string;
  readonly start: unknown;
  /** Undefined when the plan's work packages name no WBS: there are no tasks to schedule. */
  readonly tasks:
    | readonly {
        readonly id: string;
        readonly duration: FieldInput;
        /** A plan's task also gives the duration its estimates alone would give. */
        readonly effortDays?: FieldInput;
      }[]
    | undefined;
  readonly dependencies: ReadonlyMap<string, readonly string[]>;
  /** Each requested start, as a serial, by task ID. */
  readonly starts: ReadonlyMap<string, number>;
  readonly warnings: FormulaError[];
};

const formula = (text: string, type: FieldInput["type"] = "number"): FieldInput => ({
  type,
  formula: text,
});

const dependenciesOf = (given: unknown, where: string): ReadonlyMap<string, readonly string[]> => {
  // Absent or null is none, as compute-engine read `dependencies` before requests came.
  if (given === undefined || given === null) return new Map();
  if (!isRecord(given)) return refuse(`${where}: dependencies is not an object`);
  const out = new Map<string, readonly string[]>();
  for (const task of Object.keys(given)) {
    if (!ID.test(task)) refuse(`${where}: ${JSON.stringify(task)} in dependencies is not an ID`);
    // Task IDs become formula text: anything but an ID is refused before it gets there.
    const list = given[task];
    if (!Array.isArray(list) || !list.every((id) => typeof id === "string" && ID.test(id))) {
      refuse(`${where}: the dependencies of ${task} are not a list of task IDs`);
    }
    out.set(task, list as string[]);
  }
  return out;
};

const DATE_RANGE = "a date from 1900-03-01 to 9999-12-31";

const startsOf = (given: unknown, where: string): ReadonlyMap<string, number> => {
  if (given === undefined || given === null) return new Map();
  if (!isRecord(given)) return refuse(`${where}: starts is not an object`);
  const out = new Map<string, number>();
  for (const task of Object.keys(given)) {
    if (!ID.test(task)) refuse(`${where}: ${JSON.stringify(task)} in starts is not an ID`);
    const date = given[task];
    const serial = typeof date === "string" ? serialOf(date) : undefined;
    if (serial === undefined)
      refuse(`${where}: the requested start of ${task} is not ${DATE_RANGE}`);
    out.set(task, serial as number);
  }
  return out;
};

const isDuration = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1;

/** A plan's requested durations, by task ID: whole working days from 1. */
const durationsOf = (given: unknown, where: string): ReadonlyMap<string, number> => {
  if (given === undefined || given === null) return new Map();
  if (!isRecord(given)) return refuse(`${where}: durations is not an object`);
  const out = new Map<string, number>();
  for (const task of Object.keys(given)) {
    if (!ID.test(task)) refuse(`${where}: ${JSON.stringify(task)} in durations is not an ID`);
    const days = given[task];
    if (!isDuration(days)) {
      refuse(`${where}: the requested duration of ${task} is not a positive whole number`);
    }
    out.set(task, days as number);
  }
  return out;
};

/**
 * The working days from the plan's first working day to the first working day on or after a
 * requested start, 0 when it comes no later. It is AskBoard's own code, since no whitelisted
 * function counts working days between two dates. The offset is a number input, the task's
 * `startOffset`: a first or a cleared request adds or drops that node, so the graph is built
 * again, while a request that moves and stays is counted again and set in place by the view's
 * recalculation (gantt-widget design decision 7). Every offset counts from the plan's start,
 * which no edit changes, so none goes stale in use.
 */
const offsetOf = (planStart: unknown, requested: number): number => {
  const start = typeof planStart === "string" ? serialOf(planStart) : undefined;
  if (start === undefined) return 0;
  return Math.max(0, countWorkingDays(firstWorkingDay(start), firstWorkingDay(requested)));
};

// A task with no requested start keeps compute-engine's `es`, and its `earliest` reads it; a request
// moves the predecessors' formula to `earliest` and makes `es` the later of it and the request.
const taskFields = (
  plan: string,
  task: string,
  duration: FieldInput,
  before: readonly string[],
  after: readonly string[],
  offset: number | undefined,
): Fields => {
  const r = (id: string, field: string): string => `[${plan}.${id}.${field}]`;
  const t = (field: string): string => r(task, field);
  const first = `[${plan}.firstDay]`;
  const earliest = formula(
    before.length > 0 ? `MAX(0,${before.map((id) => r(id, "ef")).join(",")})` : "0",
  );
  const requested: Fields =
    offset === undefined
      ? { earliest: formula(t("es")), es: earliest }
      : {
          earliest,
          startOffset: { type: "number", value: offset },
          es: formula(`MAX(${t("earliest")},${t("startOffset")})`),
        };
  return {
    duration,
    ...requested,
    ef: formula(`${t("es")}+${t("duration")}`),
    lf: formula(
      after.length > 0 ? `MIN(${after.map((id) => r(id, "ls")).join(",")})` : `[${plan}.finish]`,
    ),
    ls: formula(`${t("lf")}-${t("duration")}`),
    slack: formula(`${t("ls")}-${t("es")}`),
    critical: formula(`${t("slack")}=0`, "boolean"),
    startDate: formula(`WORKDAY(${first},${t("es")})`, "date"),
    finishDate: formula(`WORKDAY(${first},${t("ef")}-1)`, "date"),
    earliestDate: formula(`WORKDAY(${first},${t("earliest")})`, "date"),
  };
};

/** The schedule as a `fields` item; a dependency that names no task is a warning, never a refusal. */
const scheduleItem = ({
  id,
  start,
  tasks,
  dependencies,
  starts,
  warnings,
}: Schedule): ExpandedPlan => {
  const known = new Set((tasks ?? []).map((task) => task.id));
  const successors = new Map<string, string[]>([...known].map((task) => [task, []]));
  const unknown = (task: string, what: string): boolean => {
    if (known.has(task)) return false;
    const detail = `the ${what} name ${task}, which is no task of the plan`;
    warnings.push({ error: "missing-reference", address: `${id}.${task}`, detail });
    return true;
  };
  // Without a WBS every task is unknown: the work packages' warning says it once.
  if (tasks !== undefined) {
    for (const [task, before] of dependencies) {
      if (unknown(task, "dependencies")) continue;
      for (const predecessor of before) successors.get(predecessor)?.push(task);
    }
    for (const task of starts.keys()) unknown(task, "requested starts");
  }
  const children: GraphChild[] = (tasks ?? []).map((task) => ({
    id: task.id,
    fields: {
      ...taskFields(
        id,
        task.id,
        task.duration,
        dependencies.get(task.id) ?? [],
        successors.get(task.id) ?? [],
        starts.has(task.id) ? offsetOf(start, starts.get(task.id) as number) : undefined,
      ),
      ...(task.effortDays === undefined ? {} : { effortDays: task.effortDays }),
    },
  }));
  const fields: Fields = {
    start: { type: "date", value: start as string },
    firstDay: formula(`WORKDAY([${id}.start]-1,1)`, "date"),
    finish: formula(`MAX([${id}.*.ef])`),
    finishDate: formula(`WORKDAY([${id}.firstDay],[${id}.finish]-1)`, "date"),
  };
  return { item: { kind: "fields", id, fields, children }, warnings };
};

/**
 * A Gantt plan as a `fields` item. `leavesOf` gives a `wbs-pert` item's leaves, or undefined when
 * the ID names none. Each task lasts its requested duration, else its expected effort rounded up
 * to whole working days.
 */
export const expandGanttPlan = (
  plan: GanttPlanItem,
  leavesOf: (id: string) => readonly string[] | undefined,
): ExpandedPlan => {
  const where = `item ${plan.id}`;
  if (typeof plan.workPackages !== "string") refuse(`${where}: workPackages is not an item ID`);
  const dependencies = dependenciesOf(plan.dependencies, where);
  const starts = startsOf(plan.starts, where);
  const durations = durationsOf(plan.durations, where);
  const warnings: FormulaError[] = [];
  const leaves = leavesOf(plan.workPackages);
  if (leaves === undefined) {
    const detail = `the work packages ${plan.workPackages} name no WBS-with-PERT item`;
    warnings.push({ error: "missing-reference", address: `${plan.id}.workPackages`, detail });
  }
  const tasks = leaves?.map((task) => {
    const effort = formula(`MAX(1,ROUNDUP([${plan.workPackages}.${task}.expected],0))`);
    const requested = durations.get(task);
    return {
      id: task,
      duration:
        requested === undefined ? effort : ({ type: "number", value: requested } as FieldInput),
      effortDays: effort,
    };
  });
  return scheduleItem({ id: plan.id, start: plan.start, tasks, dependencies, starts, warnings });
};

/** A Gantt with its own tasks as a `fields` item: each task's duration is a number input. */
export const expandGantt = (gantt: GanttItem): ExpandedPlan => {
  const where = `item ${gantt.id}`;
  const seen = new Set<string>();
  const tasks = listOf<unknown>(gantt.tasks, "tasks", where).map((task) => {
    if (!isRecord(task)) return refuse(`${where}: a task is not an object`);
    const id = task.id;
    if (typeof id !== "string" || !ID.test(id)) {
      return refuse(`${where}: task ID ${JSON.stringify(id)} is not ${ID_PATTERN}`);
    }
    if (seen.has(id)) refuse(`${where}: task ID ${id} is used twice`);
    seen.add(id);
    if (!isDuration(task.duration)) {
      refuse(`${where}: the duration of ${id} is not a positive whole number`);
    }
    return { id, duration: { type: "number", value: task.duration as number } as FieldInput };
  });
  const dependencies = dependenciesOf(gantt.dependencies, where);
  const starts = startsOf(gantt.starts, where);
  return scheduleItem({
    id: gantt.id,
    start: gantt.start,
    tasks,
    dependencies,
    starts,
    warnings: [],
  });
};
