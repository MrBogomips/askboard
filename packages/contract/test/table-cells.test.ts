// The Table's cells and rows (table-widget, task 1.3; contract spec: One check for a Table's cells),
// composed over the shipped registry with `withWidgetTypes(...TABLE_TYPES)` while the type is not
// registered (design decision 14), in a fresh Ajv.

import { describe, expect, test } from "bun:test";
import {
  TABLE_EDITED_PROPS,
  TABLE_FIXTURE_ITEM,
  TABLE_TYPES,
  tableWorstForm,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  TABLE_TEXT_MAX_CHARS,
  type TableProps,
  tableCellProblems,
  tablePropsProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { validateAskRequestOver, widgetItemProblems } from "../src/validate.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...TABLE_TYPES);
const ROLES = TABLE_FIXTURE_ITEM.props;
const table = (props: unknown, id = "costs") => ({ type: "table", id, props });
const withRows = (rows: unknown, extra: object = {}) => table({ ...ROLES, ...extra, rows });
const problems = (item: unknown) => askProblems(TYPES, item as ReturnType<typeof table>);
const emoji = (count: number) => "😀".repeat(count);
const QUESTION = { id: "q", props: { text: "Which?" } };

describe("the Table's fixtures", () => {
  test("the Table of roles is the contract spec's first scenario, and validates", () => {
    expect(problems(TABLE_FIXTURE_ITEM)).toEqual([]);
    expect(askAccepted(TYPES, TABLE_FIXTURE_ITEM)).toBe(true);
    expect(ROLES.columns.map(({ field }) => field)).toEqual(["role", "days", "rate", "amount"]);
    expect(ROLES.rows).toEqual([
      { id: "pm", role: "Project manager", days: 18, rate: "1040.00" },
      { id: "dev", role: "Developer", days: 72, rate: "720.00" },
    ]);
  });

  test("the edited value holds pm's rate 960.00 and a row u-1 after dev, and its columns are the revision's", () => {
    expect(TABLE_EDITED_PROPS.columns).toEqual(ROLES.columns);
    expect(TABLE_EDITED_PROPS.rows.map(({ id }) => id)).toEqual(["pm", "dev", "u-1"]);
    expect(TABLE_EDITED_PROPS.rows[0]?.rate).toBe("960.00");
    expect(
      widgetItemProblems(
        { ...TABLE_FIXTURE_ITEM, props: TABLE_EDITED_PROPS },
        QUESTION,
        "edited",
        TYPES,
      ),
    ).toEqual([]);
  });

  test("the entry and the fixtures keep the registry's own checks clean", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });
});

describe("One check for a Table's cells", () => {
  test("a rate below its minimum fails, naming the item, the row and the field", () => {
    const props = {
      ...ROLES,
      columns: ROLES.columns.map((column) =>
        column.field === "rate" ? { ...column, min: "0" } : column,
      ),
    };
    const [problem, ...rest] = problems(
      table({ ...props, rows: [{ id: "pm", role: "PM", days: 1, rate: "-5.00" }] }),
    );
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("costs");
    expect(problem?.field).toBe("props.rows[0].rate");
    expect(problem?.message).toContain('row "pm"');
    expect(problem?.message).toContain("-5.00");
  });

  test("decimals past the currency's minor units fail, naming the row and the field", () => {
    const yen = { field: "price", label: "Price", type: "money", currency: "JPY" };
    const item = table({ columns: [yen], rows: [{ id: "r1", price: "1200.5" }] });
    const [problem, ...rest] = problems(item);
    expect(rest).toEqual([]);
    expect(problem?.field).toBe("props.rows[0].price");
    expect(problem?.message).toContain('row "r1"');
    expect(problems(table({ columns: [yen], rows: [{ id: "r1", price: "1200" }] }))).toEqual([]);
  });

  test("a computed field in a row fails, naming the row and the field", () => {
    const [problem, ...rest] = problems(
      withRows([{ id: "pm", role: "PM", days: 1, rate: "1.00", amount: "1.00" }]),
    );
    expect(rest).toEqual([]);
    expect(problem?.field).toBe("props.rows[0].amount");
    expect(problem?.message).toContain('row "pm"');
    expect(problem?.message).toContain("formula");
  });

  test("a field no column declares fails, as the same verdict says it", () => {
    const [problem, ...rest] = problems(withRows([{ id: "pm", bonus: 1 }]));
    expect(rest).toEqual([]);
    expect(problem?.field).toBe("props.rows[0].bonus");
    expect(
      tablePropsProblems({ ...ROLES, rows: [{ id: "pm", bonus: 1 }] }, "agent").map(
        ({ path }) => path,
      ),
    ).toEqual(["/rows/0/bonus"]);
  });

  test("row IDs: __proto__ and constructor pass; a repeated ID fails; u- fails for the agent and passes in an edited value", () => {
    expect(
      problems(withRows([{ id: "__proto__" }, { id: "constructor" }, { id: "toString" }])),
    ).toEqual([]);
    const [twice, ...rest] = problems(withRows([{ id: "pm" }, { id: "pm" }]));
    expect(rest).toEqual([]);
    expect(twice?.field).toBe("props.rows[1].id");
    expect(twice?.message).toContain('"pm"');
    const [prefixed, ...more] = problems(withRows([{ id: "u-1" }]));
    expect(more).toEqual([]);
    expect(prefixed?.field).toBe("props.rows[0].id");
    expect(prefixed?.message).toContain("u-");
    const edited = { ...TABLE_FIXTURE_ITEM, props: { ...ROLES, rows: [{ id: "u-1" }] } };
    expect(widgetItemProblems(edited, QUESTION, "edited", TYPES)).toEqual([]);
    expect(widgetItemProblems(edited, QUESTION, "agent", TYPES).length).toBeGreaterThan(0);
  });

  test("a prototype name as a cell's key or a row ID is data, never an inherited member", () => {
    const forged = JSON.parse('{"id":"pm","__proto__":"x"}');
    expect(Object.hasOwn(forged, "__proto__")).toBe(true);
    expect(
      tablePropsProblems({ ...ROLES, rows: [forged] }, "agent").map(({ path }) => path),
    ).toEqual(["/rows/0/__proto__"]);
    const rows = [
      { id: "constructor", role: "x", days: 1, rate: "1.00" },
      { id: "__proto__", role: "y" },
    ];
    expect(tablePropsProblems({ ...ROLES, rows }, "agent")).toEqual([]);
    const named = {
      columns: [
        { field: "constructor", label: "C", type: "text" },
        { field: "toString", label: "T", type: "number" },
      ],
      rows: [{ id: "a", constructor: "x", toString: 2 }],
    };
    expect(tablePropsProblems(named, "agent")).toEqual([]);
    expect(problems(table(named))).toEqual([]);
    const bad = { ...named, rows: [{ id: "a", constructor: 5 }] };
    expect(tablePropsProblems(bad, "agent").map(({ path }) => path)).toEqual([
      "/rows/0/constructor",
    ]);
  });

  test("rows that are no list, no objects, or have no ID are problems, never throws", () => {
    for (const rows of [
      "x",
      [null],
      [[]],
      [{}],
      [{ id: 1 }],
      [{ id: "" }],
      [{ id: "a b" }],
      null,
    ]) {
      expect(tablePropsProblems({ ...ROLES, rows }, "agent").length).toBeGreaterThan(0);
    }
    expect(tablePropsProblems({ ...ROLES, rows: [{ id: "a" }, { id: "b" }] }, "agent")).toEqual([]);
    const over = Array.from({ length: TABLE_MAX_ROWS + 1 }, (_, index) => ({ id: `r${index}` }));
    expect(tablePropsProblems({ ...ROLES, rows: over }, "agent").map(({ path }) => path)).toEqual([
      "/rows",
    ]);
  });

  test("a row's problems do not repeat for a column the Table's own columns refused", () => {
    const columns = [{ field: "a", label: "A", type: "pick" }, ...ROLES.columns];
    const found = tablePropsProblems(
      { columns, rows: [{ id: "x", a: "1", role: "R" }] },
      "agent",
    ).map(({ path }) => path);
    expect(found).toEqual(["/columns/0/type"]);
  });
});

// One table of cases, each checked three ways with one verdict: an ask through `validateAskRequestOver`,
// an edited value through `widgetItemProblems` with "edited", and `tableCellProblems` alone.
type Case = readonly [name: string, column: object, value: unknown, ok: boolean];
const TEXT = { field: "f", label: "F", type: "text" };
const NUMBER = { field: "f", label: "F", type: "number", min: 0, max: 100, step: 5 };
const WHOLE = { field: "f", label: "F", type: "number", integer: true };
const USD = { field: "f", label: "F", type: "money", currency: "USD", min: "0", max: "1000.00" };
const JPY = { field: "f", label: "F", type: "money", currency: "JPY" };
const BHD = { field: "f", label: "F", type: "money", currency: "BHD" };
const DATE = { field: "f", label: "F", type: "date", min: "2026-01-01", max: "2026-12-31" };
const TOGGLE = { field: "f", label: "F", type: "toggle" };
const LIMITED = { field: "f", label: "F", type: "text", maxLength: 5 };
const CASES: readonly Case[] = [
  ["text", TEXT, "Developer", true],
  ["text of 500 code points", TEXT, emoji(TABLE_TEXT_MAX_CHARS), true],
  ["text of 501 code points", TEXT, emoji(TABLE_TEXT_MAX_CHARS + 1), false],
  ["empty text", TEXT, "", false],
  ["text with a line break", TEXT, "a\nb", false],
  ["text at the column's maxLength", LIMITED, "abcde", true],
  ["text over the column's maxLength", LIMITED, "abcdef", false],
  ["a number for a text column", TEXT, 5, false],
  ["null for a text column", TEXT, null, false],
  ["a number on the step", NUMBER, 15, true],
  ["a number at the minimum", NUMBER, 0, true],
  ["a number at the maximum", NUMBER, 100, true],
  ["a number below the minimum", NUMBER, -5, false],
  ["a number above the maximum", NUMBER, 105, false],
  ["a number off the step", NUMBER, 12, false],
  ["a whole number", WHOLE, 4, true],
  ["a fraction in a whole column", WHOLE, 4.5, false],
  ["a number past the contract's bound", WHOLE, 2e15, false],
  ["a string for a number column", NUMBER, "5", false],
  ["null for a number column", NUMBER, null, false],
  ["a money amount", USD, "40.00", true],
  ["a money amount at the minimum", USD, "0", true],
  ["a money amount below the minimum", USD, "-5.00", false],
  ["a money amount above the maximum", USD, "1000.01", false],
  ["yen with no decimals", JPY, "1200", true],
  ["yen with a decimal", JPY, "1200.5", false],
  ["dinar with three decimals", BHD, "1.234", true],
  ["dinar with four decimals", BHD, "1.2345", false],
  ["a comma decimal", USD, "12,5", false],
  ["a number for a money column", USD, 5, false],
  ["a date within the bounds", DATE, "2026-06-15", true],
  ["a date that does not exist", DATE, "2026-02-30", false],
  ["a date before the minimum", DATE, "2025-12-31", false],
  ["a date after the maximum", DATE, "2027-01-01", false],
  ["a date in the wrong form", DATE, "15/06/2026", false],
  ["on", TOGGLE, true, true],
  ["off", TOGGLE, false, true],
  ["a toggle holding the text true", TOGGLE, "true", false],
  ["a toggle holding 1", TOGGLE, 1, false],
];

describe("The same verdict everywhere", () => {
  const roles = (column: object, value: unknown) => ({
    type: "table",
    id: "costs",
    props: { columns: [column], rows: [{ id: "r1", f: value }] },
  });
  const ask = (item: object) => ({
    askId: "table-cells-a1b2",
    items: [{ type: "question", ...QUESTION, props: { text: "Which?", items: [item] } }],
  });

  for (const [name, column, value, ok] of CASES) {
    test(`${name}: ${ok ? "taken" : "refused"} by the ask, the edited value and the cell check alike`, () => {
      const item = roles(column, value);
      const asked = validateAskRequestOver(ask(item), TYPES).ok;
      const edited = widgetItemProblems(item, QUESTION, "edited", TYPES).length === 0;
      const cell = tableCellProblems(value, column).length === 0;
      expect([asked, edited, cell]).toEqual([ok, ok, ok]);
    });
  }

  test("a cell problem is at the root of the cell and says why", () => {
    const [problem, ...rest] = tableCellProblems("-5.00", USD);
    expect(rest).toEqual([]);
    expect(problem?.path).toBe("/");
    expect(problem?.message).toContain("minimum");
    expect(tableCellProblems("x", { field: "f", label: "F", type: "pick" })).toHaveLength(1);
    expect(tableCellProblems("x", null)).toHaveLength(1);
  });

  test("a cell of a column with unreadable bounds is refused, never checked against them", () => {
    expect(
      tableCellProblems(5, { field: "f", label: "F", type: "number", min: 10, max: 5 }).length,
    ).toBeGreaterThan(0);
    expect(
      tableCellProblems("1.00", { field: "f", label: "F", type: "money" }).length,
    ).toBeGreaterThan(0);
  });
});

describe("A Table at its bounds", () => {
  test("the worst form validates in the ask, as an edited value and in its checks", () => {
    const props = tableWorstForm();
    expect(props.rows).toHaveLength(TABLE_MAX_ROWS);
    expect(props.columns).toHaveLength(TABLE_MAX_COLUMNS);
    expect(props.columns.filter(({ formula }) => formula !== undefined)).toHaveLength(9);
    expect(props.columns.filter(({ total }) => total === "sum")).toHaveLength(10);
    for (const column of props.columns)
      expect(column.formula?.length ?? 0).toBeLessThanOrEqual(500);
    const item = { type: "table", id: "worst", props };
    const started = performance.now();
    expect(problems(item)).toEqual([]);
    expect(widgetItemProblems(item, QUESTION, "edited", TYPES)).toEqual([]);
    expect(tablePropsProblems(props, "agent")).toEqual([]);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  test("the worst form with a 201st row is refused", () => {
    const props: TableProps = tableWorstForm();
    expect(
      tablePropsProblems({ ...props, rows: [...props.rows, { id: "extra" }] }, "agent"),
    ).not.toEqual([]);
  });

  test("a form of fewer rows keeps its columns", () => {
    expect(tableWorstForm(3).rows).toHaveLength(3);
    expect(tableWorstForm(0).rows).toEqual([]);
  });
});
