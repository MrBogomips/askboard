// The computed item kinds become `fields` items before the graph is indexed: every `wbs-pert`
// item first, since a Gantt plan reads its WBS's leaves, wherever the WBS sits in the source.

import { expandGantt, expandGanttPlan } from "../cpm.ts";
import { expandWbsPert, wbsLeaves } from "../pert.ts";
import type { FieldsItem, GraphItem } from "../source.ts";
import type { FormulaError } from "../types.ts";

export type Expanded = {
  readonly items: readonly FieldsItem[];
  readonly warnings: readonly FormulaError[];
};

export const expandItems = (items: readonly GraphItem[]): Expanded => {
  const wbs = new Map<string, FieldsItem>();
  for (const item of items) if (item.kind === "wbs-pert") wbs.set(item.id, expandWbsPert(item));
  const leavesOf = (id: string): readonly string[] | undefined => {
    const expanded = wbs.get(id);
    return expanded === undefined ? undefined : wbsLeaves(expanded);
  };
  const warnings: FormulaError[] = [];
  const expanded = items.map((item): FieldsItem => {
    if (item.kind === "fields") return item;
    if (item.kind === "wbs-pert") return wbs.get(item.id) as FieldsItem;
    const plan = item.kind === "gantt" ? expandGantt(item) : expandGanttPlan(item, leavesOf);
    warnings.push(...plan.warnings);
    return plan.item;
  });
  return { items: expanded, warnings };
};
