import { describe, expect, test } from "bun:test";
import { evaluateGraph } from "../src/evaluate.ts";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import { buildGraph } from "../src/graph/build.ts";
import { type GraphItem, GraphSourceError, type WbsNode } from "../src/source.ts";

const wbs = (nodes: readonly WbsNode[]): GraphItem => ({ kind: "wbs-pert", id: "wbs", nodes });

// UJ-2's WBS (the approved model-contract example), estimates only.
const UJ2: readonly WbsNode[] = [
  {
    id: "design",
    children: [
      { id: "ux", optimistic: 3, mostLikely: 5, pessimistic: 10 },
      { id: "architecture", optimistic: 2, mostLikely: 4, pessimistic: 6 },
      { id: "prototype", optimistic: 3, mostLikely: 4, pessimistic: 8 },
    ],
  },
  {
    id: "build",
    children: [
      { id: "portal", optimistic: 8, mostLikely: 12, pessimistic: 20 },
      { id: "billing", optimistic: 5, mostLikely: 8, pessimistic: 15 },
      { id: "reporting", optimistic: 3, mostLikely: 5, pessimistic: 9 },
    ],
  },
];

const valuesOf = (nodes: readonly WbsNode[]) => {
  const graph = buildGraph({ items: [wbs(nodes)] });
  return { graph, values: evaluateGraph(graph) };
};

describe("PERT", () => {
  test("writes each leaf's and each parent's fields as formulas over the whitelist", () => {
    const { graph } = valuesOf([{ id: "design", children: [{ id: "ux", optimistic: 3 }] }]);
    expect(graph.nodes).toEqual([
      { address: "wbs.expected", type: "number", formula: "SUM([wbs.*.expected])" },
      { address: "wbs.spread", type: "number", formula: "SQRT(SUMSQ([wbs.*.spread]))" },
      { address: "wbs.design.expected", type: "number", formula: "SUM([wbs.design.*.expected])" },
      {
        address: "wbs.design.spread",
        type: "number",
        formula: "SQRT(SUMSQ([wbs.design.*.spread]))",
      },
      { address: "wbs.ux.optimistic", type: "number", input: 3 },
      { address: "wbs.ux.mostLikely", type: "number", input: null },
      { address: "wbs.ux.pessimistic", type: "number", input: null },
      {
        address: "wbs.ux.expected",
        type: "number",
        formula: "([wbs.ux.optimistic]+4*[wbs.ux.mostLikely]+[wbs.ux.pessimistic])/6",
      },
      {
        address: "wbs.ux.spread",
        type: "number",
        formula: "([wbs.ux.pessimistic]-[wbs.ux.optimistic])/6",
      },
    ]);
    for (const node of graph.nodes) {
      if (node.formula !== undefined) expect(isProblem(checkFormula(node.formula))).toBe(false);
    }
  });

  test("gives UJ-2's expected efforts and spreads, rolled up to every parent and the item", () => {
    const { graph, values } = valuesOf(UJ2);
    expect(graph.warnings).toEqual([]);
    expect(values.read("wbs.ux.expected")).toBe(5.5);
    expect(values.read("wbs.ux.spread")).toBeCloseTo(7 / 6, 12);
    expect(values.read("wbs.design.expected")).toBe(14);
    expect(values.read("wbs.design.spread")).toBeCloseTo(1.5811388300841898, 12);
    expect(values.read("wbs.expected")).toBeCloseTo(40.666666666666664, 12);
    expect(values.read("wbs.spread")).toBeCloseTo(3.205897343611891, 12);
  });

  test("rolls up through any depth", () => {
    const { values } = valuesOf([
      {
        id: "a",
        children: [
          { id: "b", children: [{ id: "c", optimistic: 6, mostLikely: 6, pessimistic: 6 }] },
        ],
      },
      { id: "d", optimistic: 0, mostLikely: 3, pessimistic: 6 },
    ]);
    expect([
      values.read("wbs.b.expected"),
      values.read("wbs.a.expected"),
      values.read("wbs.expected"),
    ]).toEqual([6, 6, 9]);
    expect(values.read("wbs.spread")).toBe(1);
  });

  test("sums a split package's children and ignores its own estimates", () => {
    const { values } = valuesOf([
      {
        id: "ux",
        optimistic: 100,
        mostLikely: 100,
        pessimistic: 100,
        children: [
          { id: "research", optimistic: 1, mostLikely: 2, pessimistic: 3 },
          { id: "screens", optimistic: 2, mostLikely: 3, pessimistic: 10 },
        ],
      },
    ]);
    expect(values.read("wbs.ux.expected")).toBe(6);
    expect(values.read("wbs.ux.optimistic")).toMatchObject({ error: "missing-reference" });
  });

  test("reads empty estimates as 0, and a non-number estimate as a value warning", () => {
    const { graph, values } = valuesOf([
      { id: "a" },
      { id: "b", optimistic: "3" as unknown as number, mostLikely: 1, pessimistic: 1 },
    ]);
    expect(values.read("wbs.a.expected")).toBe(0);
    expect(graph.warnings).toEqual([
      { error: "value", address: "wbs.b.optimistic", detail: "a number, not text" },
    ]);
    expect(values.read("wbs.expected")).toMatchObject({
      error: "value",
      address: "wbs.b.optimistic",
    });
  });

  test.each([
    [{ kind: "wbs-pert", id: "wbs" }, "item wbs: nodes is not a list"],
    [{ kind: "wbs-pert", id: "wbs", nodes: [3] }, "item wbs: a node is not an object"],
    [
      { kind: "wbs-pert", id: "wbs", nodes: [{ id: "a", children: 3 }] },
      "item wbs, node a: children is not a list",
    ],
    [{ kind: "wbs-pert", id: "wbs", nodes: [{ id: "a b" }] }, 'item wbs: child ID "a b" is not'],
  ])("refuses the malformed WBS %j", (item, message) => {
    expect(() => buildGraph({ items: [item as GraphItem] })).toThrow(GraphSourceError);
    expect(() => buildGraph({ items: [item as GraphItem] })).toThrow(message);
  });
});
