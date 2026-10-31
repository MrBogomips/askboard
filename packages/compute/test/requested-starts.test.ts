import { describe, expect, test } from "bun:test";
import { evaluateGraph } from "../src/evaluate.ts";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import { buildGraph } from "../src/graph/build.ts";
import {
  type GanttItem,
  type GanttPlanItem,
  type GraphItem,
  GraphSourceError,
} from "../src/source.ts";
import uj2 from "./fixtures/uj2-wbs-gantt.json" with { type: "json" };

const RELEASE: GanttItem = {
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
};

const UJ2 = uj2.items as unknown as readonly [GraphItem, GanttPlanItem];

const build = (...items: GraphItem[]) => {
  const graph = buildGraph({ items });
  return { graph, values: evaluateGraph(graph) };
};

const node = (graph: ReturnType<typeof buildGraph>, address: string) =>
  graph.nodes.find((candidate) => candidate.address === address);

describe("requested starts", () => {
  test("move a task later than its predecessors allow, and the plan's end with it", () => {
    const { graph, values } = build({ ...RELEASE, starts: { reporting: "2026-12-09" } });
    expect(graph.warnings).toEqual([]);
    expect(values.read("release.reporting.startDate")).toBe("2026-12-09");
    expect(values.read("release.reporting.earliestDate")).toBe("2026-12-04");
    expect(values.read("release.reporting.earliest")).toBe(24);
    expect(values.read("release.reporting.es")).toBe(27);
    expect(values.read("release.finish")).toBe(33);
    expect(values.read("release.finishDate")).toBe("2026-12-16");
  });

  test("do the same in a Gantt plan over a WBS", () => {
    const [wbs, plan] = UJ2;
    const { graph, values } = build(wbs, { ...plan, starts: { reporting: "2026-12-09" } });
    expect(graph.warnings).toEqual([]);
    expect(values.read("schedule.reporting.startDate")).toBe("2026-12-09");
    expect(values.read("schedule.reporting.earliestDate")).toBe("2026-12-04");
    expect(values.read("schedule.finishDate")).toBe("2026-12-16");
  });

  test("give way to predecessors that finish later", () => {
    const { values } = build({
      kind: "gantt",
      id: "g",
      start: "2026-11-02",
      tasks: [
        { id: "a", duration: 9 },
        { id: "b", duration: 1 },
      ],
      dependencies: { b: ["a"] },
      starts: { b: "2026-11-10" },
    });
    expect(values.read("g.a.finishDate")).toBe("2026-11-12");
    expect(values.read("g.b.startDate")).toBe("2026-11-13");
  });

  test("move a request on a Saturday to the Monday after", () => {
    const { values } = build({
      kind: "gantt",
      id: "g",
      start: "2026-11-02",
      tasks: [{ id: "b", duration: 1 }],
      starts: { b: "2026-11-14" },
    });
    expect(values.read("g.b.startDate")).toBe("2026-11-16");
  });

  test("have no effect before the plan's first working day", () => {
    const { values } = build({ ...RELEASE, starts: { ux: "2026-10-01", reporting: "2026-11-30" } });
    expect(values.read("release.ux.startDate")).toBe("2026-11-02");
    expect(values.read("release.reporting.startDate")).toBe("2026-12-04");
  });

  test("leave every task's earliest start, as a number and a date, beside its start", () => {
    const { values } = build({ ...RELEASE, starts: { portal: "2026-11-23" } });
    expect(values.read("release.portal.earliestDate")).toBe("2026-11-17");
    expect(values.read("release.portal.startDate")).toBe("2026-11-23");
    expect(values.read("release.reporting.earliestDate")).toBe("2026-12-10");
    expect(values.read("release.reporting.startDate")).toBe("2026-12-10");
    expect(values.read("release.ux.earliest")).toBe(0);
    expect(values.read("release.ux.earliestDate")).toBe("2026-11-02");
  });

  test("keep compute-engine's formulas for a task with no request", () => {
    const { graph } = build({ ...RELEASE, starts: { reporting: "2026-12-09" } });
    expect(node(graph, "release.prototype.es")?.formula).toBe("MAX(0,[release.ux.ef])");
    expect(node(graph, "release.prototype.earliest")?.formula).toBe("[release.prototype.es]");
    expect(node(graph, "release.prototype.startOffset")).toBeUndefined();
    expect(node(graph, "release.reporting.earliest")?.formula).toBe("MAX(0,[release.portal.ef])");
    expect(node(graph, "release.reporting.startOffset")).toEqual({
      address: "release.reporting.startOffset",
      type: "number",
      input: 27,
    });
    expect(node(graph, "release.reporting.es")?.formula).toBe(
      "MAX([release.reporting.earliest],[release.reporting.startOffset])",
    );
    for (const { formula } of graph.nodes) {
      if (formula !== undefined) expect(isProblem(checkFormula(formula))).toBe(false);
    }
  });

  test("count from the plan's first working day when the plan starts on a weekend", () => {
    const { values } = build({
      ...RELEASE,
      start: "2026-11-07",
      starts: { ux: "2026-11-11" },
    });
    expect(values.read("release.firstDay")).toBe("2026-11-09");
    expect(values.read("release.ux.startDate")).toBe("2026-11-11");
  });

  test("warn about a request that names no task", () => {
    const { graph } = build({ ...RELEASE, starts: { typo: "2026-11-10" } });
    expect(graph.warnings).toEqual([
      {
        error: "missing-reference",
        address: "release.typo",
        detail: "the requested starts name typo, which is no task of the plan",
      },
    ]);
  });

  test("leave the schedule to the start's own warning when the plan's start is no date", () => {
    const { graph } = build({ ...RELEASE, start: "soon", starts: { ux: "2026-11-11" } });
    expect(graph.warnings[0]).toMatchObject({ error: "value", address: "release.start" });
    expect(node(graph, "release.ux.startOffset")).toMatchObject({ input: 0 });
  });

  test.each([
    [{ starts: 3 }, "item release: starts is not an object"],
    [{ starts: { "a b": "2026-11-10" } }, 'item release: "a b" in starts is not an ID'],
    [
      { starts: { ux: "2026-02-30" } },
      "item release: the requested start of ux is not a date from 1900-03-01 to 9999-12-31",
    ],
    [
      { starts: { ux: 46_330 } },
      "item release: the requested start of ux is not a date from 1900-03-01 to 9999-12-31",
    ],
  ])("refuse the malformed requests %j", (extra, message) => {
    const item = { ...RELEASE, ...extra } as unknown as GanttItem;
    expect(() => build(item)).toThrow(GraphSourceError);
    expect(() => build(item)).toThrow(message);
  });

  test("are refused the same way in a plan", () => {
    const [wbs, plan] = UJ2;
    const item = { ...plan, starts: { ux: "x" } } as unknown as GanttPlanItem;
    expect(() => build(wbs, item)).toThrow(
      "item schedule: the requested start of ux is not a date from 1900-03-01 to 9999-12-31",
    );
  });
});
