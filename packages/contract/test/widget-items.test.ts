import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument, treeBoardDocument } from "../src/fixtures/index.ts";
import { GANTT_PLAN_SHAPE, GANTT_SHAPE, TREE_SHAPE } from "../src/index.ts";
import { elementShapeOf, validateGanttProps, widgetItemProblems } from "../src/validate.ts";

// Widget item checks (molecules design decision 6; contract spec, "Widget item checks"): a widget
// item checked in the question that holds it, through the widgets' own validators and a Gantt
// plan's link check, and the element shape the generic diff takes for it.

const [TREE_QUESTION] = treeBoardDocument.items;
const [WBS] = TREE_QUESTION.props.items;
const [PLAN_QUESTION] = ganttPlanBoardDocument.items;
const PLAN = PLAN_QUESTION.props.items.find((item) => item.type === "gantt");
if (PLAN === undefined) throw new Error("the Gantt plan fixture holds no plan");

/** A question holding `items`, as the expansion's step 4 gives it. */
const questionOf = (items: readonly unknown[]) => ({
  type: "question",
  id: "plan",
  props: { text: "Review the plan", items },
});

const EXPANDED_TREE = { ...WBS, id: "wbs__tree" };
const EXPANDED_PLAN = {
  ...PLAN,
  id: "schedule__plan",
  props: { ...PLAN.props, workPackages: "wbs__tree" },
};

describe("widgetItemProblems", () => {
  test("a valid Tree and a valid Gantt plan in their question pass", () => {
    const question = questionOf([EXPANDED_TREE, EXPANDED_PLAN]);
    expect(widgetItemProblems(EXPANDED_TREE, question, "agent")).toEqual([]);
    expect(widgetItemProblems(EXPANDED_PLAN, question, "agent")).toEqual([]);
    expect(widgetItemProblems(PLAN, PLAN_QUESTION, "edited")).toEqual([]);
  });

  test("a Tree with an undeclared field gives the Tree's own problems, unchanged", () => {
    const [first, ...rest] = WBS.props.nodes;
    const tree = { ...WBS, props: { ...WBS.props, nodes: [{ ...first, owner: "ada" }, ...rest] } };
    const problems = widgetItemProblems(tree, questionOf([tree]), "agent");
    expect(problems).toEqual([{ path: "/nodes/0/owner", message: expect.any(String) }]);
    expect(problems[0]?.message).toContain("owner");
  });

  test("a Gantt with calendar gives the Gantt's own problems, unchanged", () => {
    const gantt = { ...PLAN, props: { ...PLAN.props, calendar: "work-week" } };
    const own = validateGanttProps(gantt.props, "agent");
    expect(own.ok).toBe(false);
    const problems = widgetItemProblems(gantt, PLAN_QUESTION, "agent");
    expect(problems).toEqual(own.ok ? [] : own.problems);
    expect(problems).toContainEqual({ path: "/calendar", message: 'unknown field "calendar"' });
  });

  test("a plan naming a Tree its question does not hold fails, naming the plan and the Tree", () => {
    const problems = widgetItemProblems(EXPANDED_PLAN, questionOf([EXPANDED_PLAN]), "agent");
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe("/workPackages");
    expect(problems[0]?.message).toContain("schedule__plan");
    expect(problems[0]?.message).toContain("wbs__tree");
  });

  test("a type the contract defines no widget for fails, naming the item and the type", () => {
    const kanban = { type: "kanban", id: "board-1", props: {} };
    const problems = widgetItemProblems(kanban, questionOf([kanban]), "agent");
    expect(problems).toEqual([{ path: "/", message: expect.any(String) }]);
    expect(problems[0]?.message).toContain("board-1");
    expect(problems[0]?.message).toContain("kanban");
  });

  test("a value that is no item is a problem, never an exception", () => {
    for (const item of [undefined, null, "tree", [], { type: 3 }]) {
      expect(widgetItemProblems(item, undefined, "agent")).toHaveLength(1);
    }
    expect(widgetItemProblems({ type: "tree", id: "t" }, undefined, "agent").length).toBe(1);
  });
});

describe("elementShapeOf", () => {
  test("gives each widget's shape, and none for a question or another type", () => {
    expect(elementShapeOf(WBS)).toBe(TREE_SHAPE);
    expect(elementShapeOf(PLAN)).toBe(GANTT_PLAN_SHAPE);
    const own = { type: "gantt", id: "release", props: { start: "2026-11-02", tasks: [] } };
    expect(elementShapeOf(own)).toBe(GANTT_SHAPE);
    expect(elementShapeOf(TREE_QUESTION)).toBeUndefined();
    expect(elementShapeOf({ type: "kanban", id: "k", props: {} })).toBeUndefined();
    expect(elementShapeOf(undefined)).toBeUndefined();
    expect(elementShapeOf({ type: "gantt", id: "g" })).toBe(GANTT_SHAPE);
  });
});
