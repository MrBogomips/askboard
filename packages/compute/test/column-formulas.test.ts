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

// Task 2.3: single reads, one warning per column.

const withTotal = (columns: Fields, total = "SUM([costs.*.amount])"): FieldsItem => ({
  ...costs(columns),
  fields: { amount: column(total) },
});

describe("column formulas read single fields", () => {
  test("a column reads a total of its item: each row reads its share", () => {
    const item = withTotal({
      amount: column("[@days] * [@rate]"),
      share: column("[@amount] / [costs.amount]"),
    });
    const values = evaluateGraph(buildGraph({ items: [item] }));
    expect(values.read("costs.amount")).toBe(70_560);
    expect(values.read("costs.pm.share")).toBeCloseTo(18_720 / 70_560, 12);
    expect(values.read("costs.dev.share")).toBeCloseTo(51_840 / 70_560, 12);
  });

  test("a wildcard in a column formula is over-limit at every row, whatever else it holds", () => {
    for (const text of [
      "[@amount] / SUM([costs.*.amount])",
      "SUM([costs.pm.*.amount])",
      "[@amount] + [nowhere.x] + SUM([costs.*.amount])",
      "[@amount] + [@rte] + SUM([costs.*.amount])",
    ]) {
      const item = withTotal({ amount: column("[@days]"), share: column(text) });
      const values = evaluateGraph(buildGraph({ items: [item] }));
      for (const row of ["pm", "dev"]) {
        const error = errorOf(values.read(`costs.${row}.share`));
        expect([text, error.error]).toEqual([text, "over-limit"]);
        expect(error.detail).toContain("single fields");
      }
    }
  });

  test("a formula that does not parse stays a syntax problem, not over-limit", () => {
    const item = costs({ share: column("SUM([costs.*.days]) *") });
    expect(errorOf(read(item, "costs.pm.share")).error).toBe("syntax");
  });

  test("a cell reference reads a single node, a range is over-limit", () => {
    const sheet: FieldsItem = { kind: "fields", id: "sheet", cells: { A1: num(5), B1: num(6) } };
    const [first, ...rest] = [
      costs({ one: column("[sheet.A1] + [@days]"), many: column("SUM([sheet.A1:B1])") }),
    ];
    const values = evaluateGraph(buildGraph({ items: [sheet, first as FieldsItem, ...rest] }));
    expect(values.read("costs.pm.one")).toBe(23);
    expect(errorOf(values.read("costs.pm.many")).error).toBe("over-limit");
  });

  test("a range or a wildcard in a field formula outside a column is as before", () => {
    const item: FieldsItem = {
      ...costs({}),
      fields: { total: column("SUM([costs.*.days])") },
    };
    expect(read(item, "costs.total")).toBe(90);
  });
});

describe("one warning per column", () => {
  const rowsOf = (count: number): readonly GraphChild[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `r${index + 1}`,
      fields: { days: num(index) },
    }));

  test("a formula that does not parse, over 200 rows: one warning and 200 errors", () => {
    const graph = buildGraph({ items: [costs({ amount: column("[@days] *") }, rowsOf(200))] });
    expect(graph.warnings).toHaveLength(1);
    expect(graph.warnings[0]).toMatchObject({ error: "syntax", address: "costs.*.amount" });
    const values = evaluateGraph(graph);
    for (let row = 1; row <= 200; row++) {
      expect(errorOf(values.read(`costs.r${row}.amount`)).error).toBe("syntax");
    }
  });

  test("a misspelt field: one missing-reference warning whose detail quotes the reference", () => {
    const graph = buildGraph({ items: [costs({ amount: column("[@days] * [@rte]") })] });
    expect(graph.warnings).toHaveLength(1);
    expect(graph.warnings[0]).toMatchObject({
      error: "missing-reference",
      address: "costs.*.amount",
    });
    expect(graph.warnings[0]?.detail).toContain("[@rte]");
  });

  test("a cycle through a column is one warning", () => {
    const graph = buildGraph({ items: [costs({ a: column("[@a] + 1") })] });
    expect(graph.warnings).toEqual([{ error: "cycle", address: "costs.*.a" }]);
  });

  test("two columns in error give two warnings", () => {
    const graph = buildGraph({
      items: [costs({ a: column("[@days] *"), b: column("[@days] * [@rte]") })],
    });
    expect(graph.warnings.map(({ error, address }) => `${error}@${address}`)).toEqual([
      "syntax@costs.*.a",
      "missing-reference@costs.*.b",
    ]);
  });

  test("a problem of another detail in the same column is another warning", () => {
    const currency = (code: string): Fields[string] => ({
      type: "money",
      value: "1.00",
      currency: code,
    });
    const item = costs({ amount: { type: "money", formula: "[@a] + [@b]", currency: "USD" } }, [
      { id: "x", fields: { a: currency("EUR"), b: currency("USD") } },
      { id: "y", fields: { a: currency("GBP"), b: currency("USD") } },
      { id: "z", fields: { a: currency("EUR"), b: currency("USD") } },
    ]);
    const graph = buildGraph({ items: [item] });
    expect(graph.warnings.map(({ error, address, detail }) => [error, address, detail])).toEqual([
      ["mixed-currencies", "costs.*.amount", "amounts in EUR, USD"],
      ["mixed-currencies", "costs.*.amount", "amounts in GBP, USD"],
    ]);
    const values = evaluateGraph(graph);
    for (const row of ["x", "y", "z"]) {
      expect(errorOf(values.read(`costs.${row}.amount`)).error).toBe("mixed-currencies");
    }
  });

  test("a value error that depends on one row's values gives no warning", () => {
    const item = costs({ ratio: column("[@days] / [@rate]") }, [
      { id: "ok", fields: { days: num(4), rate: num(2) } },
      { id: "zero", fields: { days: num(4), rate: num(0) } },
    ]);
    const graph = buildGraph({ items: [item] });
    expect(graph.warnings).toEqual([]);
    const values = evaluateGraph(graph);
    expect(values.read("costs.ok.ratio")).toBe(2);
    expect(isFormulaError(values.read("costs.zero.ratio"))).toBe(true);
  });

  test("a total's own error is a separate warning at item.field", () => {
    const item = withTotal({ amount: column("[@days] *") }, "SUM([costs.*.zzz])");
    const graph = buildGraph({ items: [item] });
    expect(graph.warnings.map(({ error, address }) => `${error}@${address}`)).toEqual([
      "missing-reference@costs.amount",
      "syntax@costs.*.amount",
    ]);
  });

  test("a total that reads the failing column inherits the error and adds no warning", () => {
    const graph = buildGraph({ items: [withTotal({ amount: column("[@days] *") })] });
    expect(graph.warnings.map(({ address }) => address)).toEqual(["costs.*.amount"]);
    expect(errorOf(evaluateGraph(graph).read("costs.amount")).error).toBe("syntax");
  });

  test("a row's own field formula in error keeps its own address", () => {
    const item = costs({}, [
      { id: "pm", fields: { x: column("[@days] *") } },
      { id: "dev", fields: { x: column("[@days] *") } },
    ]);
    expect(buildGraph({ items: [item] }).warnings.map(({ address }) => address)).toEqual([
      "costs.pm.x",
      "costs.dev.x",
    ]);
  });

  test("the warnings come in one order over ten builds", () => {
    const build = () =>
      JSON.stringify(
        buildGraph({
          items: [
            costs({ a: column("[@days] *"), b: column("[@zz]"), c: column("[@c]") }, rowsOf(30)),
          ],
        }).warnings,
      );
    const first = build();
    for (let i = 0; i < 10; i++) expect(build()).toBe(first);
    expect(JSON.parse(first)).toHaveLength(3);
  });
});
