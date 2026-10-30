import { describe, expect, test } from "bun:test";
import { buildGraph, compiledOf, type ResolvedReference } from "../src/graph/build.ts";
import type { FieldInput, GraphChild, GraphItem, GraphSource } from "../src/source.ts";

const num = (value: number | null = null): FieldInput => ({ type: "number", value });
const formula = (text: string): FieldInput => ({ type: "number", formula: text });

// wbs: design (ux, architecture), build (portal, with child api); every node has `expected`,
// leaves also `optimistic`; `note` only on design.
const tree: readonly GraphChild[] = [
  {
    id: "design",
    fields: { expected: num(1), note: { type: "text", value: "d" } },
    children: [
      { id: "ux", fields: { expected: num(2), optimistic: num(3) } },
      { id: "architecture", fields: { expected: num(4), optimistic: num(5) } },
    ],
  },
  {
    id: "build",
    fields: { expected: num(6) },
    children: [
      {
        id: "portal",
        fields: { expected: num(7) },
        children: [{ id: "api", fields: { expected: num(8) } }],
      },
    ],
  },
];

const sheet: GraphItem = {
  kind: "fields",
  id: "sheet",
  cells: { A1: num(1), B1: num(2), A2: num(3), C3: num(9) },
};

const resolve = (text: string, items: readonly GraphItem[] = []): readonly ResolvedReference[] => {
  const source: GraphSource = {
    items: [
      { kind: "fields", id: "wbs", children: tree },
      sheet,
      ...items,
      { kind: "fields", id: "t", fields: { r: formula(text) } },
    ],
  };
  const graph = buildGraph(source);
  const node = compiledOf(graph).nodes.find((n) => n.address === "t.r");
  if (node?.formula === undefined) throw new Error(JSON.stringify(graph.warnings));
  return node.formula.references;
};

const warningOf = (
  text: string,
): { error: string; address: string; detail?: string } | undefined => {
  const graph = buildGraph({
    items: [
      { kind: "fields", id: "wbs", children: tree },
      sheet,
      { kind: "fields", id: "t", fields: { r: formula(text) } },
    ],
  });
  return graph.warnings.find((w) => w.address === "t.r");
};

describe("flat references", () => {
  test("read an item field, and a child's field at any depth by its own ID", () => {
    expect(resolve("[wbs.ux.optimistic]+[wbs.api.expected]")).toEqual([
      { list: false, address: "wbs.ux.optimistic" },
      { list: false, address: "wbs.api.expected" },
    ]);
  });

  test("read a wildcard's nodes in document order", () => {
    expect(resolve("SUM([wbs.design.*.expected])")).toEqual([
      { list: true, addresses: ["wbs.ux.expected", "wbs.architecture.expected"] },
    ]);
    expect(resolve("SUM([wbs.*.expected])")).toEqual([
      { list: true, addresses: ["wbs.design.expected", "wbs.build.expected"] },
    ]);
    expect(resolve("SUM([wbs.*.*.expected])")).toEqual([
      {
        list: true,
        addresses: ["wbs.ux.expected", "wbs.architecture.expected", "wbs.portal.expected"],
      },
    ]);
    expect(resolve("SUM([wbs.build.*.*.expected])")).toEqual([
      { list: true, addresses: ["wbs.api.expected"] },
    ]);
  });

  test("skip nodes without the field", () => {
    expect(resolve("SUM([wbs.*.*.optimistic])")).toEqual([
      { list: true, addresses: ["wbs.ux.optimistic", "wbs.architecture.optimistic"] },
    ]);
  });

  test("read the same node after it moves in the tree", () => {
    const moved: GraphItem = {
      kind: "fields",
      id: "moved",
      children: [{ id: "a", children: [{ id: "ux", fields: { v: num(1) } }] }, { id: "b" }],
    };
    const after: GraphItem = {
      kind: "fields",
      id: "moved",
      children: [{ id: "a" }, { id: "b", children: [{ id: "ux", fields: { v: num(1) } }] }],
    };
    expect(resolve("[moved.ux.v]", [moved])).toEqual(resolve("[moved.ux.v]", [after]));
  });
});

describe("cells and ranges", () => {
  test("read a cell, and an empty cell of a known item as empty", () => {
    expect(resolve("[sheet.B1]+[sheet.Z9]")).toEqual([
      { list: false, address: "sheet.B1" },
      { list: false, address: null },
    ]);
  });

  test("read a range row by row, from either corner, empty cells as empty", () => {
    const rows: ResolvedReference = {
      list: true,
      addresses: ["sheet.A1", "sheet.B1", "sheet.A2", null],
    };
    expect(resolve("SUM([sheet.A1:B2])")).toEqual([rows]);
    expect(resolve("SUM([sheet.B2:A1])")).toEqual([rows]);
    expect(resolve("SUM([sheet.A2:B1])")).toEqual([rows]);
  });
});

describe("missing references", () => {
  test.each([
    ["[wbs.nope]", "reference [wbs.nope] names no node"],
    ["[wbs.ux.nope]", "reference [wbs.ux.nope] names no node"],
    ["[wbs.nope.expected]", "reference [wbs.nope.expected] names no child nope of wbs"],
    ["[nope.v]", "reference [nope.v] names no item nope"],
    ["SUM([nope.*.v])", "reference [nope.*.v] names no item nope"],
    ["SUM([wbs.nope.*.v])", "reference [wbs.nope.*.v] names no child nope of wbs"],
    ["SUM([wbs.*.nope])", "wildcard [wbs.*.nope] matches no node"],
    ["SUM([wbs.ux.*.expected])", "wildcard [wbs.ux.*.expected] matches no node"],
    ["SUM([wbs.*.*.*.*.expected])", "wildcard [wbs.*.*.*.*.expected] matches no node"],
    ["[nope.A1]", "reference [nope.A1] names no item nope"],
    ["SUM([nope.A1:B2])", "reference [nope.A1:B2] names no item nope"],
    ["[sheet.a1]", "reference [sheet.a1] names no node"],
  ])("%s is a missing reference", (text, detail) => {
    expect(warningOf(text)).toEqual({ error: "missing-reference", address: "t.r", detail });
  });
});
