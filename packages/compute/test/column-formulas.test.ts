// Column formulas (table-widget, tasks 2.2 and 2.3; compute spec: Column formulas, Column formulas
// read single fields, One warning per column; design decision 4): a `fields` item's `columns` give
// every top-level child a node `item.child.field` after its own fields; a formula text is parsed
// once per build; a column formula reads single nodes; a column's problems are one warning.

import { describe, expect, test } from "bun:test";
import { evaluateGraph } from "../src/evaluate.ts";
import { buildGraph, compiledOf } from "../src/graph/build.ts";
import { type Fields, type FieldsItem, type GraphChild, GraphSourceError } from "../src/source.ts";
import { type FormulaError, isFormulaError, type NodeResult } from "../src/types.ts";

const num = (value: number | null): Fields[string] => ({ type: "number", value });
const column = (formula: string): Fields[string] => ({ type: "number", formula });

const rows = (): readonly GraphChild[] => [
  { id: "pm", fields: { days: num(18), rate: num(1040) } },
  { id: "dev", fields: { days: num(72), rate: num(720) } },
];

const costs = (columns: Fields, children: readonly GraphChild[] = rows()): FieldsItem => ({
  kind: "fields",
  id: "costs",
  columns,
  children,
});

const read = (item: FieldsItem, address: string): NodeResult =>
  evaluateGraph(buildGraph({ items: [item] })).read(address);

const refusal = (item: FieldsItem): string => {
  try {
    buildGraph({ items: [item] });
  } catch (error) {
    expect(error).toBeInstanceOf(GraphSourceError);
    return (error as Error).message;
  }
  throw new Error("the source was accepted");
};

const errorOf = (result: NodeResult): FormulaError => {
  if (!isFormulaError(result)) throw new Error(`not an error: ${result}`);
  return result;
};

describe("column formulas", () => {
  test("every row gets the column, each reading its own row", () => {
    const item = costs({ amount: column("[@days] * [@rate]") });
    const graph = buildGraph({ items: [item] });
    expect(graph.nodes.map(({ address }) => address)).toEqual([
      "costs.pm.days",
      "costs.pm.rate",
      "costs.pm.amount",
      "costs.dev.days",
      "costs.dev.rate",
      "costs.dev.amount",
    ]);
    expect(graph.warnings).toEqual([]);
    const values = evaluateGraph(graph);
    expect(values.read("costs.pm.amount")).toBe(18_720);
    expect(values.read("costs.dev.amount")).toBe(51_840);
  });

  test("a column's node sits after its child's own fields, then the next child's", () => {
    const graph = buildGraph({
      items: [
        costs({ a: column("1"), b: column("2") }, [
          { id: "x", fields: { v: num(1) }, children: [{ id: "y", fields: { w: num(2) } }] },
          { id: "z" },
        ]),
      ],
    });
    expect(graph.nodes.map(({ address }) => address)).toEqual([
      "costs.x.v",
      "costs.x.a",
      "costs.x.b",
      "costs.y.w",
      "costs.z.a",
      "costs.z.b",
    ]);
  });

  test("a column's formulas feed each other, in the graph's order", () => {
    const item = costs({ amount: column("[@days] * [@rate]"), half: column("[@amount] / 2") });
    expect(read(item, "costs.pm.half")).toBe(9_360);
  });

  test("a grandchild gets no column entry", () => {
    const graph = buildGraph({
      items: [costs({ amount: column("1") }, [{ id: "top", children: [{ id: "deep" }] }])],
    });
    const addresses = graph.nodes.map(({ address }) => address);
    expect(addresses).toEqual(["costs.top.amount"]);
    expect(evaluateGraph(graph).read("costs.deep.amount")).toMatchObject({
      error: "missing-reference",
    });
  });

  test("an item with columns and no children has no column node", () => {
    const graph = buildGraph({ items: [costs({ amount: column("1") }, [])] });
    expect(graph.nodes).toEqual([]);
  });

  test("a money column's formula keeps its currency", () => {
    const item = costs({ amount: { type: "money", formula: "[@days] * 2", currency: "USD" } });
    const graph = buildGraph({ items: [item] });
    expect(graph.nodes.find(({ address }) => address === "costs.pm.amount")).toMatchObject({
      type: "money",
      currency: "USD",
    });
  });
});

describe("a malformed column source is refused, naming the item", () => {
  test("a row that holds the column's field itself", () => {
    const item = costs({ amount: column("1") }, [
      { id: "pm", fields: { days: num(1), amount: num(5) } },
    ]);
    const message = refusal(item);
    expect(message).toContain("costs");
    expect(message).toContain("pm");
    expect(message).toContain("amount");
  });

  test("a column input with a value and no formula", () => {
    const message = refusal(costs({ amount: num(5) }));
    expect(message).toContain("item costs");
    expect(message).toContain("amount");
  });

  test("a column with both a value and a formula, a name that is no field, and columns that are no object", () => {
    expect(refusal(costs({ amount: { type: "number", value: 1, formula: "1" } }))).toContain(
      "item costs",
    );
    expect(refusal(costs({ A1: column("1") }))).toContain("item costs");
    expect(refusal({ ...costs({}), columns: [] as unknown as Fields })).toContain("item costs");
  });
});

describe("a formula is parsed once per build", () => {
  const many = (count: number): readonly GraphChild[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `r${index + 1}`,
      fields: { days: num(index), rate: num(2) },
    }));

  test("200 rows of one column share one compiled expression", () => {
    const graph = buildGraph({
      items: [costs({ amount: column("[@days] * [@rate]") }, many(200))],
    });
    const compiled = compiledOf(graph).nodes.filter(({ address }) => address.endsWith(".amount"));
    expect(compiled).toHaveLength(200);
    const [first] = compiled;
    for (const node of compiled) expect(node.formula?.expression).toBe(first?.formula?.expression);
    const values = evaluateGraph(graph);
    expect(values.read("costs.r1.amount")).toBe(0);
    expect(values.read("costs.r200.amount")).toBe(398);
    expect(graph.warnings).toEqual([]);
  });

  test("the same text on nodes of two items is parsed once; resolution stays per node", () => {
    const own = (id: string, days: number): FieldsItem => ({
      kind: "fields",
      id,
      columns: { twice: column("[@days] * 2") },
      children: [{ id: `${id}row`, fields: { days: num(days) } }],
    });
    const graph = buildGraph({ items: [own("a", 1), own("b", 5)] });
    const [a, b] = compiledOf(graph).nodes.filter(({ address }) => address.endsWith(".twice"));
    expect(a?.formula?.expression).toBe(b?.formula?.expression);
    expect(a?.formula?.references).not.toEqual(b?.formula?.references);
    const values = evaluateGraph(graph);
    expect([values.read("a.arow.twice"), values.read("b.brow.twice")]).toEqual([2, 10]);
  });

  test("a formula that does not parse is parsed once and is the same problem on every row", () => {
    const graph = buildGraph({ items: [costs({ amount: column("[@days] *") }, many(3))] });
    const errors = ["r1", "r2", "r3"].map((id) =>
      errorOf(evaluateGraph(graph).read(`costs.${id}.amount`)),
    );
    expect(errors.map(({ error }) => error)).toEqual(["syntax", "syntax", "syntax"]);
    expect(new Set(errors.map(({ detail }) => detail)).size).toBe(1);
  });
});

describe("names that are object names", () => {
  test("a row `__proto__` and a column `constructor` are data", () => {
    const item = costs(
      { constructor: column("[@days] * 2"), toString: column("[@constructor] + 1") },
      [
        { id: "__proto__", fields: { days: num(4) } },
        { id: "constructor", fields: { days: num(5) } },
      ],
    );
    const values = evaluateGraph(buildGraph({ items: [item] }));
    expect(values.read("costs.__proto__.constructor")).toBe(8);
    expect(values.read("costs.__proto__.toString")).toBe(9);
    expect(values.read("costs.constructor.constructor")).toBe(10);
  });

  test("a child's own field named like a column's is refused even through an object name", () => {
    const item = costs({ constructor: column("1") }, [
      { id: "pm", fields: { constructor: num(1) } },
    ]);
    expect(refusal(item)).toContain("constructor");
  });
});
