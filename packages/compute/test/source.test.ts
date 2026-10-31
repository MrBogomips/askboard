import { describe, expect, test } from "bun:test";
import { buildGraph } from "../src/graph/build.ts";
import { type GraphItem, type GraphSource, GraphSourceError } from "../src/source.ts";

const build = (...items: unknown[]) => buildGraph({ items } as GraphSource);

const refusal = (items: unknown[]): string => {
  try {
    build(...items);
  } catch (error) {
    if (error instanceof GraphSourceError) return error.message;
    throw error;
  }
  throw new Error("the source was accepted");
};

const fieldsItem = (id: string, extra: Record<string, unknown> = {}): GraphItem =>
  ({ kind: "fields", id, ...extra }) as GraphItem;

describe("malformed sources", () => {
  test.each([
    [[{ kind: "fields", id: "a b" }], 'item ID "a b" is not'],
    [[{ kind: "fields", id: "" }], 'item ID "" is not'],
    [
      [
        { kind: "fields", id: "x" },
        { kind: "fields", id: "x" },
      ],
      "item ID x is used twice",
    ],
    [[{ kind: "pie", id: "x" }], 'item x has the unknown kind "pie"'],
    [[null], "an item is not an object"],
    [
      [fieldsItem("x", { fields: { A1: { type: "number", value: 1 } } })],
      'item x: "A1" is not a field name',
    ],
    [[fieldsItem("x", { fields: { Q1: { type: "number" } } })], 'item x: "Q1" is not a field name'],
    [
      [fieldsItem("x", { fields: { "a-b": { type: "number" } } })],
      'item x: "a-b" is not a field name',
    ],
    [[fieldsItem("x", { cells: { a1: { type: "number" } } })], 'item x: "a1" is not a cell'],
    [[fieldsItem("x", { cells: { XFE1: { type: "number" } } })], 'item x: "XFE1" is not a cell'],
    [
      [fieldsItem("x", { fields: { v: { type: "duration" } } })],
      'item x, field v: unknown type "duration"',
    ],
    [[fieldsItem("x", { fields: { v: 3 } })], "item x, field v: not a field input"],
    [
      [fieldsItem("x", { fields: { v: { type: "number", value: 1, formula: "2" } } })],
      "item x, field v: holds both a value and a formula",
    ],
    [
      [fieldsItem("x", { fields: { v: { type: "number", formula: 2 } } })],
      "item x, field v: the formula is not text",
    ],
    [
      [fieldsItem("x", { fields: { v: { type: "money", value: "1.00" } } })],
      "item x, field v: a money input needs a currency",
    ],
    [
      [fieldsItem("x", { fields: { v: { type: "money", value: "1.00", currency: "eur" } } })],
      'item x, field v: currency "eur" is not an ISO 4217 code',
    ],
    [[fieldsItem("x", { currency: "EURO" })], 'item x: currency "EURO" is not an ISO 4217 code'],
    [
      [fieldsItem("x", { fields: { v: { type: "number", currency: "EUR" } } })],
      "item x, field v: only money has a currency",
    ],
    [
      [
        fieldsItem("wbs", {
          children: [
            { id: "a", children: [{ id: "ux" }] },
            { id: "b", children: [{ id: "ux" }] },
          ],
        }),
      ],
      "item wbs: child ID ux is used twice",
    ],
    [[fieldsItem("x", { children: [{ id: "a.b" }] })], 'item x: child ID "a.b" is not'],
    [
      [fieldsItem("x", { children: [{ id: "a", fields: { "1x": { type: "number" } } }] })],
      'item x, child a: "1x" is not a field name',
    ],
    [[fieldsItem("x", { children: "a" })], "item x: children is not a list"],
  ])("refuses %j", (items, message) => {
    expect(refusal(items)).toContain(message);
  });

  test("refuses a source without a list of items", () => {
    expect(() => buildGraph({} as GraphSource)).toThrow(
      new GraphSourceError("the source has no list of items"),
    );
  });

  test("names the item and the field in a child's field", () => {
    expect(
      refusal([
        fieldsItem("x", {
          children: [{ id: "a", fields: { v: { type: "money", value: "1.00", formula: "1" } } }],
        }),
      ]),
    ).toBe("item x, child a, field v: holds both a value and a formula");
  });
});

describe("addresses and document order", () => {
  test("lists item fields, then cells row by row, then children depth first", () => {
    const graph = build(
      fieldsItem("x", {
        fields: { total: { type: "number", formula: "1" }, label: { type: "text", value: "a" } },
        cells: {
          B1: { type: "number", value: 2 },
          A2: { type: "number", value: 3 },
          A1: { type: "number", value: 1 },
        },
        children: [
          {
            id: "design",
            fields: { v: { type: "number", value: 1 } },
            children: [{ id: "ux", fields: { v: { type: "number" } } }],
          },
          { id: "build", fields: { v: { type: "number", value: 2 } } },
        ],
      }),
      fieldsItem("y", { fields: { w: { type: "boolean", value: true } } }),
    );
    expect(graph.nodes.map((n) => n.address)).toEqual([
      "x.total",
      "x.label",
      "x.A1",
      "x.B1",
      "x.A2",
      "x.design.v",
      "x.ux.v",
      "x.build.v",
      "y.w",
    ]);
  });

  test("addresses a child by its own ID, whatever its depth", () => {
    const graph = build(
      fieldsItem("wbs", {
        children: [
          {
            id: "design",
            children: [{ id: "ux", fields: { optimistic: { type: "number", value: 3 } } }],
          },
        ],
      }),
    );
    expect(graph.nodes).toEqual([{ address: "wbs.ux.optimistic", type: "number", input: 3 }]);
  });

  test("gives inputs their value, empty when absent, and formulas their text", () => {
    const graph = build(
      fieldsItem("x", {
        currency: "EUR",
        fields: {
          a: { type: "number" },
          b: { type: "number", value: null },
          c: { type: "money", value: "1.50" },
          d: { type: "money", value: "2.00", currency: "USD" },
          e: { type: "number", formula: "[x.a]+1" },
        },
      }),
    );
    expect(graph.nodes).toEqual([
      { address: "x.a", type: "number", input: null },
      { address: "x.b", type: "number", input: null },
      { address: "x.c", type: "money", input: "1.50", currency: "EUR" },
      { address: "x.d", type: "money", input: "2.00", currency: "USD" },
      { address: "x.e", type: "number", formula: "[x.a]+1" },
    ]);
  });

  test("walks a deep tree without recursion", () => {
    let node: Record<string, unknown> = { id: "n0", fields: { v: { type: "number", value: 0 } } };
    for (let i = 1; i < 20_000; i++) node = { id: `n${i}`, children: [node] };
    const graph = build(fieldsItem("deep", { children: [node] }));
    expect(graph.nodes).toEqual([{ address: "deep.n0.v", type: "number", input: 0 }]);
  });

  test("is frozen and pure: the same source gives the same graph", () => {
    const source: GraphSource = {
      items: [
        fieldsItem("x", {
          fields: { a: { type: "number", value: 1 }, b: { type: "number", formula: "[x.nope]" } },
        }),
      ],
    };
    const first = buildGraph(source);
    const second = buildGraph(source);
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.nodes)).toBe(true);
    expect(Object.isFrozen(first.nodes[0])).toBe(true);
    expect(Object.isFrozen(first.warnings)).toBe(true);
  });
});
