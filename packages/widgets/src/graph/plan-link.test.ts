import { describe, expect, test } from "bun:test";
import {
  elementChanges,
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_PLAN_SHAPE,
  type GanttPlanEntry,
} from "@askboard/contract";
import { uj2ExpandedBoardDocument, uj2ExpandedEditedValues } from "@askboard/contract/fixtures";
import type { BoardContent, BoardWidgetItem } from "@askboard/view/catalog";
import { sameGantt } from "../gantt/model/edits.ts";
import type { GanttPlanProps } from "../gantt/model/tasks.ts";
import {
  afterAdd,
  afterDelete,
  dependentsOf,
  linkedPlans,
  type PlanEdit,
  predecessorsOf,
} from "./plan-link.ts";

// The expanded UJ-2 board (molecules design decision 9): the WBS `wbs__tree` and the plan
// `schedule__plan` over it, whose entries are prototype [ux], portal [architecture, prototype],
// billing [architecture] and reporting [portal].
const [question] = uj2ExpandedBoardDocument.items;
const [WBS, PLAN] = question.props.items;
const TREE = WBS.id;
const SENT = PLAN.props as GanttPlanProps;

const board = (
  shown: ReadonlyMap<string, unknown>,
  items: readonly BoardWidgetItem[] = [WBS, PLAN],
): BoardContent => ({
  items,
  draft: shown,
  shown,
});

// The plan with `tasks` in place of its entries.
const planWith = (tasks: Readonly<Record<string, GanttPlanEntry>>): GanttPlanProps =>
  Object.freeze({ ...SENT, tasks: Object.freeze(tasks) });

// The edited plan of a linked edit, failing the test on a refusal.
const planOf = (edit: PlanEdit): GanttPlanProps => {
  if (!edit.ok) throw new Error(`refused: ${JSON.stringify(edit)}`);
  return edit.plan;
};

// `count` entries `t-1`… each depending on `on`.
const dependingOn = (on: string, count: number): Record<string, GanttPlanEntry> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, at) => [`t-${at + 1}`, { dependencies: [on] }]),
  );

describe("the plans linked to a Tree (molecules design decision 12)", () => {
  test("are every Gantt on the board naming the Tree, as sent while nothing is shown for it", () => {
    expect(linkedPlans(board(new Map()), TREE)).toEqual([{ id: PLAN.id, value: SENT, sent: SENT }]);
  });

  test("hold the value the board shows for the plan: its draft value, else its answer's", () => {
    const edited = uj2ExpandedEditedValues[PLAN.id];
    const [plan] = linkedPlans(board(new Map([[PLAN.id, edited]])), TREE);
    expect(plan?.value).toBe(edited as GanttPlanProps);
    expect(plan?.sent).toBe(SENT);
  });

  test("are read board-wide, a plan of another question included, and none naming another Tree", () => {
    const other = { type: "gantt", id: "other__plan", props: { ...SENT } };
    const elsewhere = { type: "gantt", id: "elsewhere", props: { ...SENT, workPackages: "wbs" } };
    const own = { type: "gantt", id: "release", props: { start: "2026-11-02", tasks: [] } };
    const items = [WBS, PLAN, other, elsewhere, own];
    const ids = linkedPlans(board(new Map(), items), TREE).map((plan) => plan.id);
    expect(ids).toEqual([PLAN.id, "other__plan"]);
    expect(linkedPlans(board(new Map(), items), "nowhere")).toEqual([]);
  });

  test("are frozen", () => {
    const plans = linkedPlans(board(new Map()), TREE);
    expect(Object.isFrozen(plans)).toBe(true);
    expect(plans.every((plan) => Object.isFrozen(plan))).toBe(true);
  });
});

describe("a package's predecessors in a plan", () => {
  test("are its entry's dependencies, or none", () => {
    expect(predecessorsOf(SENT, "portal")).toEqual(["architecture", "prototype"]);
    expect(predecessorsOf(SENT, "ux")).toEqual([]);
    expect(predecessorsOf(SENT, "nowhere")).toEqual([]);
  });
});

describe("a package added in the Tree (F20; view spec, An added package's predecessors)", () => {
  test("added after the portal gets the portal's predecessors, the approved plan's one change", () => {
    const plan = planOf(afterAdd(SENT, SENT, "u-1", "portal"));
    expect(plan).toEqual(uj2ExpandedEditedValues[PLAN.id] as GanttPlanProps);
    expect(elementChanges(PLAN.id, SENT, plan, GANTT_PLAN_SHAPE)).toEqual([
      { op: "set", target: `${PLAN.id}.u-1.dependencies`, value: ["architecture", "prototype"] },
    ]);
  });

  test("added as a child of reporting gets reporting's predecessor, the portal", () => {
    expect(predecessorsOf(planOf(afterAdd(SENT, SENT, "u-1", "reporting")), "u-1")).toEqual([
      "portal",
    ]);
  });

  test("gets none, and the plan stays the same value, when the anchor has none", () => {
    expect(planOf(afterAdd(SENT, SENT, "u-1", "ux"))).toBe(SENT);
    expect(planOf(afterAdd(SENT, SENT, "u-1", "nowhere"))).toBe(SENT);
  });

  test("never gets itself, which an anchor's entry from the agent may name", () => {
    const plan = planWith({ ...SENT.tasks, architecture: { dependencies: ["u-1", "ux"] } });
    expect(predecessorsOf(planOf(afterAdd(plan, SENT, "u-1", "architecture")), "u-1")).toEqual([
      "ux",
    ]);
  });

  test(`is refused, naming the limit, when a predecessor would get a dependent past ${GANTT_MAX_DEPENDENTS}`, () => {
    // Architecture's dependents: the portal, billing and 48 more, 50 in all.
    const plan = planWith({ ...SENT.tasks, ...dependingOn("architecture", 48) });
    expect(afterAdd(plan, SENT, "u-1", "portal")).toEqual({
      ok: false,
      limit: "dependents",
      taskId: "architecture",
      most: GANTT_MAX_DEPENDENTS,
    });
    expect(afterAdd(plan, SENT, "u-1", "reporting").ok).toBe(true);
  });

  test(`is refused, naming the limit, when the plan would hold ${GANTT_MAX_TASKS + 1} entries`, () => {
    const starts = Array.from({ length: GANTT_MAX_TASKS - 4 }, (_, at) => [
      `t-${at + 1}`,
      { start: "2026-11-09" },
    ]);
    const full = planWith({ ...SENT.tasks, ...Object.fromEntries(starts) });
    expect(Object.keys(full.tasks)).toHaveLength(GANTT_MAX_TASKS);
    expect(afterAdd(full, SENT, "u-1", "portal")).toEqual({
      ok: false,
      limit: "entries",
      most: GANTT_MAX_TASKS,
    });
    // An anchor with no predecessors adds no entry.
    expect(planOf(afterAdd(full, SENT, "u-1", "ux"))).toBe(full);
  });
});

describe("the tasks depending on deleted packages (view spec, Deleting a package with dependents)", () => {
  test("are reporting for the portal", () => {
    expect(dependentsOf([SENT], ["portal"])).toEqual(["reporting"]);
  });

  test("are the tasks outside the deleted branch that list any package of it, each once", () => {
    const design = ["design", "ux", "architecture", "prototype"];
    expect(dependentsOf([SENT], design)).toEqual(["portal", "billing"]);
    const second = planWith({
      billing: { dependencies: ["prototype"] },
      "u-2": { dependencies: ["ux"] },
    });
    expect(dependentsOf([SENT, second], design)).toEqual(["portal", "billing", "u-2"]);
  });

  test("are none for a package no task lists, or no plan", () => {
    expect(dependentsOf([SENT], ["reporting"])).toEqual([]);
    expect(dependentsOf([], ["portal"])).toEqual([]);
  });
});

describe("a package deleted in the Tree (view spec, Deleting a package with dependents)", () => {
  test("the portal: reporting depends on Architecture and Clickable prototype, one set in the plan's diff", () => {
    const plan = planOf(afterDelete(SENT, SENT, ["portal"]));
    expect(predecessorsOf(plan, "reporting")).toEqual(["architecture", "prototype"]);
    expect(elementChanges(PLAN.id, SENT, plan, GANTT_PLAN_SHAPE)).toEqual([
      {
        op: "set",
        target: `${PLAN.id}.reporting.dependencies`,
        value: ["architecture", "prototype"],
      },
    ]);
  });

  test("Design: the portal and billing follow every deleted package to their predecessors, none left", () => {
    const plan = planOf(afterDelete(SENT, SENT, ["design", "ux", "architecture", "prototype"]));
    // The Gantt model removes an entry left with no field that the agent did not send empty.
    expect(plan.tasks).toEqual({
      prototype: { dependencies: ["ux"] },
      reporting: { dependencies: ["portal"] },
    });
    expect(plan.tasks.prototype).toBe(SENT.tasks.prototype);
  });

  test("follows deleted packages through each other, with no repeat and never to the task itself", () => {
    const plan = planWith({
      a: { dependencies: ["x"] },
      d1: { dependencies: ["a", "d2"] },
      d2: { dependencies: ["a", "t", "b", "d1"] },
      t: { dependencies: ["d1", "b", "d2"] },
    });
    const after = planOf(afterDelete(plan, plan, ["d1", "d2"]));
    expect(predecessorsOf(after, "t")).toEqual(["a", "b"]);
  });

  test("sets each deleted package's entry back to the agent's, or removes it when the agent sent none", () => {
    const edited = planWith({
      ...SENT.tasks,
      portal: { start: "2026-11-20", dependencies: ["architecture"] },
      "u-1": { dependencies: ["portal"] },
    });
    const plan = planOf(afterDelete(edited, SENT, ["portal", "u-1"]));
    expect(plan.tasks.portal).toBe(SENT.tasks.portal);
    expect(Object.hasOwn(plan.tasks, "u-1")).toBe(false);
    expect(predecessorsOf(plan, "reporting")).toEqual(["architecture"]);
  });

  test("a split taken back by deleting u-1 gives the plan as sent", () => {
    const split = planOf(afterAdd(SENT, SENT, "u-1", "portal"));
    const back = planOf(afterDelete(split, SENT, ["u-1"]));
    expect(back).toEqual(SENT);
    expect(sameGantt(back, SENT)).toBe(true);
  });

  test("leaves the plan the same value when no entry names or is a deleted package", () => {
    expect(planOf(afterDelete(SENT, SENT, ["u-9"]))).toBe(SENT);
  });

  test(`is refused, naming the limit, when a dependent would get ${GANTT_MAX_PREDECESSORS + 1} predecessors`, () => {
    const many = Array.from({ length: GANTT_MAX_PREDECESSORS }, (_, at) => `p-${at + 1}`);
    const plan = planWith({
      ...SENT.tasks,
      "u-1": { dependencies: many },
      reporting: { dependencies: ["u-1", "portal"] },
    });
    expect(afterDelete(plan, SENT, ["u-1"])).toEqual({
      ok: false,
      limit: "predecessors",
      taskId: "reporting",
      most: GANTT_MAX_PREDECESSORS,
    });
  });

  test(`is refused, naming the limit, when a predecessor would get a dependent past ${GANTT_MAX_DEPENDENTS}`, () => {
    // ux's dependents: the prototype, the user's u-1 and 48 more, 50 in all; u-1 has two dependents.
    const plan = planWith({
      ...SENT.tasks,
      ...dependingOn("ux", 48),
      "u-1": { dependencies: ["ux"] },
      "u-2": { dependencies: ["u-1"] },
      "u-3": { dependencies: ["u-1"] },
    });
    expect(afterDelete(plan, SENT, ["u-1"])).toEqual({
      ok: false,
      limit: "dependents",
      taskId: "ux",
      most: GANTT_MAX_DEPENDENTS,
    });
  });

  test("is refused, naming the limit, when an agent's entry put back would give its predecessor a dependent too many", () => {
    // The user took ux from the prototype's predecessors, then gave ux 50 dependents.
    const { prototype: _, ...rest } = SENT.tasks;
    const plan = planWith({ ...rest, ...dependingOn("ux", GANTT_MAX_DEPENDENTS) });
    expect(afterDelete(plan, SENT, ["prototype"])).toEqual({
      ok: false,
      limit: "dependents",
      taskId: "ux",
      most: GANTT_MAX_DEPENDENTS,
    });
  });

  test("never throws, and never changes its inputs", () => {
    const copy = structuredClone(SENT);
    expect(() => afterDelete(SENT, SENT, ["portal", "design", "nowhere"])).not.toThrow();
    expect(() => afterAdd(SENT, SENT, "u-1", "portal")).not.toThrow();
    expect(SENT).toEqual(copy);
  });
});
