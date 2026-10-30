// CPM scheduling (FR-12, AD-13 "In-house computations"): a Gantt plan becomes a `fields` item whose
// tasks are its WBS's leaves, scheduled in working days by formulas over the whitelist, so the
// schedule recalculates with the rest of the graph. Dependencies are finish to start, without lag.
// Forward: earliest start is the latest earliest finish of the predecessors. Backward: latest
// finish is the earliest latest start of the successors, or the plan's finish. A task is critical
// at zero slack. Dates count working days from the first working day on or after the start.

import {
  type FieldInput,
  type Fields,
  type FieldsItem,
  type GanttPlanItem,
  type GraphChild,
  isRecord,
  refuse,
} from "./source.ts";
import type { FormulaError } from "./types.ts";

export type ExpandedPlan = {
  readonly item: FieldsItem;
  readonly warnings: readonly FormulaError[];
};

const formula = (text: string, type: FieldInput["type"] = "number"): FieldInput => ({
  type,
  formula: text,
});

const dependenciesOf = (
  plan: GanttPlanItem,
  where: string,
): ReadonlyMap<string, readonly string[]> => {
  const given: unknown = plan.dependencies ?? {};
  if (!isRecord(given)) return refuse(`${where}: dependencies is not an object`);
  const out = new Map<string, readonly string[]>();
  for (const task of Object.keys(given)) {
    const list = given[task];
    if (!Array.isArray(list) || !list.every((id) => typeof id === "string")) {
      refuse(`${where}: the dependencies of ${task} are not a list of task IDs`);
    }
    out.set(task, list as string[]);
  }
  return out;
};

const taskFields = (
  plan: string,
  wbs: string,
  task: string,
  before: readonly string[],
  after: readonly string[],
): Fields => {
  const r = (id: string, field: string): string => `[${plan}.${id}.${field}]`;
  const t = (field: string): string => r(task, field);
  const first = `[${plan}.firstDay]`;
  return {
    duration: formula(`MAX(1,ROUNDUP([${wbs}.${task}.expected],0))`),
    es: formula(before.length > 0 ? `MAX(0,${before.map((id) => r(id, "ef")).join(",")})` : "0"),
    ef: formula(`${t("es")}+${t("duration")}`),
    lf: formula(
      after.length > 0 ? `MIN(${after.map((id) => r(id, "ls")).join(",")})` : `[${plan}.finish]`,
    ),
    ls: formula(`${t("lf")}-${t("duration")}`),
    slack: formula(`${t("ls")}-${t("es")}`),
    critical: formula(`${t("slack")}=0`, "boolean"),
    startDate: formula(`WORKDAY(${first},${t("es")})`, "date"),
    finishDate: formula(`WORKDAY(${first},${t("ef")}-1)`, "date"),
  };
};

/**
 * The plan as a `fields` item. `leavesOf` gives a `wbs-pert` item's leaves, or undefined when the
 * ID names none. A dependency or work packages that name nothing are warnings, never refusals.
 */
export const expandGanttPlan = (
  plan: GanttPlanItem,
  leavesOf: (id: string) => readonly string[] | undefined,
): ExpandedPlan => {
  const where = `item ${plan.id}`;
  if (typeof plan.workPackages !== "string") refuse(`${where}: workPackages is not an item ID`);
  const dependencies = dependenciesOf(plan, where);
  const warnings: FormulaError[] = [];
  const tasks = leavesOf(plan.workPackages);
  if (tasks === undefined) {
    const detail = `the work packages ${plan.workPackages} name no WBS-with-PERT item`;
    warnings.push({ error: "missing-reference", address: `${plan.id}.workPackages`, detail });
  }
  const known = new Set(tasks ?? []);
  const successors = new Map<string, string[]>((tasks ?? []).map((task) => [task, []]));
  for (const [task, before] of dependencies) {
    // Without a WBS every task is unknown: the work packages' warning says it once.
    if (tasks === undefined) break;
    if (!known.has(task)) {
      const detail = `the dependencies name ${task}, which is no task of the plan`;
      warnings.push({ error: "missing-reference", address: `${plan.id}.${task}`, detail });
      continue;
    }
    for (const id of before) successors.get(id)?.push(task);
  }
  const children: GraphChild[] = (tasks ?? []).map((task) => ({
    id: task,
    fields: taskFields(
      plan.id,
      plan.workPackages,
      task,
      dependencies.get(task) ?? [],
      successors.get(task) ?? [],
    ),
  }));
  const fields: Fields = {
    start: { type: "date", value: plan.start },
    firstDay: formula(`WORKDAY([${plan.id}.start]-1,1)`, "date"),
    finish: formula(`MAX([${plan.id}.*.ef])`),
    finishDate: formula(`WORKDAY([${plan.id}.firstDay],[${plan.id}.finish]-1)`, "date"),
  };
  return { item: { kind: "fields", id: plan.id, fields, children }, warnings };
};
