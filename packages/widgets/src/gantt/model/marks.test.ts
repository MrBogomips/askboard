import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_PLAN_SHAPE, GANTT_SHAPE, type TreeNode } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanBoardDocument,
  ganttPlanEditedValue,
  treeEditedValue,
} from "@askboard/contract/fixtures";
import { type BoardGraph, liveGraph, sentGraph } from "../../graph/board-graph.ts";
import { requestStart, setDuration, setPredecessors } from "./edits.ts";
import {
  changeCount,
  changeCounter,
  ownTaskMarks,
  type PlanTaskMarks,
  planChangeCount,
  planTaskMarks,
} from "./marks.ts";
import { baselineOf, scheduleOf } from "./schedule.ts";
import { type GanttOwnProps, type GanttPlanProps, planTaskRows } from "./tasks.ts";

const SENT = ganttBoardDocument.items[0].props.items[0].props as GanttOwnProps;

const UNMARKED = { start: false, duration: false, dependencies: false, changed: false };

describe("a Gantt's change marks", () => {
  test("mark nothing on the agent's value", () => {
    const marks = ownTaskMarks(SENT, SENT);
    expect([...marks.keys()]).toEqual(SENT.tasks.map((task) => task.id));
    for (const mark of marks.values()) expect(mark).toEqual(UNMARKED);
    expect(changeCount(marks)).toBe(0);
    // A copy compares by content, its predecessor lists element by element.
    const copied = ownTaskMarks(structuredClone(SENT), SENT);
    expect(changeCount(copied)).toBe(0);
  });

  test("mark each changed field against the agent's value, and nothing else", () => {
    const marks = ownTaskMarks(ganttEditedValue, SENT);
    expect(marks.get("billing")).toEqual({ ...UNMARKED, duration: true, changed: true });
    expect(marks.get("reporting")).toEqual({ ...UNMARKED, start: true, changed: true });
    // The portal moves with nothing: no task moved by a predecessor is marked.
    expect(marks.get("portal")).toEqual(UNMARKED);
    expect(changeCount(marks)).toBe(2);
  });

  test("mark changed predecessors", () => {
    const value = setPredecessors(SENT, SENT, "reporting", ["portal", "billing"]);
    expect(ownTaskMarks(value, SENT).get("reporting")).toEqual({
      ...UNMARKED,
      dependencies: true,
      changed: true,
    });
  });

  test("count a task changed in several fields once", () => {
    const value = setDuration(requestStart(SENT, SENT, "ux", "2026-11-04"), SENT, "ux", 3);
    const marks = ownTaskMarks(value, SENT);
    expect(marks.get("ux")).toEqual({
      start: true,
      duration: true,
      dependencies: false,
      changed: true,
    });
    expect(changeCount(marks)).toBe(1);
  });

  test("agree with the diff when the agent sent an empty list", () => {
    const tasks = [{ id: "a", label: "A", duration: 1, dependencies: [] }];
    const sent = { start: "2026-11-02", tasks };
    const value = { start: "2026-11-02", tasks: [{ id: "a", label: "A", duration: 1 }] };
    expect(ownTaskMarks(value, sent).get("a")?.dependencies).toBe(true);
    expect(elementChanges("g", sent, value, GANTT_SHAPE)).toHaveLength(1);
  });

  test("mark a task the agent did not send as changed", () => {
    const value = { ...SENT, tasks: [...SENT.tasks, { id: "extra", label: "Extra", duration: 2 }] };
    expect(ownTaskMarks(value, SENT).get("extra")).toEqual({
      start: false,
      duration: true,
      dependencies: false,
      changed: true,
    });
  });

  test("give frozen marks", () => {
    for (const mark of ownTaskMarks(ganttEditedValue, SENT).values()) {
      expect(Object.isFrozen(mark)).toBe(true);
    }
  });

  test.each([
    [0, "Changes vs agent's original · none yet"],
    [1, "Your changes: 1"],
    [2, "Your changes: 2"],
    [37, "Your changes: 37"],
  ])("read %i changes as %j on the toolbar", (count, text) => {
    expect(changeCounter(count)).toBe(text);
  });
});

describe("a plan's change marks", () => {
  const [planQuestion] = ganttPlanBoardDocument.items;
  const ITEMS = planQuestion.props.items;
  const [WBS, SCHEDULE] = ITEMS;
  const PLAN = SCHEDULE.props as GanttPlanProps;
  const TREE = WBS.props.nodes;
  const PLAIN = { ...UNMARKED, added: false };

  const graphIn = (graph: BoardGraph | undefined): BoardGraph => {
    if (graph === undefined) throw new Error("no graph");
    return graph;
  };

  /** The marks of the plan `value` over the Tree `nodes`, read from the board's two graphs. */
  const marksOf = (
    value: GanttPlanProps,
    nodes: readonly TreeNode[] = TREE,
  ): ReadonlyMap<string, PlanTaskMarks> => {
    const draft = new Map<string, unknown>([
      ["wbs", nodes === TREE ? undefined : { ...WBS.props, nodes }],
      ["schedule", value === PLAN ? undefined : value],
    ]);
    const board = { items: ITEMS, draft, shown: draft };
    const rows = planTaskRows(value, nodes, TREE);
    const schedules = scheduleOf(graphIn(liveGraph(board)), "schedule", rows);
    const baselines = baselineOf(graphIn(sentGraph(board)), "schedule", rows);
    return planTaskMarks(value, PLAN, rows, schedules, baselines);
  };

  /** The sent Tree with `node` added after the leaf `after`. */
  const withPackage = (after: string, node: TreeNode): readonly TreeNode[] =>
    TREE.map((parent) => ({
      ...parent,
      children: (parent.children ?? []).flatMap((child) =>
        child.id === after ? [child, node] : [child],
      ),
    }));

  const DASHBOARDS = {
    id: "u-1",
    label: "Customer portal: dashboards",
    optimistic: 4,
    mostLikely: 7,
    pessimistic: 12,
  };

  test("mark nothing on the agent's plan", () => {
    const marks = marksOf(PLAN);
    expect([...marks.keys()]).toEqual(planTaskRows(PLAN, TREE, TREE).map((row) => row.id));
    for (const mark of marks.values()) expect(mark).toEqual(PLAIN);
    expect(planChangeCount(PLAN, PLAN)).toBe(0);
    expect(planChangeCount(structuredClone(PLAN), PLAN)).toBe(0);
  });

  test("mark packages added or re-estimated in the Tree, not those moved by a predecessor", () => {
    const marks = marksOf(ganttPlanEditedValue, treeEditedValue.nodes);
    // UX design 6 days to 5, the portal 13 to 7 once split, billing 9 to 10.
    for (const id of ["ux", "portal", "billing"]) {
      expect({ id, mark: marks.get(id) }).toEqual({
        id,
        mark: { ...PLAIN, duration: true, changed: true },
      });
    }
    expect(marks.get("u-1")).toEqual({ ...PLAIN, added: true, dependencies: true, changed: true });
    // The prototype and reporting start earlier, as UX design and the portal shrink.
    for (const id of ["architecture", "prototype", "reporting"]) {
      expect({ id, mark: marks.get(id) }).toEqual({ id, mark: PLAIN });
    }
    // Only the plan's own change counts: the Tree's are the Tree's.
    expect(planChangeCount(ganttPlanEditedValue, PLAN)).toBe(1);
  });

  test("count reporting moved and u-1 linked, and leave the portal unmarked", () => {
    const reporting = { dependencies: ["portal"], start: "2026-12-09" };
    const linked = { dependencies: ["architecture", "prototype"] };
    const value = { ...PLAN, tasks: { ...PLAN.tasks, reporting, "u-1": linked } };
    const marks = marksOf(value, withPackage("portal", DASHBOARDS));
    expect(marks.get("reporting")).toEqual({ ...PLAIN, start: true, changed: true });
    expect(marks.get("u-1")).toEqual({ ...PLAIN, added: true, dependencies: true, changed: true });
    expect(marks.get("portal")).toEqual(PLAIN);
    expect(changeCounter(planChangeCount(value, PLAN))).toBe("Your changes: 2");
  });

  test("leave a new estimate that keeps the duration unmarked", () => {
    const nodes = TREE.map((parent) => ({
      ...parent,
      children: (parent.children ?? []).map((child) =>
        child.id === "reporting" ? { ...child, pessimistic: 10 } : child,
      ),
    }));
    expect(marksOf(PLAN, nodes).get("reporting")).toEqual(PLAIN);
  });

  test("mark the portal re-estimated from 12 to 20 days, but not while it has no dates", () => {
    const nodes = TREE.map((parent) => ({
      ...parent,
      children: (parent.children ?? []).map((child) =>
        child.id === "portal" ? { ...child, mostLikely: 20 } : child,
      ),
    }));
    expect(marksOf(PLAN, nodes).get("portal")).toEqual({ ...PLAIN, duration: true, changed: true });
    // The prototype after reporting closes a cycle through the portal: no duration shows.
    const prototype = { dependencies: ["ux", "reporting"] };
    const marks = marksOf({ ...PLAN, tasks: { ...PLAN.tasks, prototype } }, nodes);
    expect(marks.get("prototype")).toEqual({ ...PLAIN, dependencies: true, changed: true });
    expect(marks.get("portal")).toEqual(PLAIN);
  });

  test.each<[string, GanttPlanProps["tasks"]]>([
    ["an entry for no leaf", { ...PLAN.tasks, design: { start: "2026-11-09" } }],
    ["an agent's entry emptied", { ...PLAN.tasks, billing: {} }],
    ["an agent's entry gone", { prototype: { dependencies: ["ux"] } }],
    ["an empty list for none", { ...PLAN.tasks, ux: { dependencies: [] } }],
    [
      "a list reordered",
      { ...PLAN.tasks, portal: { dependencies: ["prototype", "architecture"] } },
    ],
    ["an empty entry", { ...PLAN.tasks, ux: {} }],
  ])("count %s as the plan's diff does", (_, tasks) => {
    const value = { ...PLAN, tasks };
    const changes = elementChanges("schedule", PLAN, value, GANTT_PLAN_SHAPE);
    const changed = new Set(changes.map((change) => change.target.split(".")[1]));
    expect(planChangeCount(value, PLAN)).toBe(changed.size);
  });

  test("give frozen marks", () => {
    for (const mark of marksOf(ganttPlanEditedValue, treeEditedValue.nodes).values()) {
      expect(Object.isFrozen(mark)).toBe(true);
    }
  });
});
