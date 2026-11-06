// `boardGraphSource` on a Gantt plan (gantt-widget, task 7.4; compute spec, "The board's graph
// source"): a plan becomes a plan source over the Tree it names, its entries' requested starts and
// predecessors taken for the Tree's leaves only, and that Tree a WBS-with-PERT source, once.

import { describe, expect, test } from "bun:test";
import { GANTT_ANSWER_DERIVED } from "@askboard/contract";
import {
  ganttPlanDerived,
  ganttPlanRequestedDerived,
  ganttPlanRequestedValue,
} from "@askboard/contract/fixtures";
import type { BoardSourceItem } from "../src/index.ts";
import * as compute from "../src/index.ts";
import {
  BOARD_SOURCE_FIXTURES,
  EXPANDED_SOURCE_FIXTURES,
  UJ2_ANSWERED,
  UJ2_BOARD,
} from "./fixtures/board.ts";
import { runAll, runBoardSources, Tally } from "./fixtures/suite.ts";
import uj2 from "./fixtures/uj2-wbs-gantt.json" with { type: "json" };

const { boardGraphSource, buildGraph, evaluateGraph, GraphSourceError } = compute;

type Json = Record<string, unknown>;
type Node = Json & { readonly children?: readonly Node[] };
type Item = BoardSourceItem & { readonly props: Json };

const [WBS, SCHEDULE] = UJ2_BOARD as readonly Item[] as readonly [Item, Item];
const NODES = WBS.props.nodes as readonly Node[];
const TASKS = SCHEDULE.props.tasks as Json;

/** The plan `schedule` with `tasks` in place of its own, and other props changed. */
const plan = (tasks: unknown, props: Json = {}, id = "schedule"): Item => ({
  ...SCHEDULE,
  id,
  props: { ...SCHEDULE.props, tasks, ...props },
});

/** The Tree `wbs` with `nodes` in place of its own. */
const tree = (nodes: unknown, id = "wbs"): Item => ({ ...WBS, id, props: { ...WBS.props, nodes } });

/** The nodes as the WBS reads them: IDs, the three estimates and children; names left out. */
const estimated = (nodes: readonly Node[]): Json[] =>
  nodes.map(({ id, optimistic, mostLikely, pessimistic, children }) => ({
    id,
    ...(optimistic === undefined ? {} : { optimistic, mostLikely, pessimistic }),
    ...(children === undefined ? {} : { children: estimated(children) }),
  }));

/** The plan `schedule` with the portal requested at 21 days, as the contract's fixture holds it. */
const SCHEDULE_REQUESTED: Item = { ...SCHEDULE, props: ganttPlanRequestedValue as unknown as Json };

const LEAVES = ["ux", "architecture", "prototype", "portal", "u-1", "billing", "reporting"];

describe("the board's graph source, on a Gantt plan", () => {
  test("maps the plan onto a plan source over its Tree, and the Tree onto a WBS source", () => {
    const source: unknown = boardGraphSource(UJ2_BOARD);
    expect(source).toEqual({
      items: [
        { kind: "wbs-pert", id: "wbs", nodes: estimated(NODES) },
        {
          kind: "gantt-plan",
          id: "schedule",
          workPackages: "wbs",
          start: "2026-11-02",
          dependencies: {
            prototype: ["ux"],
            portal: ["architecture", "prototype"],
            billing: ["architecture"],
            reporting: ["portal"],
          },
          starts: {},
          durations: {},
        },
      ],
    });
  });

  test("gives every value the approved example's data give, with no warning", () => {
    const graph = buildGraph(boardGraphSource(UJ2_BOARD));
    const reference = buildGraph({ items: uj2.items as never });
    expect(graph.warnings).toEqual([]);
    expect(graph.nodes).toEqual(reference.nodes);
    const [values, expected] = [evaluateGraph(graph), evaluateGraph(reference)];
    for (const { address } of reference.nodes) {
      expect({ address, value: values.read(address) }).toEqual({
        address,
        value: expected.read(address),
      });
    }
    expect(values.read("schedule.finishDate")).toBe("2026-12-11");
  });

  test("after the approved answer's edits, finishes on 2026-12-02 with its critical path", () => {
    const graph = buildGraph(boardGraphSource(UJ2_ANSWERED));
    expect(graph.warnings).toEqual([]);
    const values = evaluateGraph(graph);
    const critical = LEAVES.filter(
      (task) => values.read(`schedule.${task}.${GANTT_ANSWER_DERIVED.criticalPath}`) === true,
    );
    // UX design, the prototype, the portal and reporting.
    expect(critical).toEqual(["ux", "prototype", "portal", "reporting"]);
    const derived: unknown = {
      "schedule.finish": values.read(`schedule.${GANTT_ANSWER_DERIVED.finish}`),
      "schedule.criticalPath": critical,
    };
    expect(derived).toEqual(ganttPlanDerived);
    expect(values.read("schedule.u-1.startDate")).toBe("2026-11-16");
  });

  test("with the portal requested at 21 days, finishes later by the 8 days it gained", () => {
    const board = [WBS, SCHEDULE_REQUESTED];
    const graph = buildGraph(boardGraphSource(board));
    expect(graph.warnings).toEqual([]);
    const values = evaluateGraph(graph);
    expect(values.read("schedule.portal.duration")).toBe(21);
    expect(values.read("wbs.portal.expected")).toBeCloseTo(12.67, 2);
    const critical = LEAVES.filter(
      (task) => values.read(`schedule.${task}.${GANTT_ANSWER_DERIVED.criticalPath}`) === true,
    );
    const derived: unknown = {
      "schedule.finish": values.read(`schedule.${GANTT_ANSWER_DERIVED.finish}`),
      "schedule.criticalPath": critical,
    };
    expect(derived).toEqual(ganttPlanRequestedDerived);
  });

  test("takes an entry's requested start", () => {
    const tasks = { ...TASKS, reporting: { dependencies: ["portal"], start: "2026-12-09" } };
    const source = boardGraphSource([WBS, plan(tasks)]);
    expect(source.items[1]).toMatchObject({ starts: { reporting: "2026-12-09" } });
    const values = evaluateGraph(buildGraph(source));
    expect(values.read("schedule.reporting.startDate")).toBe("2026-12-09");
    expect(values.read("schedule.reporting.earliestDate")).toBe("2026-12-04");
    expect(values.read("schedule.finishDate")).toBe("2026-12-16");
  });

  test("adds nothing, and no warning, for an entry that names no leaf", () => {
    const tasks = {
      ...TASKS,
      design: { dependencies: ["ux"], start: "2026-11-20" },
      nope: { dependencies: ["nothing"], start: "soon" },
      build: 3,
    };
    const source = boardGraphSource([WBS, plan(tasks)]);
    expect(source).toEqual(boardGraphSource(UJ2_BOARD));
    expect(buildGraph(source).warnings).toEqual([]);
  });

  test("maps a Tree that two plans name once", () => {
    const items = [WBS, SCHEDULE, plan(TASKS, {}, "other")];
    const source = boardGraphSource(items);
    expect(source.items.map(({ kind, id }) => `${kind} ${id}`)).toEqual([
      "wbs-pert wbs",
      "gantt-plan schedule",
      "gantt-plan other",
    ]);
    const graph = buildGraph(source);
    expect(graph.warnings).toEqual([]);
    const values = evaluateGraph(graph);
    expect(values.read("schedule.finishDate")).toBe("2026-12-11");
    expect(values.read("other.finishDate")).toBe("2026-12-11");
  });

  test("keeps the board's order, and adds nothing for a Tree no plan names", () => {
    const after = boardGraphSource([SCHEDULE, WBS]);
    expect(after.items.map(({ kind }) => kind)).toEqual(["gantt-plan", "wbs-pert"]);
    expect(buildGraph(after).warnings).toEqual([]);
    expect(boardGraphSource([WBS])).toEqual({ items: [] });
    expect(boardGraphSource([WBS, WBS, SCHEDULE]).items.map(({ kind }) => kind)).toEqual([
      "wbs-pert",
      "gantt-plan",
    ]);
  });

  test.each([
    ["names nothing", [SCHEDULE]],
    ["names a question", [{ type: "question", id: "wbs", props: { text: "?" } }, SCHEDULE]],
    ["names a Gantt", [{ type: "gantt", id: "wbs", props: { start: "2026-11-02" } }, SCHEDULE]],
  ])("keeps compute's warning for a plan whose work packages %s", (_, items) => {
    // The warnings compute gives the approved `gantt-plan` data with no WBS beside it.
    const alone = buildGraph({ items: [uj2.items[1] as never] }).warnings;
    expect(alone).toContainEqual({
      error: "missing-reference",
      address: "schedule.workPackages",
      detail: "the work packages wbs name no WBS-with-PERT item",
    });
    const source = boardGraphSource(items);
    expect(source.items.at(-1)).toMatchObject({ kind: "gantt-plan", dependencies: {} });
    const { warnings } = buildGraph(source);
    expect(warnings.filter(({ address }) => address.startsWith("schedule."))).toEqual([...alone]);
  });

  test("returns a frozen source that a caller's later change cannot reach", () => {
    const nodes = structuredClone(NODES) as Json[];
    const predecessors = ["ux"];
    const source = boardGraphSource([
      tree(nodes),
      plan({ prototype: { dependencies: predecessors } }),
    ]);
    (nodes[0]?.children as Json[] | undefined)?.pop();
    nodes.pop();
    predecessors.push("architecture");
    const [wbs, schedule] = source.items;
    if (wbs?.kind !== "wbs-pert" || schedule?.kind !== "gantt-plan") throw new Error("not mapped");
    expect(wbs.nodes as unknown).toEqual(estimated(NODES));
    expect(schedule.dependencies).toEqual({ prototype: ["ux"] });
    for (const frozen of [source, source.items, wbs, wbs.nodes, wbs.nodes[0], schedule]) {
      expect(Object.isFrozen(frozen)).toBe(true);
    }
    expect(Object.isFrozen(wbs.nodes[0]?.children)).toBe(true);
    expect(Object.isFrozen(wbs.nodes[0]?.children?.[0])).toBe(true);
    expect(Object.isFrozen(schedule.dependencies)).toBe(true);
    expect(Object.isFrozen(schedule.dependencies?.prototype)).toBe(true);
    expect(Object.isFrozen(schedule.starts)).toBe(true);
  });

  test("takes every task ID as an own key, __proto__ included", () => {
    const nodes = [
      ...NODES,
      { id: "__proto__", label: "Odd", optimistic: 1, mostLikely: 2, pessimistic: 3 },
    ];
    const tasks = { ...TASKS, ["__proto__"]: { dependencies: ["ux"], start: "2026-12-09" } };
    const own = JSON.parse(JSON.stringify(tasks)) as Json;
    const source = boardGraphSource([tree(nodes), plan(own)]);
    const [, schedule] = source.items;
    if (schedule?.kind !== "gantt-plan") throw new Error("not a plan source");
    expect(Object.keys(schedule.dependencies ?? {})).toContain("__proto__");
    expect(Object.keys(schedule.starts ?? {})).toEqual(["__proto__"]);
    const values = evaluateGraph(buildGraph(source));
    expect(values.read("schedule.__proto__.startDate")).toBe("2026-12-09");
  });

  test.each([
    [
      [tree([]), plan(TASKS, {}, "a b"), plan(TASKS, { workPackages: "wbs" })],
      'item ID "a b" is not',
    ],
    [[{ ...WBS, props: 3 }, SCHEDULE], "item wbs: props is not an object"],
    [[tree(3), SCHEDULE], "item wbs: nodes is not a list"],
    [[tree([3]), SCHEDULE], "item wbs: a node is not an object"],
    [[tree([{ id: "a", children: "b" }]), SCHEDULE], "item wbs, node a: children is not a list"],
    [[WBS, plan([])], "item schedule: a plan's tasks are not a map by task ID"],
    [[WBS, plan({ reporting: 3 })], "item schedule: the entry of reporting is not an object"],
    [
      [WBS, plan({ reporting: { dependencies: "portal" } })],
      "item schedule: the dependencies of reporting are not a list of task IDs",
    ],
    [
      [WBS, plan({ reporting: { start: "soon" } })],
      "item schedule: the requested start of reporting is not a date",
    ],
    [[WBS, plan(TASKS, { workPackages: 3 })], "item schedule: workPackages is not an item ID"],
  ])("refuses the malformed board %#, naming the item", (items, message) => {
    const build = () => buildGraph(boardGraphSource(items as never));
    expect(build).toThrow(GraphSourceError);
    expect(build).toThrow(message);
  });
});

describe("the board source fixtures", () => {
  test("read as expected, with no warning, and join the determinism hash", () => {
    const tally = new Tally();
    runBoardSources(tally);
    expect(tally.failures).toEqual([]);
    expect(tally.exactMismatches).toEqual([]);
    const checks = [...BOARD_SOURCE_FIXTURES, ...EXPANDED_SOURCE_FIXTURES].map(
      ({ expected }) => Object.keys(expected).length + 1,
    );
    expect(tally.passed).toBe(checks.reduce((sum, count) => sum + count, 0));
    const results = Object.keys(runAll().results);
    expect(results).toContain("board:uj2-answered");
    expect(results).toContain("board:uj2-expanded-wbs");
  });
});
