// A plan entry's requested duration (widget-editing-plus, compute spec "CPM scheduling" and "The
// board's graph source"): the task lasts the request, else its expected effort rounded up, and
// the WBS's own numbers do not move.

import { describe, expect, test } from "bun:test";
import { boardGraphSource } from "../src/board.ts";
import { evaluateGraph } from "../src/evaluate.ts";
import { buildGraph } from "../src/graph/build.ts";
import {
  type GanttPlanItem,
  type GraphItem,
  GraphSourceError,
  type WbsPertItem,
} from "../src/source.ts";
import { UJ2_BOARD } from "./fixtures/board.ts";
import uj2 from "./fixtures/uj2-wbs-gantt.json" with { type: "json" };

type Leaf = { id: string; children?: Leaf[] } & Record<string, unknown>;

const [WBS, PLAN] = uj2.items as unknown as readonly [WbsPertItem, GanttPlanItem];

/** The UJ-2 Tree with the portal's estimates 12, 18 and 24: an expected effort of 18 days. */
const ESTIMATED_WBS: WbsPertItem = {
  ...WBS,
  nodes: WBS.nodes.map((node) => ({
    ...node,
    children: (node as Leaf).children?.map((leaf) =>
      leaf.id === "portal" ? { ...leaf, optimistic: 12, mostLikely: 18, pessimistic: 24 } : leaf,
    ),
  })) as WbsPertItem["nodes"],
};

const run = (...items: GraphItem[]) => {
  const graph = buildGraph({ items });
  return { graph, values: evaluateGraph(graph) };
};

const without = run(ESTIMATED_WBS, PLAN);
const asked = (durations: GanttPlanItem["durations"]) => run(ESTIMATED_WBS, { ...PLAN, durations });

describe("a requested duration in a plan", () => {
  test("lasts 21 working days against the 18 of the estimates, and moves its dependants", () => {
    expect(without.values.read("wbs.portal.expected")).toBe(18);
    expect(without.values.read("schedule.portal.duration")).toBe(18);
    const { graph, values } = asked({ portal: 21 });
    expect(graph.warnings).toEqual([]);
    expect(values.read("schedule.portal.duration")).toBe(21);
    expect(values.read("schedule.reporting.es")).toBe(
      (without.values.read("schedule.reporting.es") as number) + 3,
    );
    expect(values.read("schedule.finish")).toBe(
      (without.values.read("schedule.finish") as number) + 3,
    );
  });

  test("leave the WBS's own numbers as they were", () => {
    const { values } = asked({ portal: 21 });
    for (const address of ["wbs.portal.expected", "wbs.portal.spread", "wbs.expected"]) {
      expect({ address, value: values.read(address) }).toEqual({
        address,
        value: without.values.read(address),
      });
    }
  });

  test("equal to the estimates' length gives the schedule without the request", () => {
    const { values } = asked({ portal: 18 });
    for (const node of without.graph.nodes.filter((n) => n.address.startsWith("schedule."))) {
      expect({ address: node.address, value: values.read(node.address) }).toEqual({
        address: node.address,
        value: without.values.read(node.address),
      });
    }
  });

  test("can be shorter than the estimates, and below the plan's tasks' own length", () => {
    const { values } = asked({ portal: 1 });
    expect(values.read("schedule.portal.duration")).toBe(1);
  });

  test("read null as none", () => {
    const { values } = run(ESTIMATED_WBS, {
      ...PLAN,
      durations: null,
    } as unknown as GanttPlanItem);
    expect(values.read("schedule.portal.duration")).toBe(18);
  });

  test.each([
    ["zero", 0],
    ["fractional", 2.5],
    ["text", "21"],
  ])("refuse a %s duration, naming the task", (_, value) => {
    const bad = { ...PLAN, durations: { portal: value } } as unknown as GanttPlanItem;
    expect(() => buildGraph({ items: [ESTIMATED_WBS, bad] })).toThrow(GraphSourceError);
    expect(() => buildGraph({ items: [ESTIMATED_WBS, bad] })).toThrow(/portal/);
  });
});

describe("the board's graph source with a requested duration", () => {
  const [wbsItem, scheduleItem] = UJ2_BOARD as readonly [
    { type: string; id: string; props: Record<string, unknown> },
    { type: string; id: string; props: { tasks: Record<string, unknown> } },
  ];

  test("maps an entry's duration for a leaf, and the WBS source is unchanged", () => {
    const board = [
      wbsItem,
      {
        ...scheduleItem,
        props: {
          ...scheduleItem.props,
          tasks: {
            ...scheduleItem.props.tasks,
            portal: { dependencies: ["prototype"], duration: 21 },
          },
        },
      },
    ];
    const source = boardGraphSource(board).items;
    const [wbs, plan] = source as readonly [WbsPertItem, GanttPlanItem];
    expect(plan.durations).toEqual({ portal: 21 });
    const unchanged: unknown = boardGraphSource(UJ2_BOARD).items[0];
    expect<unknown>(wbs).toEqual(unchanged);
  });

  test("adds nothing for an entry that names no leaf", () => {
    const board = [
      wbsItem,
      { ...scheduleItem, props: { ...scheduleItem.props, tasks: { nope: { duration: 5 } } } },
    ];
    const plan = boardGraphSource(board).items[1] as GanttPlanItem;
    expect(plan.durations).toEqual({});
  });
});
