// The Table's derived values and teaching text (table-widget, task 1.4; contract spec: Table derived
// values, The Table's teaching text), composed over the shipped registry with
// `withWidgetTypes(...TABLE_TYPES)` while the type is not registered (design decision 14).

import { describe, expect, test } from "bun:test";
import {
  TABLE_EDITED_PROPS,
  TABLE_FIXTURE_ITEM,
  TABLE_TYPES,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  TABLE_ANSWER_DERIVED,
  TABLE_WIDGET,
  type TableProps,
  TREE_PERT_ANSWER_DERIVED,
  tablePropsProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { widgetItemProblems } from "../src/validate.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...TABLE_TYPES);
const ITEM = TABLE_FIXTURE_ITEM;
const derived = TABLE_WIDGET.derived;
const problem = (rest: readonly string[], props: unknown = TABLE_EDITED_PROPS) =>
  derived?.problem(rest, props);

describe("Table derived values", () => {
  test("the entry declares them and says what", () => {
    expect(derived).toBeDefined();
    expect(derived?.describe).toContain("total");
    expect(derived?.describe).toContain("formula");
  });

  test("declared addresses: a total, a formula cell of a row, a formula cell of an added row", () => {
    expect(problem(["amount"])).toBeUndefined();
    expect(problem(["days"])).toBeUndefined();
    expect(problem(["pm", "amount"])).toBeUndefined();
    expect(problem(["u-1", "amount"])).toBeUndefined();
  });

  test("an address of an input cell, a field no column has, a row no value holds, or another depth is refused", () => {
    for (const rest of [
      ["pm", "rate"],
      ["pm", "role"],
      ["days", "x"],
      ["pm", "nothing"],
      ["rate"],
      ["role"],
      ["nothing"],
      ["u-9", "amount"],
      [],
      ["pm", "amount", "x"],
      ["", "amount"],
    ]) {
      expect([rest, typeof problem(rest)]).toEqual([rest, "string"]);
    }
    expect(problem(["u-1", "amount"], TABLE_FIXTURE_ITEM.props)).toBeDefined();
  });

  test("a prototype name is never a declared address by inheritance", () => {
    for (const rest of [
      ["constructor"],
      ["toString"],
      ["__proto__"],
      ["constructor", "amount"],
      ["__proto__", "amount"],
      ["pm", "constructor"],
      ["pm", "__proto__"],
    ]) {
      expect([rest, typeof problem(rest)]).toEqual([rest, "string"]);
    }
    const named = {
      columns: [
        { field: "constructor", label: "C", type: "number", total: "sum" },
        { field: "toString", label: "T", type: "number", formula: "[@constructor] * 2" },
      ],
      rows: [
        { id: "__proto__", constructor: 1 },
        { id: "constructor", constructor: 2 },
      ],
    };
    expect(tablePropsProblems(named, "agent")).toEqual([]);
    for (const rest of [["constructor"], ["__proto__", "toString"], ["constructor", "toString"]]) {
      expect([rest, problem(rest, named)]).toEqual([rest, undefined]);
    }
    for (const rest of [
      ["toString"],
      ["__proto__", "constructor"],
      ["hasOwnProperty"],
      ["toString", "toString"],
    ]) {
      expect([rest, typeof problem(rest, named)]).toEqual([rest, "string"]);
    }
  });

  test("props that are no Table's declare nothing, and never throw", () => {
    for (const props of [
      null,
      "x",
      [],
      {},
      { columns: "x", rows: [] },
      { columns: [null], rows: "x" },
      { columns: [{ field: 1 }], rows: [null] },
    ]) {
      expect(typeof problem(["amount"], props)).toBe("string");
      expect(typeof problem(["pm", "amount"], props)).toBe("string");
    }
  });

  test("an answer's derived values name the Table's addresses: the three of the contract's scenario are accepted", () => {
    const keys = ["costs.amount", "costs.pm.amount", "costs.u-1.amount"].map((key) =>
      key.split(".").slice(1),
    );
    for (const rest of keys) expect(problem(rest)).toBeUndefined();
    expect(problem(["pm", "rate"])).toBeDefined();
    expect(problem(["days", "x"])).toBeDefined();
  });

  test("the answer's rule is 6 decimals, the item's totals always, a row's cells only when they moved", () => {
    expect(TABLE_ANSWER_DERIVED).toEqual({ decimals: 6, itemTotals: true, onlyChanged: true });
    expect(Object.isFrozen(TABLE_ANSWER_DERIVED)).toBe(true);
    expect(TABLE_ANSWER_DERIVED.itemTotals).toBe(TREE_PERT_ANSWER_DERIVED.itemTotals);
    expect(TABLE_ANSWER_DERIVED.onlyChanged).toBe(TREE_PERT_ANSWER_DERIVED.onlyChanged);
  });
});

describe("The Table's teaching text", () => {
  const skill = TABLE_WIDGET.skill;

  test("a use of at most 70 characters and notes of at most 300 each", () => {
    expect(skill?.use.length).toBeGreaterThan(0);
    expect(skill?.use.length).toBeLessThanOrEqual(70);
    expect(skill?.notes?.length).toBeGreaterThan(0);
    for (const note of skill?.notes ?? []) {
      expect(note.length).toBeGreaterThan(0);
      expect(note.length).toBeLessThanOrEqual(300);
    }
  });

  test("the notes name the column types and their bounds, [@field], single reads, totals, fixedRows and the answer", () => {
    const text = (skill?.notes ?? []).join("\n");
    for (const needle of [
      "`text`",
      "`number`",
      "`money`",
      "`date`",
      "`toggle`",
      "`maxLength`",
      "`currency`",
      "`min`",
      "`step`",
      "[@field]",
      "single",
      "`total",
      "[item.field]",
      "`fixedRows",
      "changes",
      "derived",
    ]) {
      expect([needle, text.includes(needle)]).toEqual([needle, true]);
    }
  });

  test("the example validates through the composed ask schema and the entry's checks", () => {
    expect(askAccepted(TYPES, TABLE_WIDGET.example.item)).toBe(true);
    expect(askProblems(TYPES, TABLE_WIDGET.example.item)).toEqual([]);
    expect(tablePropsProblems(TABLE_WIDGET.example.item.props, "agent")).toEqual([]);
    expect(widgetItemProblems(TABLE_WIDGET.example.item, { id: "q" }, "agent", TYPES)).toEqual([]);
  });

  test("the registry over the shipped types and the Table has no problem", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });

  test("the example and the fixture agree on what the Table of roles is", () => {
    const props = TABLE_WIDGET.example.item.props as TableProps;
    expect(props).toEqual(ITEM.props);
  });
});
