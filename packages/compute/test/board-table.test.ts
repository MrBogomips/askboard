// The Table's graph source (table-widget, task 2.4; compute spec: The Table's graph source; design
// decision 5): `BOARD_SOURCES.table` maps a `table` item onto one `fields` item whose rows are
// children, whose formula columns are `columns` and whose totals are item fields.

import { describe, expect, test } from "bun:test";
import {
  TABLE_EDITED_PROPS,
  TABLE_FIXTURE_ITEM,
  TABLE_TYPES,
  tableWorstForm,
} from "@askboard/contract/fixtures";
import { type BoardSourceItem, boardGraphSource } from "../src/board.ts";
import { BOARD_SOURCES } from "../src/board-sources.ts";
import { evaluateGraph } from "../src/evaluate.ts";
import { buildGraph, type Graph } from "../src/graph/build.ts";
import { GraphSourceError } from "../src/source.ts";
import { isFormulaError, type NodeResult } from "../src/types.ts";
import { runAll, runTables, Tally } from "./fixtures/suite.ts";
import { TABLE_SOURCE_FIXTURES } from "./fixtures/table.ts";

const ROLES = TABLE_FIXTURE_ITEM as unknown as BoardSourceItem & {
  readonly props: Record<string, unknown>;
};

const tableOf = (props: Record<string, unknown>, id = "costs"): BoardSourceItem => ({
  type: "table",
  id,
  props,
});

const graphOf = (...items: BoardSourceItem[]): Graph => buildGraph(boardGraphSource(items));

const nodeOf = (graph: Graph, address: string) =>
  graph.nodes.find((node) => node.address === address);

const refusal = (item: BoardSourceItem): string => {
  try {
    boardGraphSource([item]);
    buildGraph(boardGraphSource([item]));
  } catch (error) {
    expect(error).toBeInstanceOf(GraphSourceError);
    return (error as Error).message;
  }
  throw new Error("the source was accepted");
};

const COLUMNS = [
  { field: "name", label: "Name", type: "text" },
  { field: "qty", label: "Qty", type: "number" },
  { field: "price", label: "Price", type: "money", currency: "EUR" },
  { field: "due", label: "Due", type: "date" },
  { field: "ok", label: "Ok", type: "toggle" },
];

describe("BOARD_SOURCES.table", () => {
  test("is the one source the table holds, and never reads an inherited name", () => {
    expect(Object.keys(BOARD_SOURCES)).toEqual(["table"]);
    expect(Object.isFrozen(BOARD_SOURCES)).toBe(true);
  });

  test("a Table maps onto one fields item named by the Table, totals first, then the rows", () => {
    const { items } = boardGraphSource([ROLES]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "fields", id: "costs" });
    const addresses = graphOf(ROLES).nodes.map(({ address }) => address);
    expect(addresses).toEqual([
      "costs.days",
      "costs.amount",
      "costs.pm.role",
      "costs.pm.days",
      "costs.pm.rate",
      "costs.pm.amount",
      "costs.dev.role",
      "costs.dev.days",
      "costs.dev.rate",
      "costs.dev.amount",
    ]);
  });

  test("an item of another type adds nothing", () => {
    expect(boardGraphSource([{ type: "tree", id: "t", props: {} }])).toEqual({ items: [] });
  });
});

describe("the totals of the roles", () => {
  test("costs.amount reads 70560 in USD and costs.days reads 90", () => {
    const graph = graphOf(ROLES);
    const values = evaluateGraph(graph);
    expect(values.read("costs.amount")).toBe(70_560);
    expect(values.read("costs.days")).toBe(90);
    expect(nodeOf(graph, "costs.amount")).toMatchObject({ type: "money", currency: "USD" });
    expect(nodeOf(graph, "costs.days")).toMatchObject({ type: "number" });
    expect(graph.warnings).toEqual([]);
  });

  test("each total's formula sums the column over the rows", () => {
    const graph = graphOf(ROLES);
    expect(nodeOf(graph, "costs.days")?.formula).toBe("SUM([costs.*.days])");
    expect(nodeOf(graph, "costs.amount")?.formula).toBe("SUM([costs.*.amount])");
  });

  test("an edited rate recalculates its row and the total, and leaves the other row alone", () => {
    const values = evaluateGraph(graphOf(ROLES));
    values.set("costs.pm.rate", "960.00");
    const recalculated = values.recalc();
    expect(values.read("costs.pm.amount")).toBe(17_280);
    expect(values.read("costs.amount")).toBe(69_120);
    expect(recalculated).toContain("costs.pm.amount");
    expect(recalculated).toContain("costs.amount");
    expect(recalculated.filter((address) => address.startsWith("costs.dev."))).toEqual([]);
  });

  test("the edited value of the roles reads as a fresh build of it", () => {
    const edited = tableOf({ ...TABLE_EDITED_PROPS }) as BoardSourceItem;
    const values = evaluateGraph(graphOf({ ...edited }));
    expect(values.read("costs.amount")).toBe(17_280 + 51_840 + 6_000);
    expect(values.read("costs.days")).toBe(100);
  });

  test("an empty cell reads as empty: the row's amount is 0 and the total sums the others", () => {
    const props = {
      ...ROLES.props,
      rows: [
        { id: "pm", role: "PM", days: 18, rate: "1040.00" },
        { id: "dev", role: "Dev", rate: "720.00" },
      ],
    } as Record<string, unknown>;
    const values = evaluateGraph(graphOf(tableOf(props)));
    expect(values.read("costs.dev.amount")).toBe(0);
    expect(values.read("costs.dev.days")).toBeNull();
    expect(values.read("costs.days")).toBe(18);
    expect(values.read("costs.amount")).toBe(18_720);
  });

  test("a Table with no rows totals 0", () => {
    const values = evaluateGraph(graphOf(tableOf({ ...ROLES.props, rows: [] } as never)));
    expect(values.read("costs.days")).toBe(0);
    expect(values.read("costs.amount")).toBe(0);
  });
});

describe("each input type's node", () => {
  test("text, number, money in its column's currency, date, boolean, and empty as null", () => {
    const graph = graphOf(
      tableOf({
        columns: COLUMNS,
        rows: [
          { id: "a", name: "x", qty: 2, price: "1.50", due: "2026-11-02", ok: true },
          { id: "b" },
        ],
      }),
    );
    const read = (address: string) => {
      const node = nodeOf(graph, address);
      return [node?.type, node?.input, node?.currency];
    };
    expect(read("costs.a.name")).toEqual(["text", "x", undefined]);
    expect(read("costs.a.qty")).toEqual(["number", 2, undefined]);
    expect(read("costs.a.price")).toEqual(["money", "1.50", "EUR"]);
    expect(read("costs.a.due")).toEqual(["date", "2026-11-02", undefined]);
    expect(read("costs.a.ok")).toEqual(["boolean", true, undefined]);
    for (const [field, type] of [
      ["name", "text"],
      ["qty", "number"],
      ["price", "money"],
      ["due", "date"],
      ["ok", "boolean"],
    ] as const) {
      expect(nodeOf(graph, `costs.b.${field}`)).toMatchObject({ type, input: null });
    }
    expect(graph.warnings).toEqual([]);
  });

  test("the node set depends on the columns and the row IDs only", () => {
    const shape = (rows: readonly Record<string, unknown>[]) =>
      graphOf(tableOf({ columns: COLUMNS, rows })).nodes.map(({ address }) => address);
    expect(shape([{ id: "a", qty: 1 }, { id: "b" }])).toEqual(
      shape([{ id: "a" }, { id: "b", qty: 4, name: "z" }]),
    );
  });

  test("a cell of the wrong type is a value problem at that node, not a refusal", () => {
    const graph = graphOf(tableOf({ columns: COLUMNS, rows: [{ id: "a", qty: "many" }] }));
    expect(graph.warnings).toHaveLength(1);
    expect(graph.warnings[0]).toMatchObject({ error: "value", address: "costs.a.qty" });
  });
});

describe("a money formula column", () => {
  const props = (rateCurrency: string) => ({
    columns: [
      { field: "days", label: "Days", type: "number" },
      { field: "rate", label: "Rate", type: "money", currency: rateCurrency },
      {
        field: "amount",
        label: "Amount",
        type: "money",
        currency: "USD",
        formula: "[@days] * [@rate]",
        total: "sum",
      },
    ],
    rows: [
      { id: "pm", days: 2, rate: "10.00" },
      { id: "dev", days: 3, rate: "20.00" },
    ],
  });

  test("with inputs in its own currency it reads each row and totals", () => {
    const graph = graphOf(tableOf(props("USD")));
    const values = evaluateGraph(graph);
    expect(values.read("costs.pm.amount")).toBe(20);
    expect(values.read("costs.amount")).toBe(80);
    expect(nodeOf(graph, "costs.pm.amount")).toMatchObject({ currency: "USD" });
  });

  test("with an input in another currency each row reads mixed-currencies, one warning names the column", () => {
    const graph = graphOf(tableOf(props("EUR")));
    const values = evaluateGraph(graph);
    for (const row of ["pm", "dev"]) {
      const result: NodeResult = values.read(`costs.${row}.amount`);
      expect(isFormulaError(result) ? result.error : result).toBe("mixed-currencies");
    }
    expect(graph.warnings).toEqual([
      { error: "mixed-currencies", address: "costs.*.amount", detail: "amounts in EUR, USD" },
    ]);
  });
});

describe("a Table whose names are object names", () => {
  test("rows __proto__ and constructor, fields constructor and toString", () => {
    const graph = graphOf(
      tableOf({
        columns: [
          { field: "constructor", label: "C", type: "number", total: "sum" },
          {
            field: "toString",
            label: "T",
            type: "number",
            formula: "[@constructor] * 2",
            total: "sum",
          },
        ],
        rows: [
          { id: "__proto__", constructor: 3 },
          { id: "constructor", constructor: 4 },
        ],
      }),
    );
    const values = evaluateGraph(graph);
    expect(values.read("costs.__proto__.toString")).toBe(6);
    expect(values.read("costs.constructor.toString")).toBe(8);
    expect(values.read("costs.constructor")).toBe(7);
    expect(values.read("costs.toString")).toBe(14);
    expect(graph.warnings).toEqual([]);
  });

  test("a Table named __proto__ is an item like any other", () => {
    const values = evaluateGraph(graphOf(tableOf(ROLES.props, "__proto__")));
    expect(values.read("__proto__.amount")).toBe(70_560);
  });
});

describe("a source that is no Table is refused, naming the item", () => {
  test.each([
    ["props that are no object", tableOf(null as never)],
    ["columns that are no list", tableOf({ columns: {}, rows: [] })],
    ["rows that are no list", tableOf({ columns: COLUMNS, rows: "x" as never })],
    ["a row that is no object", tableOf({ columns: COLUMNS, rows: [3] as never })],
    ["a row ID that is no ID", tableOf({ columns: COLUMNS, rows: [{ id: "a b" }] })],
    ["a column that is no object", tableOf({ columns: [1], rows: [] })],
    ["an unknown column type", tableOf({ columns: [{ field: "a", type: "blob" }], rows: [] })],
    ["a column without a field", tableOf({ columns: [{ type: "number" }], rows: [] })],
    [
      "a field that is no field name",
      tableOf({ columns: [{ field: "A1", type: "number" }], rows: [] }),
    ],
    ["a field called id", tableOf({ columns: [{ field: "id", type: "number" }], rows: [] })],
    [
      "a field twice",
      tableOf({
        columns: [
          { field: "a", type: "number" },
          { field: "a", type: "text" },
        ],
        rows: [],
      }),
    ],
    [
      "a money column without a currency",
      tableOf({ columns: [{ field: "m", type: "money" }], rows: [{ id: "a", m: "1.00" }] }),
    ],
    ["a row ID used twice", tableOf({ columns: COLUMNS, rows: [{ id: "a" }, { id: "a" }] })],
  ])("%s", (_, item) => {
    expect(refusal(item)).toContain("costs");
  });
});

describe("what the source leaves out", () => {
  test("a row's key that is no column, and a value for a formula column, are not read", () => {
    const graph = graphOf(
      tableOf({
        columns: [
          { field: "a", label: "A", type: "number" },
          { field: "b", label: "B", type: "number", formula: "[@a] + 1" },
        ],
        rows: [{ id: "r", a: 1, b: 99, stray: 5 }],
      }),
    );
    expect(graph.nodes.map(({ address }) => address)).toEqual(["costs.r.a", "costs.r.b"]);
    expect(evaluateGraph(graph).read("costs.r.b")).toBe(2);
  });
});

describe("the worst form", () => {
  test("builds without a warning and sums its first column", () => {
    const graph = graphOf(tableOf(tableWorstForm() as never, "worst"));
    expect(graph.warnings).toEqual([]);
    expect(graph.nodes).toHaveLength(10 + 200 * 10);
    const values = evaluateGraph(graph);
    const sum = Array.from({ length: 200 }, (_, index) => index % 9).reduce((a, b) => a + b, 0);
    expect(values.read("worst.a")).toBe(sum);
    expect(values.read("worst.f1")).toBe(sum * 100);
  });
});

describe("computing types have sources", () => {
  test("every Table entry that declares derived values has a source", () => {
    const computing = TABLE_TYPES.filter(({ derived }) => derived !== undefined);
    expect(computing.map(({ type }) => type)).toEqual(["table"]);
    for (const { type } of computing) expect(Object.keys(BOARD_SOURCES)).toContain(type);
  });
});

describe("the Table fixtures", () => {
  test("read as Excel reads them, and every fixture still passes", () => {
    const tally = new Tally();
    runTables(tally);
    expect(tally.failures).toEqual([]);
    expect(tally.passed).toBe(TABLE_SOURCE_FIXTURES.length + 10);
    expect(runAll().failed).toBe(0);
  });
});
