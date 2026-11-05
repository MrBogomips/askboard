// The shipped definitions through `ask-core`'s expansion (molecules spec, "The WBS with PERT's
// expansion", modified "The Gantt plan's expansion"): what the approved UJ-2 ask becomes with the
// definitions AskBoard ships, served by this adapter, and a plan over a plain Tree.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ganttPlanLinkProblems } from "@askboard/contract";
import { ganttPlanBoardDocument, uj2ExpandedQuestion } from "@askboard/contract/fixtures";
import { validateGanttProps } from "@askboard/contract/validate";
import { type Expansion, expandMolecules } from "@askboard/core";
import { createMoleculeSource } from "./index.ts";

type Json = Record<string, unknown>;
type Item = { readonly type: string; readonly id: string; readonly props: Json };

// The approved examples, as E1's task 3.1 copied them into the contract's tests.
const ask = (await Bun.file(
  join(import.meta.dir, "../../../contract/test/fixtures/asks/uj2-wbs-gantt.json"),
).json()) as { readonly items: readonly Item[] };

const [planQuestion, erpExport] = ask.items;
const [, schedule] = (planQuestion?.props.items ?? []) as readonly (Item & {
  readonly props: {
    readonly data: Json & { readonly dependencies: Readonly<Record<string, string[]>> };
  };
})[];
if (schedule === undefined) throw new Error("the UJ-2 ask has no schedule reference");

const expanded = (result: Expansion) => {
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result;
};

const source = createMoleculeSource();

describe("the approved UJ-2 ask through the shipped definitions", () => {
  test("gives uj2ExpandedQuestion exactly, erp-export unchanged", () => {
    const before = structuredClone(ask);
    const result = expanded(expandMolecules(ask.items, source));
    const [question, other] = result.items;
    expect(question).toEqual(uj2ExpandedQuestion);
    expect(other).toBe(erpExport);
    expect([...result.map]).toEqual([
      ["wbs__tree", { reference: "wbs", molecule: "wbs-pert", version: "1.0.0" }],
      ["schedule__plan", { reference: "schedule", molecule: "gantt-plan", version: "1.0.0" }],
    ]);
    expect(ask).toEqual(before);
  });
});

describe("a Gantt plan over a plain Tree", () => {
  const [question] = ganttPlanBoardDocument.items;
  const [tree, plan] = question.props.items;
  const asked = (data: Json) => ({
    ...question,
    props: {
      ...question.props,
      items: [tree, { ...schedule, props: { ...schedule.props, data } }],
    },
  });

  test("keeps workPackages wbs and passes its link check", () => {
    const result = expanded(expandMolecules([asked(schedule.props.data)], source));
    const [expandedQuestion] = result.items as readonly (typeof question)[];
    const [kept, expandedPlan] = expandedQuestion?.props.items ?? [];
    expect(kept).toBe(tree);
    expect(expandedPlan).toEqual({ ...plan, id: "schedule__plan" });
    expect(expandedPlan?.props).toMatchObject({ workPackages: "wbs" });
    if (expandedPlan?.type !== "gantt" || expandedQuestion === undefined)
      throw new Error("no plan");
    expect(validateGanttProps(expandedPlan.props, "agent")).toEqual({
      ok: true,
      value: expandedPlan.props,
    });
    expect(ganttPlanLinkProblems(expandedPlan, expandedQuestion)).toEqual([]);
  });

  /** The expanded plan's props, from the question `asked(data)` gives. */
  const planProps = (data: Json) => {
    const result = expanded(expandMolecules([asked(data)], source));
    const [expandedQuestion] = result.items as readonly (typeof question)[];
    return expandedQuestion?.props.items[1]?.props as Json & { readonly tasks: Json };
  };

  test("gives an empty plan for data without dependencies, sharing no list with the data", () => {
    const { dependencies, ...bare } = schedule.props.data;
    expect(planProps(bare)).toEqual({ workPackages: "wbs", start: "2026-11-02", tasks: {} });
    const { tasks } = planProps(schedule.props.data);
    expect(tasks.portal).toEqual({ dependencies: ["architecture", "prototype"] });
    expect((tasks.portal as Json).dependencies).not.toBe(dependencies.portal);
  });
});
