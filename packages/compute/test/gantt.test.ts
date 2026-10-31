import { describe, expect, test } from "bun:test";
import { evaluateGraph } from "../src/evaluate.ts";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import { buildGraph } from "../src/graph/build.ts";
import { type GanttItem, type GraphItem, GraphSourceError } from "../src/source.ts";
import { GANTT_FIXTURES } from "./fixtures/gantt.ts";
import { runAll, runGantt, Tally } from "./fixtures/suite.ts";
import uj2 from "./fixtures/uj2-wbs-gantt.json" with { type: "json" };

// UJ-2's six work packages with the durations its plan computes from their PERT estimates.
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

const gantt = (extra: Partial<GanttItem> = {}): GanttItem => ({ ...RELEASE, ...extra });

const build = (...items: GraphItem[]) => {
  const graph = buildGraph({ items });
  return { graph, values: evaluateGraph(graph) };
};

const SCHEDULE_FIELDS = [
  "duration",
  "es",
  "ef",
  "lf",
  "ls",
  "slack",
  "critical",
  "startDate",
  "finishDate",
] as const;

describe("a Gantt with its own tasks", () => {
  test("is scheduled as the UJ-2 plan is, with each duration as given", () => {
    const own = build(gantt());
    const plan = build(...(uj2.items as unknown as GraphItem[]));
    expect(own.graph.warnings).toEqual([]);
    for (const { id } of RELEASE.tasks) {
      for (const field of SCHEDULE_FIELDS) {
        expect({ at: `${id}.${field}`, value: own.values.read(`release.${id}.${field}`) }).toEqual({
          at: `${id}.${field}`,
          value: plan.values.read(`schedule.${id}.${field}`),
        });
      }
    }
    expect(own.values.read("release.finish")).toBe(30);
    expect(own.values.read("release.finishDate")).toBe("2026-12-11");
    expect(
      RELEASE.tasks.filter(({ id }) => own.values.read(`release.${id}.critical`) === true),
    ).toEqual([
      { id: "ux", duration: 6 },
      { id: "prototype", duration: 5 },
      { id: "portal", duration: 13 },
      { id: "reporting", duration: 6 },
    ]);
  });

  test("takes each duration as a number input, which an edit can set", () => {
    const { graph, values } = build(gantt());
    expect(graph.nodes.find((node) => node.address === "release.portal.duration")).toEqual({
      address: "release.portal.duration",
      type: "number",
      input: 13,
    });
    values.set("release.portal.duration", 16);
    values.recalc();
    expect(values.read("release.reporting.startDate")).toBe("2026-12-09");
    expect(values.read("release.finishDate")).toBe("2026-12-16");
  });

  test("writes every scheduling field as a formula over the whitelist", () => {
    const { graph } = build(gantt());
    const formulas = graph.nodes.filter((node) => node.formula !== undefined);
    expect(formulas.length).toBeGreaterThan(40);
    for (const node of formulas)
      expect(isProblem(checkFormula(node.formula as string))).toBe(false);
  });

  test("makes a cycle and an unknown predecessor warnings, as a plan does", () => {
    const { graph, values } = build(
      gantt({ dependencies: { ux: ["architecture"], architecture: ["ux"], billing: ["nope"] } }),
    );
    const at = graph.warnings.map((w) => `${w.error}@${w.address}`);
    expect(at).toContain("cycle@release.ux.es");
    expect(at).toContain("cycle@release.architecture.es");
    expect(at).toContain("missing-reference@release.billing.es");
    expect(values.read("release.finish")).toMatchObject({ error: "cycle" });
  });

  test("warns about a dependency that names no task", () => {
    const { graph } = build(gantt({ dependencies: { typo: ["ux"] } }));
    expect(graph.warnings).toEqual([
      {
        error: "missing-reference",
        address: "release.typo",
        detail: "the dependencies name typo, which is no task of the plan",
      },
    ]);
  });

  test.each([
    [{ tasks: 3 }, "item release: tasks is not a list"],
    [{ tasks: [3] }, "item release: a task is not an object"],
    [{ tasks: [{ id: "a b", duration: 1 }] }, 'item release: task ID "a b" is not'],
    [
      {
        tasks: [
          { id: "a", duration: 1 },
          { id: "a", duration: 2 },
        ],
      },
      "item release: task ID a is used twice",
    ],
    [{ tasks: [{ id: "a" }] }, "item release: the duration of a is not a positive whole number"],
    [
      { tasks: [{ id: "a", duration: 0 }] },
      "item release: the duration of a is not a positive whole number",
    ],
    [
      { tasks: [{ id: "a", duration: 2.5 }] },
      "item release: the duration of a is not a positive whole number",
    ],
    [
      { tasks: [{ id: "a", duration: "2" }] },
      "item release: the duration of a is not a positive whole number",
    ],
    [
      { dependencies: { a: "b" } },
      "item release: the dependencies of a are not a list of task IDs",
    ],
  ])("refuses the malformed Gantt %j", (extra, message) => {
    const item = gantt(extra as unknown as Partial<GanttItem>);
    expect(() => build(item)).toThrow(GraphSourceError);
    expect(() => build(item)).toThrow(message);
  });
});

describe("the Gantt fixtures", () => {
  test("read as expected, with no warning, and join the determinism hash", () => {
    const tally = new Tally();
    runGantt(tally);
    expect(tally.failures).toEqual([]);
    expect(tally.exactMismatches).toEqual([]);
    // release: UJ-2's schedule values for six tasks and the plan; two requested-start fixtures.
    expect(tally.passed).toBe(Object.keys(GANTT_FIXTURES[0]?.expected ?? {}).length + 11 * 2 + 3);
    expect(Object.keys(runAll().results)).toContain("gantt:uj2-requested");
  });
});
