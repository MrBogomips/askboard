// The Table's props and columns (table-widget, task 1.2; contract spec: Table items, Table columns,
// Formula and total columns), composed over the shipped registry with `withWidgetTypes` while the
// type is not registered (design decision 14), in a fresh Ajv.

import { describe, expect, test } from "bun:test";
import { withWidgetTypes } from "../src/fixtures/index.ts";
import {
  dateFieldPropsProblems,
  moneyFieldPropsProblems,
  numberFieldPropsProblems,
  TABLE_FIELD_PATTERN,
  TABLE_FORMULA_MAX_CHARS,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  TABLE_SCHEMA_IDS,
  TABLE_TEXT_MAX_CHARS,
  TABLE_WIDGET,
  tablePropsProblems,
  textFieldPropsProblems,
  WIDGET_TYPES,
  widgetRegistryProblems,
} from "../src/index.ts";
import { registryShapeProblems } from "../src/widgets/registry.ts";
import { askAccepted, askProblems } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(TABLE_WIDGET);
const ROLES = {
  label: "Roles",
  columns: [
    { field: "role", label: "Role", type: "text" },
    { field: "days", label: "Days", type: "number", min: 0, total: "sum" },
    { field: "rate", label: "Rate", type: "money", currency: "USD" },
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
    { id: "pm", role: "Project manager", days: 18, rate: "1040.00" },
    { id: "dev", role: "Developer", days: 72, rate: "720.00" },
  ],
};
const table = (props: unknown, id = "costs") => ({ type: "table", id, props });
const withColumns = (columns: unknown) => table({ label: ROLES.label, columns, rows: [] });
const withColumn = (column: object) => withColumns([{ field: "c", label: "C", ...column }]);
const problems = (item: unknown) => askProblems(TYPES, item as ReturnType<typeof table>);
const fieldsOf = (item: unknown) => problems(item).map(({ field }) => field);
const checked = (props: unknown) => tablePropsProblems(props, "agent");
const atRoot = (found: readonly { path: string; message: string }[]) =>
  found.map(({ path, message }) => ({ path: `/columns/0${path}`, message }));
const emoji = (count: number) => "😀".repeat(count);

describe("Table items", () => {
  test("the Table of roles passes, in the ask's schema and in its checks", () => {
    expect(problems(table(ROLES))).toEqual([]);
    expect(askAccepted(TYPES, table(ROLES))).toBe(true);
    expect(checked(ROLES)).toEqual([]);
  });

  test("the entry holds together and the registry's own checks stay clean", () => {
    expect(registryShapeProblems([TABLE_WIDGET])).toEqual([]);
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(TABLE_WIDGET.type).toBe("table");
    expect(TABLE_WIDGET.props.$id).toBe(TABLE_SCHEMA_IDS.props);
    expect(TABLE_WIDGET.edits).toBeUndefined();
    expect(TABLE_WIDGET.derived).toBeUndefined();
    expect(TABLE_WIDGET.example.item.type).toBe("table");
    expect(problems(TABLE_WIDGET.example.item)).toEqual([]);
  });

  test("it is not in the shipped registry yet", () => {
    expect(WIDGET_TYPES.some(({ type }) => type === "table")).toBe(false);
  });

  test("11 columns or 201 rows fail, naming the item and the field; 10 and 200 pass", () => {
    const columns = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        field: `c${index}`,
        label: `C${index}`,
        type: "text",
      }));
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `r${index}` }));
    expect(
      problems(table({ columns: columns(TABLE_MAX_COLUMNS), rows: rows(TABLE_MAX_ROWS) })),
    ).toEqual([]);
    const [wide] = problems(table({ columns: columns(TABLE_MAX_COLUMNS + 1), rows: [] }));
    expect(wide?.itemId).toBe("costs");
    expect(wide?.field).toBe("props.columns");
    const [tall] = problems(table({ columns: columns(1), rows: rows(TABLE_MAX_ROWS + 1) }));
    expect(tall?.itemId).toBe("costs");
    expect(tall?.field).toBe("props.rows");
    expect(problems(table({ columns: [], rows: [] })).map(({ field }) => field)).toEqual([
      "props.columns",
    ]);
  });

  test("a key the Table does not have fails, naming the item and the key", () => {
    const [problem, ...rest] = problems(table({ ...ROLES, sort: "days" }));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("costs");
    expect(problem?.field).toBe("props.sort");
    expect(checked({ ...ROLES, sort: "days" }).map(({ path }) => path)).toEqual(["/sort"]);
  });

  test("rows and columns are required, fixedRows is true or absent, and the label is 1 to 200 code points", () => {
    expect(fieldsOf(table({ columns: ROLES.columns }))).toEqual(["props.rows"]);
    expect(problems(table({ rows: [] })).length).toBeGreaterThan(0);
    expect(problems(table({ ...ROLES, fixedRows: true }))).toEqual([]);
    expect(fieldsOf(table({ ...ROLES, fixedRows: false }))).toEqual(["props.fixedRows"]);
    expect(problems(table({ ...ROLES, label: emoji(200) }))).toEqual([]);
    expect(fieldsOf(table({ ...ROLES, label: emoji(201) }))).toEqual(["props.label"]);
    expect(fieldsOf(table({ ...ROLES, label: "" }))).toEqual(["props.label"]);
  });
});

describe("Table columns", () => {
  test("a money column without a currency fails, naming the item and the column's currency", () => {
    const [problem, ...rest] = problems(withColumn({ type: "money" }));
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("costs");
    expect(problem?.field).toBe("props.columns[0].currency");
    const direct = checked({ rows: [], columns: [{ field: "c", label: "C", type: "money" }] });
    expect(direct).toHaveLength(1);
    expect(direct[0]?.path).toBe("/columns/0/currency");
  });

  test("a bound of another type fails, naming the item and that key", () => {
    const [step, ...rest] = problems(withColumn({ type: "text", step: 1 }));
    expect(rest).toEqual([]);
    expect(step?.field).toBe("props.columns[0].step");
    expect(step?.itemId).toBe("costs");
    const [currency, ...more] = problems(withColumn({ type: "number", currency: "USD" }));
    expect(more).toEqual([]);
    expect(currency?.field).toBe("props.columns[0].currency");
    for (const [type, key, value] of [
      ["toggle", "min", 0],
      ["date", "step", 1],
      ["date", "currency", "USD"],
      ["money", "unit", "kg"],
      ["number", "maxLength", 10],
      ["money", "integer", true],
    ] as const) {
      const extra = type === "money" ? { currency: "USD" } : {};
      expect(fieldsOf(withColumn({ type, ...extra, [key]: value }))).toEqual([
        `props.columns[0].${key}`,
      ]);
    }
  });

  test("the checks refuse the same keys without the schema, as the board's own check must", () => {
    const column = (extra: object) => ({ field: "c", label: "C", ...extra });
    const paths = (columns: object[]) => checked({ rows: [], columns }).map(({ path }) => path);
    expect(paths([column({ type: "text", step: 1 })])).toEqual(["/columns/0/step"]);
    expect(paths([column({ type: "money", currency: "USD", currencies: ["USD", "EUR"] })])).toEqual(
      ["/columns/0/currencies"],
    );
    expect(paths([column({ type: "toggle", description: "x" })])).toEqual([
      "/columns/0/description",
    ]);
    expect(paths([column({ type: "number", multiline: true })])).toEqual(["/columns/0/multiline"]);
  });

  test("bounds are checked as the atom checks them, with the atom's own problem at the column", () => {
    const number = { field: "n", label: "N", type: "number", min: 10, max: 5 };
    const atomNumber = numberFieldPropsProblems({ label: "N", min: 10, max: 5 });
    expect(atomNumber).toHaveLength(1);
    expect(checked({ rows: [], columns: [number] })).toEqual(atRoot(atomNumber));
    const money = { field: "m", label: "M", type: "money", currency: "JPY", min: "0.5" };
    const atomMoney = moneyFieldPropsProblems({ label: "M", currency: "JPY", min: "0.5" });
    expect(atomMoney).toHaveLength(1);
    expect(checked({ rows: [], columns: [money] })).toEqual(atRoot(atomMoney));
    const date = { field: "d", label: "D", type: "date", min: "2026-03-01", max: "2026-02-01" };
    const atomDate = dateFieldPropsProblems({ label: "D", min: "2026-03-01", max: "2026-02-01" });
    expect(atomDate).toHaveLength(1);
    expect(checked({ rows: [], columns: [date] })).toEqual(atRoot(atomDate));
    const text = { field: "t", label: "T", type: "text", maxLength: 100 };
    expect(textFieldPropsProblems({ label: "T", maxLength: 100 })).toEqual([]);
    expect(checked({ rows: [], columns: [text] })).toEqual([]);
    for (const column of [number, money, date]) {
      const [found, ...rest] = problems(withColumns([column]));
      expect(rest).toEqual([]);
      expect(found?.itemId).toBe("costs");
      expect(found?.field).toBe(`props.columns[0].${column === money ? "min" : "max"}`);
      expect(found?.message).toContain(`column "${column.field}"`);
    }
  });

  test("a text column's maxLength is at most the Table's own limit, 500", () => {
    const text = (maxLength: number) => ({ field: "t", label: "T", type: "text", maxLength });
    expect(problems(withColumns([text(TABLE_TEXT_MAX_CHARS)]))).toEqual([]);
    expect(checked({ rows: [], columns: [text(TABLE_TEXT_MAX_CHARS)] })).toEqual([]);
    expect(fieldsOf(withColumns([text(TABLE_TEXT_MAX_CHARS + 1)]))).toEqual([
      "props.columns[0].maxLength",
    ]);
    expect(
      checked({ rows: [], columns: [text(TABLE_TEXT_MAX_CHARS + 1)] }).map(({ path }) => path),
    ).toEqual(["/columns/0/maxLength"]);
    expect(fieldsOf(withColumns([text(0)]))).toEqual(["props.columns[0].maxLength"]);
  });

  test("field names: constructor, toString and a1 pass; id, Rate, A1, __proto__ and a repeated field fail", () => {
    for (const field of ["constructor", "toString", "a1", "hasOwnProperty", "x".repeat(64)]) {
      expect(problems(withColumns([{ field, label: "F", type: "text" }]))).toEqual([]);
      expect(checked({ columns: [{ field, label: "F", type: "text" }], rows: [] })).toEqual([]);
    }
    expect(new RegExp(TABLE_FIELD_PATTERN).test("a1")).toBe(true);
    for (const field of ["id", "Rate", "A1", "__proto__", "1a", "", "x".repeat(65), "a-b"]) {
      expect(fieldsOf(withColumns([{ field, label: "F", type: "text" }]))).toEqual([
        "props.columns[0].field",
      ]);
      expect(
        checked({ columns: [{ field, label: "F", type: "text" }], rows: [] }).map(
          ({ path }) => path,
        ),
      ).toEqual(["/columns/0/field"]);
    }
    const twice = [
      { field: "a", label: "A", type: "text" },
      { field: "a", label: "A2", type: "number" },
    ];
    expect(fieldsOf(withColumns(twice))).toEqual(["props.columns[1].field"]);
    expect(checked({ columns: twice, rows: [] }).map(({ path }) => path)).toEqual([
      "/columns/1/field",
    ]);
  });

  test("a column label is 1 to 200 code points, counted as code points", () => {
    const labelled = (label: string) => withColumns([{ field: "a", label, type: "text" }]);
    expect(problems(labelled(emoji(200)))).toEqual([]);
    expect(fieldsOf(labelled(emoji(201)))).toEqual(["props.columns[0].label"]);
    expect(
      checked({ columns: [{ field: "a", label: emoji(200), type: "text" }], rows: [] }),
    ).toEqual([]);
    expect(
      checked({ columns: [{ field: "a", label: emoji(201), type: "text" }], rows: [] }).map(
        ({ path }) => path,
      ),
    ).toEqual(["/columns/0/label"]);
  });

  test("a column that is no object, a type that is none, or columns that are no list are problems, never throws", () => {
    for (const props of [
      { columns: "x", rows: [] },
      { columns: [null], rows: [] },
      { columns: [[]], rows: [] },
      { columns: [{ field: 1, label: "L", type: "text" }], rows: [] },
      { columns: [{ field: "a", label: "L", type: "pick" }], rows: [] },
      { columns: [{ field: "a", type: "text" }], rows: [] },
      null,
      [],
      "x",
    ]) {
      expect(checked(props).length).toBeGreaterThan(0);
    }
    expect(
      checked({ columns: [{ field: "a", label: "L", type: "pick" }], rows: [] })[0]?.path,
    ).toBe("/columns/0/type");
  });
});

describe("Formula and total columns", () => {
  test("a formula on a text or toggle column fails, naming the column's formula", () => {
    for (const type of ["text", "toggle"]) {
      expect(fieldsOf(withColumn({ type, formula: "[@a]" }))).toEqual(["props.columns[0].formula"]);
      expect(
        checked({ rows: [], columns: [{ field: "c", label: "C", type, formula: "[@a]" }] }).map(
          ({ path }) => path,
        ),
      ).toEqual(["/columns/0/formula"]);
    }
  });

  test("a formula is allowed on number, money and date columns, and on a money column beside total", () => {
    expect(problems(withColumn({ type: "number", formula: "[@days] * 2", total: "sum" }))).toEqual(
      [],
    );
    expect(
      problems(
        withColumn({ type: "money", currency: "USD", formula: "[@days] * [@rate]", total: "sum" }),
      ),
    ).toEqual([]);
    expect(problems(withColumn({ type: "date", formula: "WORKDAY([@start], [@days])" }))).toEqual(
      [],
    );
    expect(
      checked({
        rows: [],
        columns: [
          { field: "c", label: "C", type: "money", currency: "USD", formula: "[@a]", total: "sum" },
        ],
      }),
    ).toEqual([]);
  });

  test("a total on a date, text or toggle column fails, naming the column's total; only sum is a total", () => {
    for (const type of ["date", "text", "toggle"]) {
      expect(fieldsOf(withColumn({ type, total: "sum" }))).toEqual(["props.columns[0].total"]);
      expect(
        checked({ rows: [], columns: [{ field: "c", label: "C", type, total: "sum" }] }).map(
          ({ path }) => path,
        ),
      ).toEqual(["/columns/0/total"]);
    }
    expect(fieldsOf(withColumn({ type: "number", total: "avg" }))).toEqual([
      "props.columns[0].total",
    ]);
    expect(
      checked({
        rows: [],
        columns: [{ field: "c", label: "C", type: "number", total: "avg" }],
      }).map(({ path }) => path),
    ).toEqual(["/columns/0/total"]);
  });

  test("a formula of 500 characters passes and 501 fails, naming the column's formula", () => {
    const formula = (length: number) =>
      `[@a]${"+1".repeat(Math.floor((length - 4) / 2))}${(length - 4) % 2 === 1 ? "1" : ""}`;
    expect(formula(500)).toHaveLength(TABLE_FORMULA_MAX_CHARS);
    expect(problems(withColumn({ type: "number", formula: formula(500) }))).toEqual([]);
    expect(
      checked({
        rows: [],
        columns: [{ field: "c", label: "C", type: "number", formula: formula(500) }],
      }),
    ).toEqual([]);
    expect(fieldsOf(withColumn({ type: "number", formula: formula(501) }))).toEqual([
      "props.columns[0].formula",
    ]);
    expect(
      checked({
        rows: [],
        columns: [{ field: "c", label: "C", type: "number", formula: formula(501) }],
      }).map(({ path }) => path),
    ).toEqual(["/columns/0/formula"]);
    expect(fieldsOf(withColumn({ type: "number", formula: "" }))).toEqual([
      "props.columns[0].formula",
    ]);
  });

  test("a formula that does not parse does not refuse the ask: it is a warning's business", () => {
    expect(problems(withColumn({ type: "number", formula: "[@days] *" }))).toEqual([]);
    expect(
      checked({
        rows: [],
        columns: [{ field: "c", label: "C", type: "number", formula: "[@days] *" }],
      }),
    ).toEqual([]);
  });
});

describe("Table problems are worded with the item and the column", () => {
  test("each problem of a column names the item and the column, by its field", () => {
    const [problem] = problems(withColumns([{ field: "rate", label: "Rate", type: "money" }]));
    expect(problem?.message).toContain('item "costs"');
    expect(problem?.message).toContain('column "rate"');
    const [bound] = problems(
      withColumns([{ field: "days", label: "Days", type: "number", min: 10, max: 5 }]),
    );
    expect(bound?.message).toContain('item "costs"');
    expect(bound?.message).toContain('column "days"');
  });

  test("every expected shape the wording keys names an object the schema holds", () => {
    const keys = Object.keys(TABLE_WIDGET.wording.expected);
    expect(keys).toContain("table.props");
    expect(keys).toContain("table.props.columns[].type");
    for (const key of keys)
      expect(key === "table.props" || key.startsWith("table.props.")).toBe(true);
  });
});
