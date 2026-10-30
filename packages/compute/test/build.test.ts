import { describe, expect, test } from "bun:test";
import { buildGraph, compiledOf } from "../src/graph/build.ts";
import type { FieldInput, GraphItem } from "../src/source.ts";
import type { FormulaError } from "../src/types.ts";

const num = (value: number | null = null): FieldInput => ({ type: "number", value });
const money = (value: string, currency?: string): FieldInput =>
  currency === undefined ? { type: "money", value } : { type: "money", value, currency };
const formula = (
  text: string,
  type: FieldInput["type"] = "number",
  currency?: string,
): FieldInput =>
  currency === undefined ? { type, formula: text } : { type, formula: text, currency };

const item = (
  id: string,
  fields: Record<string, FieldInput>,
  extra: Partial<GraphItem> = {},
): GraphItem => ({ kind: "fields", id, fields, ...extra }) as GraphItem;

const errorsOf = (graph: ReturnType<typeof buildGraph>): Record<string, unknown> =>
  Object.fromEntries(
    compiledOf(graph)
      .nodes.filter((n) => n.error !== undefined)
      .map((n) => [n.address, n.error]),
  );

describe("input values", () => {
  test.each([
    [{ type: "number", value: "3" }, "a number, not text"],
    [{ type: "number", value: Number.NaN }, "a number, not NaN"],
    [{ type: "number", value: Number.POSITIVE_INFINITY }, "a number, not Infinity"],
    [{ type: "text", value: 3 }, "text, not a number"],
    [{ type: "boolean", value: "yes" }, "a boolean, not text"],
    [
      { type: "date", value: "2026-02-30" },
      '"2026-02-30" is not a date from 1900-03-01 to 9999-12-31',
    ],
    [
      { type: "date", value: "1900-02-28" },
      '"1900-02-28" is not a date from 1900-03-01 to 9999-12-31',
    ],
    [{ type: "date", value: "2026-1-5" }, '"2026-1-5" is not a date from 1900-03-01 to 9999-12-31'],
    [{ type: "date", value: 46000 }, "a full-date, not a number"],
    [{ type: "money", value: "1,50", currency: "EUR" }, 'money is a decimal string, not "1,50"'],
    [{ type: "money", value: 1.5, currency: "EUR" }, "money is a decimal string, not a number"],
  ])("refuses %j as a value warning", (input, detail) => {
    const graph = buildGraph({
      items: [item("x", { bad: input as FieldInput, r: formula("[x.bad]") })],
    });
    expect(graph.warnings).toEqual([{ error: "value", address: "x.bad", detail }]);
    expect(errorsOf(graph)).toEqual({ "x.bad": { error: "value", address: "x.bad", detail } });
  });

  test("accepts each type's values and empty", () => {
    const graph = buildGraph({
      items: [
        item(
          "x",
          {
            n: num(-1.5),
            t: { type: "text", value: "" },
            b: { type: "boolean", value: false },
            d: { type: "date", value: "2028-02-29" },
            m: money("-12.30"),
            e: { type: "date" },
          },
          { currency: "EUR" },
        ),
      ],
    });
    expect(graph.warnings).toEqual([]);
  });
});

describe("formula problems", () => {
  test("are warnings naming the node, and the node reads as the error", () => {
    const graph = buildGraph({
      items: [
        item("x", {
          a: num(1),
          f: formula("NOW()"),
          s: formula("1+"),
          o: formula(`${"(".repeat(65)}1${")".repeat(65)}`),
        }),
      ],
    });
    expect(graph.warnings).toEqual([
      { error: "not-whitelisted", address: "x.f", detail: "function NOW is not whitelisted" },
      { error: "syntax", address: "x.s", detail: "unexpected end of formula" },
      { error: "over-limit", address: "x.o", detail: "nesting of 65 levels, over the limit of 64" },
    ]);
    expect(Object.keys(errorsOf(graph))).toEqual(["x.f", "x.s", "x.o"]);
  });

  test("a node that reads one is no warning of its own", () => {
    const graph = buildGraph({
      items: [item("x", { a: num(1), b: formula("[x.a]+[x.nope]"), c: formula("[x.b]*2") })],
    });
    expect(graph.warnings).toEqual([
      { error: "missing-reference", address: "x.b", detail: "reference [x.nope] names no node" },
    ]);
    const missing = graph.warnings[0];
    expect(errorsOf(graph)).toEqual({ "x.b": missing, "x.c": missing });
  });
});

describe("currencies", () => {
  // The spike's fixture `mixed-currencies`: a EUR review with one rate in USD.
  const estimate = item(
    "estimate",
    {
      minMargin: num(),
      totalCost: formula("SUM([estimate.*.cost])", "money", "EUR"),
      totalRevenue: formula("SUM([estimate.*.revenue])", "money", "EUR"),
      margin: formula("([estimate.totalRevenue]-[estimate.totalCost])/[estimate.totalRevenue]"),
      belowMinimum: formula(
        'AND([estimate.minMargin]<>"",[estimate.margin]<[estimate.minMargin])',
        "boolean",
      ),
    },
    {
      currency: "EUR",
      children: [
        {
          id: "pm",
          fields: {
            days: num(12),
            dailyCost: money("420.00"),
            dailyRate: money("650.00"),
            cost: formula("[estimate.pm.days]*[estimate.pm.dailyCost]", "money"),
            revenue: formula("[estimate.pm.days]*[estimate.pm.dailyRate]", "money"),
          },
        },
        {
          id: "dev",
          fields: {
            days: num(40),
            dailyCost: money("380.00"),
            dailyRate: money("600.00", "USD"),
            cost: formula("[estimate.dev.days]*[estimate.dev.dailyCost]", "money"),
            revenue: formula("[estimate.dev.days]*[estimate.dev.dailyRate]", "money"),
          },
        },
      ],
    },
  );

  test("warn only where amounts in two currencies meet, and fix the readers' error", () => {
    const graph = buildGraph({ items: [estimate] });
    const origin: FormulaError = {
      error: "mixed-currencies",
      address: "estimate.totalRevenue",
      detail: "amounts in EUR, USD",
    };
    expect(graph.warnings).toEqual([origin]);
    expect(errorsOf(graph)).toEqual({
      "estimate.totalRevenue": origin,
      "estimate.margin": origin,
      "estimate.belowMinimum": origin,
    });
  });

  test("give inputs their currency and money formulas the one they read or declare", () => {
    const graph = buildGraph({ items: [estimate] });
    const currencies = Object.fromEntries(
      graph.nodes.filter((n) => n.type === "money").map((n) => [n.address, n.currency]),
    );
    expect(currencies).toEqual({
      "estimate.totalCost": "EUR",
      "estimate.totalRevenue": undefined,
      "estimate.pm.dailyCost": "EUR",
      "estimate.pm.dailyRate": "EUR",
      "estimate.pm.cost": "EUR",
      "estimate.pm.revenue": "EUR",
      "estimate.dev.dailyCost": "EUR",
      "estimate.dev.dailyRate": "USD",
      "estimate.dev.cost": "EUR",
      "estimate.dev.revenue": "USD",
    });
  });

  test("refuse a number formula over two currencies", () => {
    const graph = buildGraph({
      items: [
        item("x", {
          usd: money("2.00", "USD"),
          eur: money("1.00", "EUR"),
          rate: formula("[x.usd]/[x.eur]"),
        }),
      ],
    });
    expect(graph.warnings).toEqual([
      { error: "mixed-currencies", address: "x.rate", detail: "amounts in EUR, USD" },
    ]);
  });

  test("refuse a money formula that declares another currency than it reads", () => {
    const graph = buildGraph({
      items: [
        item("x", { usd: money("2.00", "USD"), total: formula("[x.usd]*2", "money", "EUR") }),
      ],
    });
    expect(graph.warnings).toEqual([
      { error: "mixed-currencies", address: "x.total", detail: "amounts in EUR, USD" },
    ]);
  });

  test("infer through chains of money formulas, and pass the mix on to every reader", () => {
    const graph = buildGraph({
      items: [
        item("x", {
          d: formula("[x.c]+1", "money"),
          c: formula("[x.a]+[x.b]", "money"),
          a: money("1.00", "EUR"),
          b: formula("[x.usd]", "money"),
          usd: money("1.00", "USD"),
          lazy: formula("IF(FALSE,[x.d],1)"),
        }),
      ],
    });
    const origin: FormulaError = {
      error: "mixed-currencies",
      address: "x.c",
      detail: "amounts in EUR, USD",
    };
    expect(graph.warnings).toEqual([origin]);
    expect(errorsOf(graph)).toEqual({ "x.d": origin, "x.c": origin, "x.lazy": origin });
  });

  test("leave a formula over one currency, or over numbers, alone", () => {
    const graph = buildGraph({
      items: [
        item("x", {
          a: money("1.00", "EUR"),
          b: money("2.00", "EUR"),
          n: num(3),
          s: formula("([x.a]+[x.b])*[x.n]", "money"),
          k: formula("[x.n]*2", "money"),
        }),
      ],
    });
    expect(graph.warnings).toEqual([]);
    expect(graph.nodes.find((n) => n.address === "x.s")?.currency).toBe("EUR");
    expect(graph.nodes.find((n) => n.address === "x.k")?.currency).toBeUndefined();
  });

  test("leave money formulas on a cycle to the cycle check", () => {
    const graph = buildGraph({
      items: [
        item("x", {
          a: formula("[x.b]+[x.e]", "money"),
          b: formula("[x.a]+[x.u]", "money"),
          e: money("1.00", "EUR"),
          u: money("1.00", "USD"),
        }),
      ],
    });
    expect(graph.warnings).toEqual([
      { error: "cycle", address: "x.a" },
      { error: "cycle", address: "x.b" },
    ]);
  });

  test("keep a money formula's declared currency when another check refused it", () => {
    const graph = buildGraph({ items: [item("x", { t: formula("[x.nope]", "money", "EUR") })] });
    expect(graph.nodes[0]?.currency).toBe("EUR");
  });
});

describe("cycles", () => {
  test("make every node on the cycle a warning, and leave others alone", () => {
    const graph = buildGraph({
      items: [
        item("x", {
          a: formula("[x.c]+1"),
          b: formula("[x.a]*2"),
          c: formula("[x.b]-1"),
          d: formula("[x.c]+100"),
          e: formula("3+4"),
        }),
      ],
    });
    expect(graph.warnings).toEqual([
      { error: "cycle", address: "x.a" },
      { error: "cycle", address: "x.b" },
      { error: "cycle", address: "x.c" },
    ]);
    expect(Object.keys(errorsOf(graph))).toEqual(["x.a", "x.b", "x.c", "x.d"]);
    expect(errorsOf(graph)["x.d"]).toEqual({ error: "cycle", address: "x.c" });
  });

  test("find a node that reads itself", () => {
    const graph = buildGraph({
      items: [item("x", { a: formula("[x.a]+1"), b: formula("[x.a]*2") })],
    });
    expect(graph.warnings).toEqual([{ error: "cycle", address: "x.a" }]);
  });

  test("find a cycle through a wildcard", () => {
    const graph = buildGraph({
      items: [
        item(
          "w",
          { total: formula("SUM([w.*.v])") },
          {
            children: [
              { id: "a", fields: { v: formula("[w.total]/2") } },
              { id: "b", fields: { v: num(4) } },
            ],
          },
        ),
      ],
    });
    expect(graph.warnings).toEqual([
      { error: "cycle", address: "w.total" },
      { error: "cycle", address: "w.a.v" },
    ]);
  });

  test("order a chain of 10,000 nodes without recursion", () => {
    const children = Array.from({ length: 10_000 }, (_, i) => ({
      id: `n${i}`,
      fields: { v: i === 0 ? num(1) : formula(`[c.n${i - 1}.v]+1`) },
    }));
    const graph = buildGraph({ items: [{ kind: "fields", id: "c", children }] });
    expect(graph.warnings).toEqual([]);
    expect(graph.nodes).toHaveLength(10_000);
  });
});

describe("formula problems in a branch IF does not take", () => {
  test("still reach the reader: a formula error never yields a number", () => {
    const graph = buildGraph({
      items: [
        item("x", {
          cyc: formula("[x.cyc]+1"),
          gone: formula("[x.nope]"),
          now: formula("NOW()"),
          bad: { type: "number", value: "x" as unknown as number },
          a: formula("IF(TRUE,1,[x.cyc])"),
          b: formula("IF(FALSE,[x.gone],2)"),
          c: formula("IF(FALSE,[x.now],3)"),
          d: formula("IF(FALSE,[x.bad],4)"),
        }),
      ],
    });
    const errors = errorsOf(graph);
    expect(errors["x.a"]).toEqual({ error: "cycle", address: "x.cyc" });
    expect(errors["x.b"]).toMatchObject({ error: "missing-reference", address: "x.gone" });
    expect(errors["x.c"]).toMatchObject({ error: "not-whitelisted", address: "x.now" });
    // A bad input can be set right later, so it travels as a value, as in Excel.
    expect(errors["x.d"]).toBeUndefined();
  });
});

describe("compiled graphs", () => {
  test("exist only for graphs that buildGraph made", () => {
    const graph = buildGraph({ items: [] });
    expect(compiledOf(graph).nodes).toEqual([]);
    expect(() => compiledOf({ nodes: [], warnings: [] })).toThrow(
      "not a graph that buildGraph made",
    );
  });
});
