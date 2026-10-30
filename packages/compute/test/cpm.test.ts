import { describe, expect, test } from "bun:test";
import { evaluateGraph } from "../src/evaluate.ts";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import { buildGraph } from "../src/graph/build.ts";
import {
  type GanttPlanItem,
  type GraphItem,
  GraphSourceError,
  type WbsNode,
} from "../src/source.ts";

// Four packages of 2, 3, 1 and 4 days: a → b → c, and d alone.
const NODES: readonly WbsNode[] = [
  { id: "a", optimistic: 2, mostLikely: 2, pessimistic: 2 },
  { id: "b", optimistic: 2.5, mostLikely: 2.5, pessimistic: 2.5 },
  { id: "c", optimistic: 0.2, mostLikely: 0.2, pessimistic: 0.2 },
  { id: "d", optimistic: 4, mostLikely: 4, pessimistic: 4 },
];

const plan = (extra: Partial<GanttPlanItem> = {}): GanttPlanItem => ({
  kind: "gantt-plan",
  id: "plan",
  workPackages: "wbs",
  start: "2026-11-02",
  dependencies: { b: ["a"], c: ["b"] },
  ...extra,
});

const build = (...items: GraphItem[]) => {
  const graph = buildGraph({ items: [{ kind: "wbs-pert", id: "wbs", nodes: NODES }, ...items] });
  return { graph, values: evaluateGraph(graph) };
};

const fieldsOf = (values: ReturnType<typeof evaluateGraph>, task: string) =>
  Object.fromEntries(
    ["duration", "es", "ef", "ls", "lf", "slack", "critical", "startDate", "finishDate"].map(
      (field) => [field, values.read(`plan.${task}.${field}`)],
    ),
  );

describe("CPM scheduling", () => {
  test("schedules the WBS's leaves forward and backward, in working days", () => {
    const { graph, values } = build(plan());
    expect(graph.warnings).toEqual([]);
    expect(fieldsOf(values, "a")).toEqual({
      duration: 2,
      es: 0,
      ef: 2,
      ls: 0,
      lf: 2,
      slack: 0,
      critical: true,
      startDate: "2026-11-02",
      finishDate: "2026-11-03",
    });
    expect(fieldsOf(values, "c")).toMatchObject({
      duration: 1,
      es: 5,
      ef: 6,
      slack: 0,
      critical: true,
    });
    expect(fieldsOf(values, "d")).toMatchObject({
      duration: 4,
      es: 0,
      ef: 4,
      lf: 6,
      ls: 2,
      slack: 2,
      critical: false,
    });
    expect(values.read("plan.finish")).toBe(6);
    expect(values.read("plan.finishDate")).toBe("2026-11-09");
  });

  test("writes every field as a formula over the whitelist", () => {
    const { graph } = build(plan());
    const formulas = graph.nodes.filter((node) => node.address.startsWith("plan."));
    expect(formulas.find((node) => node.address === "plan.b.es")?.formula).toBe(
      "MAX(0,[plan.a.ef])",
    );
    expect(formulas.find((node) => node.address === "plan.a.lf")?.formula).toBe("MIN([plan.b.ls])");
    expect(formulas.find((node) => node.address === "plan.d.lf")?.formula).toBe("[plan.finish]");
    for (const node of formulas) {
      if (node.formula !== undefined) expect(isProblem(checkFormula(node.formula))).toBe(false);
    }
  });

  test("starts a plan that begins on a weekend on the Monday after", () => {
    const { values } = build(plan({ start: "2026-11-07" }));
    expect(values.read("plan.firstDay")).toBe("2026-11-09");
    expect(values.read("plan.a.startDate")).toBe("2026-11-09");
  });

  test("moves the schedule when an estimate or the start changes", () => {
    const { values } = build(plan());
    values.set("wbs.a.pessimistic", 8);
    values.set("plan.start", "2026-11-04");
    values.recalc();
    expect(values.read("plan.a.duration")).toBe(3);
    expect(values.read("plan.finish")).toBe(7);
    expect(values.read("plan.finishDate")).toBe("2026-11-12");
  });

  test("makes a dependency cycle a cycle warning on each scheduling field", () => {
    const { graph, values } = build(plan({ dependencies: { a: ["b"], b: ["a"] } }));
    expect(graph.warnings.map((w) => `${w.error}@${w.address}`).sort()).toEqual(
      [
        "plan.a.es",
        "plan.a.ef",
        "plan.a.lf",
        "plan.a.ls",
        "plan.b.es",
        "plan.b.ef",
        "plan.b.lf",
        "plan.b.ls",
      ]
        .map((address) => `cycle@${address}`)
        .sort(),
    );
    expect(values.read("plan.finish")).toMatchObject({ error: "cycle" });
  });

  test("warns about a predecessor or a dependency that names no task", () => {
    const { graph } = build(plan({ dependencies: { b: ["nope"], typo: ["a"] } }));
    expect(graph.warnings).toEqual([
      {
        error: "missing-reference",
        address: "plan.typo",
        detail: "the dependencies name typo, which is no task of the plan",
      },
      {
        error: "missing-reference",
        address: "plan.b.es",
        detail: "reference [plan.nope.ef] names no child nope of plan",
      },
    ]);
  });

  test("warns about work packages that name no WBS", () => {
    const { graph, values } = build(plan({ workPackages: "nope" }));
    expect(graph.warnings).toEqual([
      {
        error: "missing-reference",
        address: "plan.workPackages",
        detail: "the work packages nope name no WBS-with-PERT item",
      },
      {
        error: "missing-reference",
        address: "plan.finish",
        detail: "wildcard [plan.*.ef] matches no node",
      },
    ]);
    expect(values.read("plan.finishDate")).toMatchObject({ error: "missing-reference" });
  });

  test.each([
    [{ dependencies: 3 }, "item plan: dependencies is not an object"],
    [{ dependencies: { a: "b" } }, "item plan: the dependencies of a are not a list of task IDs"],
    [{ dependencies: { a: [1] } }, "item plan: the dependencies of a are not a list of task IDs"],
    [{ workPackages: 3 }, "item plan: workPackages is not an item ID"],
  ])("refuses the malformed plan %j", (extra, message) => {
    expect(() => build(plan(extra as unknown as Partial<GanttPlanItem>))).toThrow(GraphSourceError);
    expect(() => build(plan(extra as unknown as Partial<GanttPlanItem>))).toThrow(message);
  });

  test("reads a start that is no date as a value warning", () => {
    const { graph } = build(plan({ start: "soon" }));
    expect(graph.warnings[0]).toEqual({
      error: "value",
      address: "plan.start",
      detail: '"soon" is not a date from 1900-03-01 to 9999-12-31',
    });
  });
});
