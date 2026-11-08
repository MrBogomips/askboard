import { describe, expect, test } from "bun:test";
import type { FormulaError } from "@askboard/compute";
import {
  TABLE_ANSWER_DERIVED,
  TABLE_WIDGET,
  type TableColumn,
  type TableProps,
  type TableRow,
} from "@askboard/contract";
import { TABLE_EDITED_PROPS, TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import type { BoardContent } from "@askboard/view/catalog";
import { type BoardGraph, sentGraph } from "../../board-graph/board-graph.ts";
import {
  answerDerived,
  cellResult,
  columnProblems,
  derivedMarks,
  formulaErrors,
  problemText,
  totalResult,
} from "./derived.ts";
import { setCell } from "./edits.ts";

const ID = "costs";
const SENT = TABLE_FIXTURE_ITEM.props;

const graphOf = (props: TableProps): BoardGraph => {
  const board: BoardContent = {
    items: [{ type: "table", id: ID, props }],
    draft: new Map(),
    shown: new Map(),
  };
  return sentGraph(board) as BoardGraph;
};

const withColumn = (
  props: TableProps,
  column: TableColumn,
  rows?: readonly TableRow[],
): TableProps => ({
  ...props,
  columns: [...props.columns, column],
  ...(rows === undefined ? {} : { rows }),
});

const PER_DAY: TableColumn = {
  field: "perDay",
  label: "Per day",
  type: "money",
  currency: "USD",
  formula: "[@rate]/[@days]",
};

const input = (props: TableProps) => ({
  itemId: ID,
  props,
  sentProps: SENT,
  live: graphOf(props),
  sent: graphOf(SENT),
});

describe("what the graph says of a Table", () => {
  test("reads cells and totals", () => {
    const graph = graphOf(SENT);
    expect(cellResult(graph, ID, "pm", "amount")).toBe(18720);
    expect(cellResult(graph, ID, "dev", "role")).toBe("Developer");
    expect(totalResult(graph, ID, "days")).toBe(90);
    expect(totalResult(graph, ID, "amount")).toBe(70560);
  });

  test("a misspelt field is one column problem, and its cells are no row errors", () => {
    const columns = SENT.columns.map((column) =>
      column.field === "amount" ? { ...column, formula: "[@rte] * [@days]" } : column,
    );
    const props = { ...SENT, columns };
    const graph = graphOf(props);
    const problems = columnProblems(graph, ID, props.columns);
    expect([...problems.keys()]).toEqual(["amount"]);
    expect(problems.get("amount")?.error).toBe("missing-reference");
    const errors = formulaErrors(graph, ID, props);
    expect(errors.rows).toEqual([]);
    expect(errors.totals).toEqual([]);
  });

  test("a division by zero in one row is that row's error, and the other row shows", () => {
    const props = withColumn(SENT, PER_DAY, [
      { id: "pm", role: "a", days: 0, rate: "1.00" },
      { id: "dev", role: "b", days: 3, rate: "1.00" },
    ]);
    const graph = graphOf(props);
    expect(columnProblems(graph, ID, props.columns).size).toBe(0);
    const { rows, totals } = formulaErrors(graph, ID, props);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rowId: "pm", field: "perDay" });
    expect(rows[0]?.error).toMatchObject({ error: "division-by-zero" });
    expect(totals).toEqual([]);
    expect(cellResult(graph, ID, "dev", "perDay")).toBeCloseTo(0.3333333, 5);
  });

  test("a total in error is the Total row's error", () => {
    const props = withColumn(SENT, { ...PER_DAY, total: "sum" }, [
      { id: "pm", role: "a", days: 0, rate: "1.00" },
    ]);
    const { totals } = formulaErrors(graphOf(props), ID, props);
    expect(totals.map(({ field }) => field)).toEqual(["perDay"]);
  });

  test("no graph, no problems", () => {
    expect(columnProblems(undefined, ID, SENT.columns).size).toBe(0);
    expect(formulaErrors(undefined, ID, SENT)).toEqual({ rows: [], totals: [] });
    expect(cellResult(undefined, ID, "pm", "amount")).toBeUndefined();
    expect(totalResult(undefined, ID, "days")).toBeUndefined();
  });

  test("each kind has its words, with the column's label, in both languages", () => {
    const error = (kind: string): FormulaError =>
      ({ error: kind, address: "a.b.c" }) as FormulaError;
    expect(problemText("en-US", error("missing-reference"), "Amount")).toBe(
      "Amount: the formula reads a field or an item that does not exist.",
    );
    expect(problemText("en-US", error("division-by-zero"), "Per day")).toBe(
      "Per day: division by zero.",
    );
    for (const kind of [
      "syntax",
      "over-limit",
      "not-whitelisted",
      "cycle",
      "mixed-currencies",
      "value",
    ]) {
      const english = problemText("en-US", error(kind), "X");
      expect(english.startsWith("X: ")).toBe(true);
      expect(problemText("it-IT", error(kind), "X")).not.toBe(english);
    }
    expect(problemText("en-US", error("unheard-of"), "X")).toBe("X: a value of the wrong kind.");
  });
});

describe("the derived mark", () => {
  test("a lowered rate marks that row's amount and the amount total, not the days", () => {
    const edited = setCell(SENT, "pm", "rate", "960.00");
    const marks = derivedMarks(input(edited));
    expect(marks.cells).toEqual(new Set(["pm.amount"]));
    expect(marks.totals).toEqual(new Set(["amount"]));
  });

  test("an untouched Table has none, and a Table with no graph has none", () => {
    const marks = derivedMarks(input(SENT));
    expect(marks.cells.size + marks.totals.size).toBe(0);
    const none = derivedMarks({ ...input(SENT), live: undefined });
    expect(none.cells.size + none.totals.size).toBe(0);
  });

  test("an added row's formula cells are marked, as the sent graph holds none", () => {
    const marks = derivedMarks(input(TABLE_EDITED_PROPS));
    expect(marks.cells.has("u-1.amount")).toBe(true);
    expect(marks.cells.has("pm.amount")).toBe(true);
    expect(marks.cells.has("dev.amount")).toBe(false);
    expect(marks.totals).toEqual(new Set(["days", "amount"]));
  });

  test("a cell in error is not marked", () => {
    const props = withColumn(SENT, PER_DAY);
    const edited = setCell(props, "pm", "days", 0);
    const marks = derivedMarks({ ...input(edited), sentProps: props, sent: graphOf(props) });
    expect(marks.cells.has("pm.perDay")).toBe(false);
  });

  test("a change below the rounding is no change", () => {
    const wobble: TableProps = {
      ...SENT,
      rows: [{ ...(SENT.rows[0] as TableRow), rate: "1040.00" }, ...SENT.rows.slice(1)],
    };
    expect(derivedMarks(input(wobble)).cells.size).toBe(0);
  });
});

describe("the answer's derived values", () => {
  test("hold only what moved, as the contract's rule says", () => {
    expect(TABLE_ANSWER_DERIVED).toEqual({ decimals: 6, itemTotals: true, onlyChanged: true });
    const edited = setCell(SENT, "pm", "rate", "960.00");
    expect(answerDerived(input(edited))).toEqual({
      "costs.days": 90,
      "costs.amount": "69120.00",
      "costs.pm.amount": "17280.00",
    });
  });

  test("every address is one the contract declares for the edited value", () => {
    for (const address of Object.keys(answerDerived(input(TABLE_EDITED_PROPS)))) {
      const [item, ...rest] = address.split(".");
      expect(item).toBe(ID);
      expect(TABLE_WIDGET.derived?.problem(rest, TABLE_EDITED_PROPS)).toBeUndefined();
    }
  });

  test("an untouched Table gives its totals alone", () => {
    expect(answerDerived(input(SENT))).toEqual({
      "costs.days": 90,
      "costs.amount": "70560.00",
    });
  });

  test("an added row's formula cells always count", () => {
    const derived = answerDerived(input(TABLE_EDITED_PROPS));
    expect(derived["costs.u-1.amount"]).toBe("6000.00");
    expect(derived["costs.pm.amount"]).toBe("17280.00");
    expect("costs.dev.amount" in derived).toBe(false);
    expect(derived["costs.days"]).toBe(100);
  });

  test("values in error are left out, a total in error too", () => {
    const props = withColumn(SENT, { ...PER_DAY, total: "sum" }, [
      { id: "pm", role: "a", days: 0, rate: "1.00" },
      { id: "dev", role: "b", days: 3, rate: "1.00" },
    ]);
    const derived = answerDerived({
      ...input(props),
      sentProps: props,
      sent: graphOf(props),
      props: setCell(props, "dev", "days", 4),
      live: graphOf(setCell(props, "dev", "days", 4)),
    });
    expect("costs.pm.perDay" in derived).toBe(false);
    expect("costs.perDay" in derived).toBe(false);
    expect(derived["costs.dev.perDay"]).toBe("0.25");
  });

  test("money rounds half away from zero at the currency's minor units, written with them", () => {
    const money = (currency: string, formula: string): TableProps => ({
      label: "M",
      columns: [
        { field: "a", label: "A", type: "money", currency },
        { field: "b", label: "B", type: "money", currency, formula, total: "sum" },
      ],
      rows: [{ id: "r", a: "1" }],
    });
    const derived = (currency: string, formula: string) => {
      const props = money(currency, formula);
      return answerDerived({
        itemId: ID,
        props,
        sentProps: props,
        live: graphOf(props),
        sent: graphOf(props),
      });
    };
    expect(derived("USD", "[@a] / 200")["costs.b"]).toBe("0.01");
    expect(derived("USD", "-[@a] / 200")["costs.b"]).toBe("-0.01");
    expect(derived("JPY", "[@a] / 2")["costs.b"]).toBe("1");
    expect(derived("JPY", "[@a] / 4")["costs.b"]).toBe("0");
    expect(derived("BHD", "[@a] / 2000")["costs.b"]).toBe("0.001");
    expect(derived("BHD", "[@a] / 3")["costs.b"]).toBe("0.333");
  });

  test("a number rounds to 6 decimals and a date goes as given", () => {
    const props: TableProps = {
      columns: [
        { field: "a", label: "A", type: "number" },
        { field: "b", label: "B", type: "number", formula: "[@a] / 3", total: "sum" },
        { field: "d", label: "D", type: "date" },
        { field: "e", label: "E", type: "date", formula: "WORKDAY([@d], 1)" },
      ],
      rows: [{ id: "r", a: 1, d: "2026-10-27" }],
    };
    const derived = answerDerived({
      itemId: ID,
      props,
      sentProps: props,
      live: graphOf(props),
      sent: graphOf(props),
    });
    expect(derived["costs.b"]).toBe(0.333333);
    expect(derived["costs.r.b"]).toBeUndefined();
    const edited: TableProps = {
      ...props,
      rows: [...props.rows, { id: "u-1", a: 2, d: "2026-10-30" }],
    };
    const next = answerDerived({
      itemId: ID,
      props: edited,
      sentProps: props,
      live: graphOf(edited),
      sent: graphOf(props),
    });
    expect(next["costs.u-1.e"]).toBe("2026-11-02");
    expect(next["costs.u-1.b"]).toBe(0.666667);
    expect("costs.r.e" in next).toBe(false);
  });

  test("a Table with no graph, or no row, gives what it has", () => {
    expect(answerDerived({ ...input(SENT), live: undefined })).toEqual({});
    const empty: TableProps = { ...SENT, rows: [] };
    expect(answerDerived({ ...input(empty), sentProps: empty, sent: graphOf(empty) })).toEqual({
      "costs.days": 0,
      "costs.amount": "0.00",
    });
  });

  test("an item or row named like an inherited name is only a key", () => {
    const props: TableProps = {
      columns: [
        { field: "a", label: "A", type: "number" },
        { field: "b", label: "B", type: "number", formula: "[@a]", total: "sum" },
      ],
      rows: [{ id: "__proto__", a: 1 }],
    };
    const edited = setCell(props, "__proto__", "a", 2);
    const derived = answerDerived({
      itemId: "constructor",
      props: edited,
      sentProps: props,
      live: graphOfId("constructor", edited),
      sent: graphOfId("constructor", props),
    });
    expect(Object.keys(derived).sort()).toEqual(["constructor.__proto__.b", "constructor.b"]);
    expect(Object.getPrototypeOf(derived)).toBe(Object.prototype);
  });
});

function graphOfId(itemId: string, props: TableProps): BoardGraph {
  return sentGraph({
    items: [{ type: "table", id: itemId, props }],
    draft: new Map(),
    shown: new Map(),
  }) as BoardGraph;
}
