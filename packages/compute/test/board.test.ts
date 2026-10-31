import { describe, expect, test } from "bun:test";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import * as compute from "../src/index.ts";
import uj2 from "./fixtures/uj2-wbs-gantt.json" with { type: "json" };

const { boardGraphSource, buildGraph, evaluateGraph, GraphSourceError } = compute;

// The board item of a Gantt with its own tasks, as the input format writes it: the props hold each
// task's name, duration, requested start and predecessors.
const RELEASE = {
  type: "gantt",
  id: "release",
  props: {
    start: "2026-11-02",
    tasks: [
      { id: "ux", label: "UX design", duration: 6 },
      { id: "architecture", label: "Architecture", duration: 4 },
      { id: "prototype", label: "Clickable prototype", duration: 5, dependencies: ["ux"] },
      {
        id: "portal",
        label: "Customer portal",
        duration: 13,
        dependencies: ["architecture", "prototype"],
      },
      { id: "billing", label: "Billing integration", duration: 9, dependencies: ["architecture"] },
      { id: "reporting", label: "Reporting", duration: 6, dependencies: ["portal"] },
    ],
  },
};

const QUESTION = { type: "question", id: "plan", props: { text: "Does this plan fit?" } };

const withTasks = (tasks: unknown) => ({ ...RELEASE, props: { ...RELEASE.props, tasks } });

describe("the board's graph source", () => {
  test("maps a Gantt with its own tasks onto a Gantt source", () => {
    expect(boardGraphSource([QUESTION, RELEASE])).toEqual({
      items: [
        {
          kind: "gantt",
          id: "release",
          start: "2026-11-02",
          tasks: [
            { id: "ux", duration: 6 },
            { id: "architecture", duration: 4 },
            { id: "prototype", duration: 5 },
            { id: "portal", duration: 13 },
            { id: "billing", duration: 9 },
            { id: "reporting", duration: 6 },
          ],
          dependencies: {
            prototype: ["ux"],
            portal: ["architecture", "prototype"],
            billing: ["architecture"],
            reporting: ["portal"],
          },
          starts: {},
        },
      ],
    });
  });

  test("gives the schedule the UJ-2 plan gives", () => {
    const values = evaluateGraph(buildGraph(boardGraphSource([RELEASE])));
    const plan = evaluateGraph(buildGraph({ items: uj2.items as never }));
    for (const task of RELEASE.props.tasks) {
      for (const field of ["startDate", "finishDate", "critical"]) {
        expect(values.read(`release.${task.id}.${field}`)).toEqual(
          plan.read(`schedule.${task.id}.${field}`),
        );
      }
    }
  });

  test("takes the values the item holds, the draft's edits among them", () => {
    const edited = RELEASE.props.tasks.map((task) =>
      task.id === "reporting" ? { ...task, start: "2026-12-09" } : task,
    );
    const source = boardGraphSource([withTasks(edited)]);
    expect(source.items[0]).toMatchObject({ starts: { reporting: "2026-12-09" } });
    const values = evaluateGraph(buildGraph(source));
    expect(values.read("release.reporting.startDate")).toBe("2026-12-09");
    expect(values.read("release.finishDate")).toBe("2026-12-16");
  });

  test("adds nothing for items that hold nothing to compute", () => {
    const choice = {
      type: "question",
      id: "erp",
      props: { text: "ERP export?", options: [{ label: "Yes" }, { label: "No" }] },
    };
    expect(boardGraphSource([QUESTION, choice, { type: "pie", id: "p", props: {} }])).toEqual({
      items: [],
    });
    expect(boardGraphSource([])).toEqual({ items: [] });
  });

  test("returns a frozen source that a caller's later change cannot reach", () => {
    const predecessors = ["ux"];
    const tasks = [
      { id: "ux", label: "UX", duration: 6 },
      { id: "prototype", label: "Prototype", duration: 5, dependencies: predecessors },
      { id: "reporting", label: "Reporting", duration: 6, start: "2026-12-09" },
    ];
    const source = boardGraphSource([withTasks(tasks)]);
    predecessors.push("reporting");
    tasks.pop();
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.items)).toBe(true);
    const [item] = source.items;
    expect(Object.isFrozen(item)).toBe(true);
    if (item?.kind !== "gantt") throw new Error("not a Gantt source");
    expect(Object.isFrozen(item.tasks)).toBe(true);
    expect(Object.isFrozen(item.tasks[0])).toBe(true);
    expect(Object.isFrozen(item.dependencies)).toBe(true);
    expect(Object.isFrozen(item.dependencies?.prototype)).toBe(true);
    expect(Object.isFrozen(item.starts)).toBe(true);
    expect(item.dependencies).toEqual({ prototype: ["ux"] });
    expect(item.tasks.map((task) => task.id)).toEqual(["ux", "prototype", "reporting"]);
  });

  test("takes every task ID as an own key, __proto__ included", () => {
    const tasks = [
      { id: "ux", label: "UX", duration: 6 },
      { id: "__proto__", label: "Odd", duration: 3, dependencies: ["ux"], start: "2026-12-09" },
    ];
    const source = boardGraphSource([withTasks(tasks)]);
    const [item] = source.items;
    if (item?.kind !== "gantt") throw new Error("not a Gantt source");
    expect(Object.keys(item.dependencies ?? {})).toEqual(["__proto__"]);
    expect(Object.keys(item.starts ?? {})).toEqual(["__proto__"]);
    const values = evaluateGraph(buildGraph(source));
    expect(values.read("release.__proto__.startDate")).toBe("2026-12-09");
    expect(values.read("release.__proto__.earliestDate")).toBe("2026-11-10");
    const malformed = [tasks[0], { id: "__proto__", label: "Odd", duration: 3, dependencies: "x" }];
    expect(() => buildGraph(boardGraphSource([withTasks(malformed)]))).toThrow(
      "item release: the dependencies of __proto__ are not a list of task IDs",
    );
  });

  test.each([
    [[3], "a board item is not an object"],
    [[{ type: "gantt", id: "a b", props: {} }], 'item ID "a b" is not'],
    [[{ type: "gantt", id: "release", props: 3 }], "item release: props is not an object"],
    [[withTasks(3)], "item release: tasks is not a list"],
    [[withTasks([3])], "item release: a task is not an object"],
    [[withTasks([{ id: 7, duration: 1 }])], "item release: task ID 7 is not"],
    [[withTasks([{ id: "a", duration: 0 }])], "the duration of a is not a positive whole number"],
    [
      [withTasks([{ id: "a", duration: 1, dependencies: "b" }])],
      "item release: the dependencies of a are not a list of task IDs",
    ],
    [
      [withTasks([{ id: "a", duration: 1, start: "soon" }])],
      "item release: the requested start of a is not a date",
    ],
  ])("refuses the malformed items %j, naming the item", (items, message) => {
    const build = () => buildGraph(boardGraphSource(items as never));
    expect(build).toThrow(GraphSourceError);
    expect(build).toThrow(message);
  });

  test("refuses a board whose items are not a list", () => {
    expect(() => boardGraphSource(3 as never)).toThrow("the board's items are not a list");
  });
});

describe("scheduling formulas at the contract's limits", () => {
  // 64-character IDs, the longest the ID rule allows, for the item and every task.
  const id = (name: string): string => `${name}-`.padEnd(64, "x");

  test("pass the formula check: 50 predecessors of one task, 50 dependents of another", () => {
    const hub = id("hub");
    const sink = id("sink");
    const feeders = Array.from({ length: 50 }, (_, i) => id(`feeder${i}`));
    const dependents = Array.from({ length: 50 }, (_, i) => id(`dependent${i}`));
    const tasks = [
      ...feeders.map((task) => ({ id: task, label: task, duration: 1 })),
      { id: sink, label: "sink", duration: 1, dependencies: feeders },
      { id: hub, label: "hub", duration: 1 },
      ...dependents.map((task) => ({ id: task, label: task, duration: 1, dependencies: [hub] })),
    ];
    const item = { type: "gantt", id: id("plan"), props: { start: "2026-11-02", tasks } };
    const graph = buildGraph(boardGraphSource([item]));
    expect(graph.warnings).toEqual([]);
    const longest = Math.max(...graph.nodes.map((node) => node.formula?.length ?? 0));
    expect(longest).toBeGreaterThan(6_000);
    expect(longest).toBeLessThan(8_192);
    for (const node of graph.nodes) {
      if (node.formula !== undefined) {
        expect({ at: node.address, ok: !isProblem(checkFormula(node.formula)) }).toEqual({
          at: node.address,
          ok: true,
        });
      }
    }
  });
});
