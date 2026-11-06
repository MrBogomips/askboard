import { describe, expect, test } from "bun:test";
import type { TreeNode } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanBoardDocument,
  ganttPlanEditedValue,
  treeEditedValue,
} from "@askboard/contract/fixtures";
import {
  GANTT_COLUMNS,
  type GanttCell,
  type GanttOwnProps,
  type GanttPlanProps,
  isOwnGantt,
  ownTaskRows,
  planEntry,
  planTaskRows,
} from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
const SENT = release.props as GanttOwnProps;

describe("a Gantt's rows", () => {
  test("lists its own tasks in their order, each with its fields", () => {
    const rows = ownTaskRows(SENT);
    expect(rows.map((row) => row.id)).toEqual([
      "ux",
      "architecture",
      "prototype",
      "portal",
      "billing",
      "reporting",
    ]);
    expect(rows[0]).toEqual({
      id: "ux",
      label: "UX design",
      sent: true,
      start: undefined,
      duration: 6,
      dependencies: [],
      cells: [
        { column: "task", editable: false },
        { column: "start", editable: true },
        { column: "duration", editable: true },
        { column: "dependencies", editable: true },
      ],
    });
    expect(rows[3]?.dependencies).toEqual(["architecture", "prototype"]);
  });

  test("shows the edited value's requested starts and durations", () => {
    const rows = ownTaskRows(ganttEditedValue);
    expect(rows.find((row) => row.id === "reporting")?.start).toBe("2026-12-09");
    expect(rows.find((row) => row.id === "billing")?.duration).toBe(11);
  });

  test("keeps a name as the characters the agent sent", () => {
    const label = "<img src=x onerror=alert(1)>";
    const [row] = ownTaskRows({ start: "2026-11-02", tasks: [{ id: "a", label, duration: 1 }] });
    expect(row?.label).toBe(label);
  });

  test("gives no row for a Gantt with no task", () => {
    expect(ownTaskRows({ start: "2026-11-02", tasks: [] })).toEqual([]);
  });

  test("gives frozen rows", () => {
    const rows = ownTaskRows(SENT);
    expect(Object.isFrozen(rows)).toBe(true);
    for (const row of rows) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.dependencies)).toBe(true);
      expect(Object.isFrozen(row.cells)).toBe(true);
    }
  });

  test("puts the grid's columns in order", () => {
    expect(GANTT_COLUMNS).toEqual(["task", "start", "duration", "dependencies"]);
  });

  test("tells a Gantt with its own tasks from a plan", () => {
    expect(isOwnGantt(SENT)).toBe(true);
    expect(isOwnGantt({ start: "2026-11-02", workPackages: "wbs", tasks: {} })).toBe(false);
  });
});

const [planQuestion] = ganttPlanBoardDocument.items;
const [WBS, SCHEDULE] = planQuestion.props.items;
const PLAN = SCHEDULE.props as GanttPlanProps;
const TREE = WBS.props.nodes;

const PLAN_CELLS: readonly GanttCell[] = [
  { column: "task", editable: false },
  { column: "start", editable: true },
  { column: "duration", editable: true },
  { column: "dependencies", editable: true },
];

const leaf = (id: string, label = id): TreeNode => ({
  id,
  label,
  optimistic: 1,
  mostLikely: 2,
  pessimistic: 3,
});

describe("a plan's rows", () => {
  test("are the Tree's leaves in document order, labelled, joined with their entries", () => {
    const rows = planTaskRows(PLAN, TREE, TREE);
    expect(rows.map((row) => [row.id, row.label])).toEqual([
      ["ux", "UX design"],
      ["architecture", "Architecture"],
      ["prototype", "Clickable prototype"],
      ["portal", "Customer portal"],
      ["billing", "Billing integration"],
      ["reporting", "Reporting"],
    ]);
    expect(rows[3]).toEqual({
      id: "portal",
      label: "Customer portal",
      sent: true,
      start: undefined,
      duration: undefined,
      dependencies: ["architecture", "prototype"],
      cells: PLAN_CELLS,
    });
    // A leaf the plan says nothing about is a task all the same, with no predecessor.
    expect(rows[0]).toMatchObject({ id: "ux", sent: true, start: undefined, dependencies: [] });
  });

  test("give no row for a parent, even one the plan holds an entry for", () => {
    const plan = { ...PLAN, tasks: { ...PLAN.tasks, design: { start: "2026-11-09" } } };
    const ids = planTaskRows(plan, TREE, TREE).map((row) => row.id);
    expect(ids).not.toContain("design");
    expect(ids).not.toContain("build");
    expect(ids).toHaveLength(6);
  });

  test("follow the Tree as it stands: an added package is a row the agent did not send", () => {
    const rows = planTaskRows(ganttPlanEditedValue, treeEditedValue.nodes, TREE);
    expect(rows.map((row) => row.id)).toEqual([
      "ux",
      "architecture",
      "prototype",
      "portal",
      "u-1",
      "billing",
      "reporting",
    ]);
    expect(rows[3]?.label).toBe("Customer portal: accounts");
    expect(rows[4]).toEqual({
      id: "u-1",
      label: "Customer portal: dashboards",
      sent: false,
      start: undefined,
      duration: undefined,
      dependencies: ["architecture", "prototype"],
      cells: PLAN_CELLS,
    });
    expect(rows.filter((row) => !row.sent).map((row) => row.id)).toEqual(["u-1"]);
  });

  test("give no row for an entry naming no leaf, and an entry's start to its leaf", () => {
    const plan = {
      ...PLAN,
      tasks: { ...PLAN.tasks, gone: { dependencies: ["ux"] }, ux: { start: "2026-11-04" } },
    };
    const rows = planTaskRows(plan, TREE, TREE);
    expect(rows.map((row) => row.id)).not.toContain("gone");
    expect(rows[0]).toMatchObject({ id: "ux", start: "2026-11-04", dependencies: [] });
  });

  test("lose a leaf that became a parent, and gain a parent left without children", () => {
    const nodes: TreeNode[] = [
      { id: "a", label: "A", children: [leaf("a1")] },
      { id: "b", label: "B", children: [leaf("b1")] },
    ];
    const edited: TreeNode[] = [
      { id: "a", label: "A", children: [{ ...leaf("a1"), children: [leaf("u-1")] }] },
      { id: "b", label: "B", optimistic: 1, mostLikely: 2, pessimistic: 3 },
    ];
    const rows = planTaskRows({ start: "2026-11-02", workPackages: "w", tasks: {} }, edited, nodes);
    expect(rows.map((row) => [row.id, row.sent])).toEqual([
      ["u-1", false],
      ["b", false],
    ]);
  });

  test("read an entry only under its own key, whatever the task's ID", () => {
    const tasks = Object.fromEntries([["__proto__", { dependencies: ["constructor"] }]]);
    const nodes = [leaf("__proto__"), leaf("constructor"), leaf("toString")];
    const rows = planTaskRows({ start: "2026-11-02", workPackages: "w", tasks }, nodes, nodes);
    expect(rows.map((row) => [row.id, row.dependencies])).toEqual([
      ["__proto__", ["constructor"]],
      ["constructor", []],
      ["toString", []],
    ]);
    expect(planEntry({ start: "2026-11-02", workPackages: "w", tasks }, "constructor")).toBe(
      undefined,
    );
    expect(planEntry(PLAN, "portal")).toBe(PLAN.tasks.portal);
  });

  test("give frozen rows, their lists copied", () => {
    const rows = planTaskRows(ganttPlanEditedValue, treeEditedValue.nodes, TREE);
    expect(Object.isFrozen(rows)).toBe(true);
    for (const row of rows) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.dependencies)).toBe(true);
      expect(Object.isFrozen(row.cells)).toBe(true);
    }
    expect(rows[3]?.dependencies).not.toBe(ganttPlanEditedValue.tasks.portal?.dependencies);
  });

  test("give no row for a Tree with no node", () => {
    expect(planTaskRows(PLAN, [], TREE)).toEqual([]);
  });
});
