import { describe, expect, test } from "bun:test";
import { createOwnEngine } from "../src/engine/own-engine.ts";
import type { EngineCell, EngineValue, FormulaEngine } from "../src/engine/port.ts";
import { evaluateGraph } from "../src/evaluate.ts";
import { buildGraph } from "../src/graph/build.ts";
import type { FieldInput, GraphItem } from "../src/source.ts";
import type { FormulaError } from "../src/types.ts";

const formula = (text: string, type: FieldInput["type"] = "number"): FieldInput => ({
  type,
  formula: text,
});

const plan: GraphItem = {
  kind: "fields",
  id: "plan",
  currency: "EUR",
  fields: {
    start: { type: "date", value: "2026-11-06" },
    rate: { type: "money", value: "650.00" },
    days: { type: "number", value: 2 },
    next: formula("WORKDAY([plan.start],1)", "date"),
    cost: formula("[plan.rate]*[plan.days]", "money"),
    far: formula("[plan.start]+3000000", "date"),
    empty: formula("IF(TRUE,[plan.blank])"),
    blank: { type: "number" },
    gone: formula("[plan.nope]+1"),
    reader: formula("[plan.gone]*2"),
  },
};

/** An engine that records what it is given, around the own engine. */
const spy = (): FormulaEngine & { cells: readonly EngineCell[]; sets: [number, EngineValue][] } => {
  const inner = createOwnEngine();
  const recorder = {
    cells: [] as readonly EngineCell[],
    sets: [] as [number, EngineValue][],
    load: (cells: readonly EngineCell[]) => {
      recorder.cells = cells;
      inner.load(cells);
    },
    set: (name: number, value: EngineValue) => {
      recorder.sets.push([name, value]);
      inner.set(name, value);
    },
    recalc: () => inner.recalc(),
    read: (name: number) => inner.read(name),
  };
  return recorder;
};

describe("the adapter", () => {
  test("gives the engine one cell per node, in document order, with no ID in it", () => {
    const engine = spy();
    const graph = buildGraph({ items: [plan] });
    evaluateGraph(graph, engine);
    expect(engine.cells).toHaveLength(graph.nodes.length);
    expect(engine.cells.map((cell) => cell.kind)).toEqual(
      graph.nodes.map((node) =>
        node.formula === undefined
          ? "input"
          : ["plan.gone", "plan.reader"].includes(node.address)
            ? "error"
            : "formula",
      ),
    );
    const text = JSON.stringify(engine.cells.filter((cell) => cell.kind !== "error"));
    expect(text).not.toContain("plan");
    expect(engine.cells[0]).toEqual({ kind: "input", value: 46_332 });
    expect(engine.cells[1]).toEqual({ kind: "input", value: 650 });
  });

  test("converts dates and money in and out", () => {
    const values = evaluateGraph(buildGraph({ items: [plan] }));
    expect(values.read("plan.start")).toBe("2026-11-06");
    expect(values.read("plan.next")).toBe("2026-11-09");
    expect(values.read("plan.rate")).toBe(650);
    expect(values.read("plan.cost")).toBe(1300);
    expect(values.read("plan.far")).toEqual({
      error: "value",
      address: "plan.far",
      detail: "a date out of range",
    });
  });

  test("reads an empty result as 0", () => {
    expect(evaluateGraph(buildGraph({ items: [plan] })).read("plan.empty")).toBe(0);
  });

  test("maps an error back to the address where it arose", () => {
    const values = evaluateGraph(buildGraph({ items: [plan] }));
    const gone: FormulaError = {
      error: "missing-reference",
      address: "plan.gone",
      detail: "reference [plan.nope] names no node",
    };
    expect(values.read("plan.gone")).toEqual(gone);
    expect(values.read("plan.reader")).toEqual(gone);
  });

  test("reads an unknown address as a missing reference", () => {
    expect(evaluateGraph(buildGraph({ items: [plan] })).read("plan.nope")).toEqual({
      error: "missing-reference",
      address: "plan.nope",
      detail: "no node plan.nope",
    });
  });

  test("sets inputs and recalculates only what depends on them", () => {
    const values = evaluateGraph(buildGraph({ items: [plan] }));
    values.set("plan.start", "2026-11-13");
    values.set("plan.rate", "700.50");
    expect(values.recalc()).toEqual(["plan.next", "plan.cost", "plan.far"]);
    expect(values.read("plan.next")).toBe("2026-11-16");
    expect(values.read("plan.cost")).toBe(1401);
  });

  test("reads a value that does not fit as a value error, and accepts a fix", () => {
    const values = evaluateGraph(buildGraph({ items: [plan] }));
    values.set("plan.start", "2026-02-30");
    values.recalc();
    const bad: FormulaError = {
      error: "value",
      address: "plan.start",
      detail: '"2026-02-30" is not a date from 1900-03-01 to 9999-12-31',
    };
    expect(values.read("plan.start")).toEqual(bad);
    expect(values.read("plan.next")).toEqual(bad);
    values.set("plan.start", "2026-11-06");
    values.recalc();
    expect(values.read("plan.next")).toBe("2026-11-09");
  });

  test("lets an input that was refused at build time be set", () => {
    const graph = buildGraph({
      items: [
        {
          kind: "fields",
          id: "x",
          fields: { d: { type: "date", value: "nope" }, n: formula("[x.d]+1", "date") },
        },
      ],
    });
    const values = evaluateGraph(graph);
    expect(values.read("x.n")).toMatchObject({ error: "value", address: "x.d" });
    values.set("x.d", "2026-11-02");
    values.recalc();
    expect(values.read("x.n")).toBe("2026-11-03");
  });

  test("refuses to set a formula node or an unknown address", () => {
    const values = evaluateGraph(buildGraph({ items: [plan] }));
    expect(() => values.set("plan.cost", 1)).toThrow("plan.cost is not an input");
    expect(() => values.set("plan.gone", 1)).toThrow("plan.gone is not an input");
    expect(() => values.set("plan.nope", 1)).toThrow("no node plan.nope");
  });

  test("reads an empty cell of a known item as empty, with no warning", () => {
    const graph = buildGraph({
      items: [
        {
          kind: "fields",
          id: "sheet",
          cells: { A1: { type: "number", value: 1 }, B1: formula("[sheet.Z9]+1") },
        },
      ],
    });
    expect(graph.warnings).toEqual([]);
    expect(evaluateGraph(graph).read("sheet.B1")).toBe(1);
  });

  test("makes a date result out of range an error that its readers see", () => {
    const graph = buildGraph({
      items: [
        {
          kind: "fields",
          id: "x",
          fields: {
            d1: { type: "date", value: "2026-01-01" },
            d2: formula("[x.d1]-50000", "date"),
            n: formula("[x.d2]-[x.d1]"),
            w: formula("WORKDAY([x.d2],1)", "date"),
          },
        },
      ],
    });
    const values = evaluateGraph(graph);
    const out: FormulaError = { error: "value", address: "x.d2", detail: "a date out of range" };
    expect([values.read("x.d2"), values.read("x.n"), values.read("x.w")]).toEqual([out, out, out]);
  });

  test("builds and evaluates hundreds of full ranges in one formula without listing their cells", () => {
    // Three SUMs of 194 ranges of 65,536 cells each: 38 million places, in 8,162 characters.
    const sum = `SUM(${Array.from({ length: 194 }, () => "[z.A1:D16384]").join(",")})`;
    const started = performance.now();
    const graph = buildGraph({
      items: [
        {
          kind: "fields",
          id: "z",
          cells: { A1: { type: "number", value: 1 }, D16384: { type: "number", value: 2 } },
          fields: {
            total: formula([sum, sum, sum].join("+")),
            product: formula("SUMPRODUCT([z.A1:D16384],[z.A1:D16384])"),
          },
        },
      ],
    });
    const values = evaluateGraph(graph);
    expect(values.read("z.total")).toBe(582 * 3);
    expect(values.read("z.product")).toBe(5);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  test("refuses a graph that buildGraph did not make", () => {
    expect(() => evaluateGraph({ nodes: [], warnings: [] })).toThrow(
      "not a graph that buildGraph made",
    );
  });
});
