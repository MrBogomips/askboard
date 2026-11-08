// Row references (table-widget, task 2.1; compute spec: Row references; design decision 4): `[@field]`
// reads that field of the same child, as Excel's this-row reference; on any other node it is
// `missing-reference`; a name that is no field name is `syntax`. A row ID shaped like a cell (`A1`)
// is a row, never a cell (review U-2).

import { describe, expect, test } from "bun:test";
import { evaluateGraph } from "../src/evaluate.ts";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import { lex, parseReference } from "../src/formula/lexer.ts";
import { buildGraph } from "../src/graph/build.ts";
import { referenceText } from "../src/graph/resolve.ts";
import type { Fields, FieldsItem, GraphChild } from "../src/source.ts";
import type { FormulaError, NodeResult } from "../src/types.ts";

const num = (value: number | null): Fields[string] => ({ type: "number", value });
const formula = (text: string): Fields[string] => ({ type: "number", formula: text });

const read = (items: readonly FieldsItem[], address: string): NodeResult =>
  evaluateGraph(buildGraph({ items })).read(address);

const errorOf = (result: NodeResult): FormulaError => {
  if (typeof result !== "object" || result === null) throw new Error(`not an error: ${result}`);
  return result;
};

const costs = (...children: GraphChild[]): FieldsItem => ({
  kind: "fields",
  id: "costs",
  children,
});

describe("the row reference's syntax", () => {
  test("reads [@field] as a row reference and writes it back as @field", () => {
    expect(parseReference("@days")).toEqual({ form: "row", field: "days" });
    expect(referenceText({ form: "row", field: "days" })).toBe("@days");
    const lexed = lex("[@days] * 2");
    if (!lexed.ok) throw new Error(lexed.reason);
    expect(lexed.tokens[0]).toMatchObject({
      kind: "reference",
      reference: { form: "row", field: "days" },
      source: "@days",
    });
  });

  test("keeps a lower-case or mixed-case field, and a field named like an object name", () => {
    for (const field of ["a", "rate2", "constructor", "toString", "hasOwnProperty", "a1", "q1"]) {
      expect(parseReference(`@${field}`)).toEqual({ form: "row", field });
    }
  });

  test("reads [@ a], [@1a], [@A1], [@a.b], [@] and the like as syntax", () => {
    for (const body of ["@ a", "@1a", "@A1", "@XFD1048576", "@a.b", "@", "@_a", "@a-b", "@@a"]) {
      expect([body, typeof parseReference(body)]).toEqual([body, "string"]);
      const checked = checkFormula(`[${body}]`);
      expect([body, isProblem(checked) ? checked.kind : "parsed"]).toEqual([body, "syntax"]);
    }
  });

  test("leaves @ in a text literal as text", () => {
    const items: FieldsItem[] = [
      { kind: "fields", id: "t", fields: { r: { type: "text", formula: '"[@a]"' } } },
    ];
    expect(read(items, "t.r")).toBe("[@a]");
  });

  test("keeps the other reference forms as they were", () => {
    expect(parseReference("costs.pm.days")).toMatchObject({ form: "field", child: "pm" });
    expect(parseReference("costs.A1")).toMatchObject({ form: "cell" });
    expect(parseReference("costs.A1:B2")).toMatchObject({ form: "range" });
  });
});

describe("what a row reference reads", () => {
  test("a row's amount is its days times its rate", () => {
    const items = [
      costs({
        id: "pm",
        fields: {
          days: num(18),
          rate: { type: "money", value: "1040.00", currency: "USD" },
          amount: { type: "money", formula: "[@days] * [@rate]", currency: "USD" },
        },
      }),
    ];
    expect(read(items, "costs.pm.amount")).toBe(18720);
  });

  test("each row reads its own fields", () => {
    const items = [
      costs(
        { id: "pm", fields: { days: num(2), amount: formula("[@days] * 10") } },
        { id: "dev", fields: { days: num(3), amount: formula("[@days] * 10") } },
      ),
    ];
    expect(read(items, "costs.pm.amount")).toBe(20);
    expect(read(items, "costs.dev.amount")).toBe(30);
  });

  test("reads a child at any depth, as the address item.child.field", () => {
    const items = [
      costs({
        id: "a",
        children: [{ id: "b", fields: { x: num(4), y: formula("[@x] + 1") } }],
      }),
    ];
    expect(read(items, "costs.b.y")).toBe(5);
  });

  test("reads the same row's field in an item with prototype names", () => {
    const items = [
      costs({
        id: "__proto__",
        fields: { constructor: num(7), toString: formula("[@constructor] * 2") },
      }),
    ];
    expect(read(items, "costs.__proto__.toString")).toBe(14);
  });

  test("a row reference to the node's own field is a cycle", () => {
    const items = [costs({ id: "pm", fields: { x: formula("[@x] + 1") } })];
    expect(errorOf(read(items, "costs.pm.x")).error).toBe("cycle");
  });

  test("a misspelt field is missing-reference, the detail quoting the reference as written", () => {
    const items = [
      costs({ id: "pm", fields: { days: num(1), amount: formula("[@days] * [@rte]") } }),
    ];
    const graph = buildGraph({ items });
    const error = errorOf(evaluateGraph(graph).read("costs.pm.amount"));
    expect(error.error).toBe("missing-reference");
    expect(error.detail).toContain("[@rte]");
    expect(graph.warnings).toEqual([
      { error: "missing-reference", address: "costs.pm.amount", detail: error.detail },
    ]);
  });
});

describe("outside a row", () => {
  test("an item's own field reads as missing-reference, the detail quoting [@days]", () => {
    const items: FieldsItem[] = [
      { kind: "fields", id: "costs", fields: { days: num(1), twice: formula("[@days] * 2") } },
    ];
    const error = errorOf(read(items, "costs.twice"));
    expect(error.error).toBe("missing-reference");
    expect(error.detail).toContain("[@days]");
  });

  test("a spreadsheet cell reads as missing-reference", () => {
    const items: FieldsItem[] = [
      { kind: "fields", id: "sheet", cells: { A1: num(1), B1: formula("[@a] + 1") } },
    ];
    expect(errorOf(read(items, "sheet.B1")).error).toBe("missing-reference");
  });
});

describe("a row ID shaped like a cell (review U-2)", () => {
  const rows = (): FieldsItem =>
    costs(
      { id: "A1", fields: { days: num(5), double: formula("[@days] * 2") } },
      { id: "XFD1048576", fields: { days: num(7) } },
      {
        id: "pm",
        fields: {
          viaRow: formula("[costs.A1.days] + [costs.XFD1048576.days]"),
          viaWildcard: formula("SUM([costs.*.days])"),
          viaCell: formula("[costs.A1] + 100"),
        },
      },
    );

  test("an explicit reference [costs.A1.days] reads the row, never a cell", () => {
    const items = [rows()];
    expect(read(items, "costs.pm.viaRow")).toBe(12);
    expect(read(items, "costs.pm.viaWildcard")).toBe(12);
  });

  test("the node's address costs.A1.days is the row's, and [@days] in it reads that row", () => {
    const graph = buildGraph({ items: [rows()] });
    expect(graph.nodes.map(({ address }) => address)).toContain("costs.A1.days");
    expect(evaluateGraph(graph).read("costs.A1.days")).toBe(5);
    expect(evaluateGraph(graph).read("costs.A1.double")).toBe(10);
  });

  test("[costs.A1] is the item's cell A1, which holds nothing: it reads as empty", () => {
    expect(read([rows()], "costs.pm.viaCell")).toBe(100);
  });
});
