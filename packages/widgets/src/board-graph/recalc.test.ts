import { describe, expect, test } from "bun:test";
import type { TableProps, TableRow } from "@askboard/contract";
import { ganttBoardDocument, type ganttEditedValue } from "@askboard/contract/fixtures";
import type { BoardWidgetItem } from "@askboard/view/catalog";
import { type BoardGraph, liveGraph, sentGraph } from "./board-graph.ts";
import { inputChanges, startOffset } from "./recalc.ts";

const ITEMS: readonly BoardWidgetItem[] = ganttBoardDocument.items.flatMap(
  (question) => question.props.items,
);
const [RELEASE] = ITEMS as [BoardWidgetItem];
const PROPS = RELEASE.props as typeof ganttEditedValue;

/** The board's items with the Gantt's tasks edited. */
const edited = (
  edit: (task: Record<string, unknown>) => Record<string, unknown>,
  props: { readonly start?: string } = {},
): readonly BoardWidgetItem[] => [
  {
    ...RELEASE,
    props: { ...PROPS, ...props, tasks: PROPS.tasks.map((task) => edit({ ...task })) },
  },
];

const only = (id: string, fields: Record<string, unknown>) => (task: Record<string, unknown>) =>
  task.id === id ? { ...task, ...fields } : task;

describe("a request's offset, as compute's startOffset", () => {
  test("counts the working days from the plan's first working day to the request's", () => {
    expect(startOffset("2026-11-02", "2026-12-09")).toBe(27);
    expect(startOffset("2026-11-02", "2026-11-02")).toBe(0);
    // A weekend request counts to the Monday after it; a weekend plan start from its Monday.
    expect(startOffset("2026-11-02", "2026-11-07")).toBe(5);
    expect(startOffset("2026-10-31", "2026-11-03")).toBe(1);
  });

  test("is 0 for a request before the plan's first working day", () => {
    expect(startOffset("2026-11-02", "2026-10-20")).toBe(0);
  });

  test("is undefined for what is no day, which only a rebuild may refuse", () => {
    expect(startOffset("2026-11-02", "2026-02-30")).toBeUndefined();
    expect(startOffset("someday", "2026-11-03")).toBeUndefined();
  });
});

describe("the input changes that take a built graph to the next draft", () => {
  test("are none for the same items, or the same props", () => {
    expect(inputChanges(ITEMS, ITEMS)).toEqual([]);
    expect(inputChanges(ITEMS, [{ ...RELEASE }])).toEqual([]);
  });

  test("set a changed duration", () => {
    expect(inputChanges(ITEMS, edited(only("billing", { duration: 11 })))).toEqual([
      ["release.billing.duration", 11],
    ]);
  });

  test("set the offset of a request that moves", () => {
    const before = edited(only("reporting", { start: "2026-12-09" }));
    const after = edited(only("reporting", { start: "2026-12-14" }));
    expect(inputChanges(before, after)).toEqual([["release.reporting.startOffset", 30]]);
  });

  test("take several changes, in the tasks' order", () => {
    const before = edited(only("reporting", { start: "2026-12-09" }));
    const after = edited((task) =>
      task.id === "ux"
        ? { ...task, duration: 8 }
        : task.id === "reporting"
          ? { ...task, start: "2026-12-10" }
          : task,
    );
    expect(inputChanges(before, after)).toEqual([
      ["release.ux.duration", 8],
      ["release.reporting.startOffset", 28],
    ]);
  });

  test.each([
    ["a first request", ITEMS, edited(only("reporting", { start: "2026-12-09" }))],
    ["a cleared request", edited(only("reporting", { start: "2026-12-09" })), ITEMS],
    ["changed predecessors", ITEMS, edited(only("billing", { dependencies: ["ux"] }))],
    [
      "predecessors in another order",
      ITEMS,
      edited(only("portal", { dependencies: ["prototype", "architecture"] })),
    ],
    ["a changed plan start", ITEMS, edited((task) => task, { start: "2026-11-03" })],
    ["a duration that is not whole", ITEMS, edited(only("billing", { duration: 2.5 }))],
    ["a duration of 0", ITEMS, edited(only("billing", { duration: 0 }))],
    [
      "a request that is no day",
      edited(only("reporting", { start: "2026-12-09" })),
      edited(only("reporting", { start: "2026-02-30" })),
    ],
    [
      "tasks in another order",
      ITEMS,
      [{ ...RELEASE, props: { ...PROPS, tasks: [...PROPS.tasks].reverse() } }],
    ],
    ["one task fewer", ITEMS, [{ ...RELEASE, props: { ...PROPS, tasks: PROPS.tasks.slice(1) } }]],
    ["one item more", ITEMS, [...ITEMS, { type: "gantt", id: "other", props: PROPS }]],
    ["another item", ITEMS, [{ ...RELEASE, id: "other" }]],
    ["another type", ITEMS, [{ ...RELEASE, type: "tree" }]],
    [
      "a plan",
      ITEMS,
      [{ ...RELEASE, props: { start: "2026-11-02", workPackages: "wbs", tasks: {} } }],
    ],
    ["props that are no Gantt", ITEMS, [{ ...RELEASE, props: { start: "2026-11-02", tasks: 3 } }]],
    [
      "a task that is no object",
      ITEMS,
      [{ ...RELEASE, props: { ...PROPS, tasks: [7, ...PROPS.tasks.slice(1)] } }],
    ],
  ] as const)("are undefined for %s: only a rebuild gives it", (_, before, after) => {
    expect(inputChanges(before, after)).toBeUndefined();
  });

  test("leave a tree's changed props to a rebuild", () => {
    const tree = { type: "tree", id: "wbs", props: { nodes: [] } };
    expect(inputChanges([tree], [{ ...tree, props: { nodes: [{ id: "a" }] } }])).toBeUndefined();
    expect(inputChanges([tree], [tree])).toEqual([]);
  });
});

// A Table with one column of each type, input and computed, and two rows.
const TABLE: TableProps = {
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
    { field: "due", label: "Due", type: "date" },
    { field: "billable", label: "Billable", type: "toggle" },
    { field: "finish", label: "Finish", type: "date", formula: "WORKDAY([@due], [@days])" },
  ],
  rows: [
    { id: "pm", role: "Project manager", days: 18, rate: "1040.00", due: "2026-11-02" },
    { id: "dev", role: "Developer", days: 72, rate: "720.00", due: "2026-11-09", billable: true },
  ],
};

const tableItem = (props: unknown, id = "costs"): BoardWidgetItem => ({
  type: "table",
  id,
  props,
});

const withRows = (rows: readonly TableRow[]): TableProps => ({ ...TABLE, rows });

const editCell = (field: string, value: unknown, rowId = "pm"): readonly BoardWidgetItem[] => [
  tableItem({
    ...TABLE,
    rows: TABLE.rows.map((row) => {
      if (row.id !== rowId) return row;
      const { [field]: _, ...rest } = row as Record<string, unknown>;
      return value === undefined ? rest : { ...rest, [field]: value };
    }),
  }),
];

describe("the input changes of a Table", () => {
  const BEFORE = [tableItem(TABLE)];

  test.each([
    ["a number", "days", 20, ["costs.pm.days", 20]],
    ["money", "rate", "960.00", ["costs.pm.rate", "960.00"]],
    ["a date", "due", "2026-11-03", ["costs.pm.due", "2026-11-03"]],
    ["a toggle", "billable", true, ["costs.pm.billable", true]],
    ["a text", "role", "Lead", ["costs.pm.role", "Lead"]],
  ] as const)("take %s as one change", (_, field, value, change) => {
    expect(inputChanges(BEFORE, editCell(field, value))).toEqual([change]);
  });

  test("take an emptied cell as null, and a cell filled in as its value", () => {
    expect(inputChanges(BEFORE, editCell("days", undefined))).toEqual([["costs.pm.days", null]]);
    expect(inputChanges(BEFORE, editCell("billable", undefined, "dev"))).toEqual([
      ["costs.dev.billable", null],
    ]);
    expect(inputChanges(BEFORE, editCell("billable", false))).toEqual([
      ["costs.pm.billable", false],
    ]);
  });

  test("take several cells in the rows' and columns' order", () => {
    const after = [
      tableItem({
        ...TABLE,
        rows: [
          { ...(TABLE.rows[0] as TableRow), days: 1, rate: "1.00" },
          { ...(TABLE.rows[1] as TableRow), days: 2 },
        ],
      }),
    ];
    expect(inputChanges(BEFORE, after)).toEqual([
      ["costs.pm.days", 1],
      ["costs.pm.rate", "1.00"],
      ["costs.dev.days", 2],
    ]);
  });

  test("are none for the same props, a changed label or fixedRows, or a formula column's field", () => {
    expect(inputChanges(BEFORE, [tableItem(TABLE)])).toEqual([]);
    expect(
      inputChanges(BEFORE, [tableItem({ ...TABLE, label: "Other", fixedRows: true })]),
    ).toEqual([]);
  });

  test("are none for a cell edited back, and a copy of the same columns", () => {
    const copy = structuredClone(TABLE);
    expect(inputChanges(BEFORE, [tableItem(copy)])).toEqual([]);
  });

  test.each([
    ["a row added", withRows([...TABLE.rows, { id: "u-1" }])],
    ["a row removed", withRows(TABLE.rows.slice(1))],
    ["rows reordered", withRows([...TABLE.rows].reverse())],
    [
      "a row renamed",
      withRows([{ ...(TABLE.rows[0] as TableRow), id: "lead" }, ...TABLE.rows.slice(1)]),
    ],
    [
      "a formula changed",
      {
        ...TABLE,
        columns: TABLE.columns.map((column) =>
          column.field === "amount" ? { ...column, formula: "[@days]" } : column,
        ),
      },
    ],
    [
      "a column added",
      { ...TABLE, columns: [...TABLE.columns, { field: "x", label: "X", type: "text" }] },
    ],
    ["a column removed", { ...TABLE, columns: TABLE.columns.slice(1) }],
    ["columns reordered", { ...TABLE, columns: [...TABLE.columns].reverse() }],
    [
      "a bound changed",
      {
        ...TABLE,
        columns: TABLE.columns.map((column) =>
          column.field === "days" ? { ...column, min: 1 } : column,
        ),
      },
    ],
    ["props that are no Table", { label: "x" }],
    ["rows that are no list", { ...TABLE, rows: {} }],
    ["a row that is no object", { ...TABLE, rows: [7, TABLE.rows[1]] }],
    [
      "a cell that is no scalar",
      withRows([{ ...(TABLE.rows[0] as TableRow), days: [1] as never }, ...TABLE.rows.slice(1)]),
    ],
  ] as const)("are undefined for %s: only a rebuild gives it", (_, props) => {
    expect(inputChanges(BEFORE, [tableItem(props)])).toBeUndefined();
  });

  test("are undefined when the Table before was no Table, or the item is another", () => {
    expect(inputChanges([tableItem({ label: "x" })], BEFORE)).toBeUndefined();
    expect(inputChanges(BEFORE, [tableItem(TABLE, "other")])).toBeUndefined();
  });

  test("leave the Gantt's cases as they were, beside a Table", () => {
    const beside = [...ITEMS, tableItem(TABLE)];
    const after = [...edited(only("billing", { duration: 11 })), tableItem(TABLE)];
    expect(inputChanges(beside, after)).toEqual([["release.billing.duration", 11]]);
    const both = [...edited(only("billing", { duration: 11 })), ...editCell("days", 3)];
    expect(inputChanges(beside, both)).toEqual([
      ["release.billing.duration", 11],
      ["costs.pm.days", 3],
    ]);
  });

  test("a row named __proto__ or a field named constructor is data", () => {
    const table: TableProps = {
      columns: [
        { field: "constructor", label: "C", type: "number", total: "sum" },
        { field: "toString", label: "T", type: "number", formula: "[@constructor]" },
      ],
      rows: [{ id: "__proto__", constructor: 1 } as unknown as TableRow],
    };
    const after = { ...table, rows: [{ id: "__proto__", constructor: 2 } as unknown as TableRow] };
    expect(inputChanges([tableItem(table)], [tableItem(after)])).toEqual([
      ["costs.__proto__.constructor", 2],
    ]);
  });
});

// A small seeded generator, so that a failure repeats.
const generator = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

const VALUES = {
  role: ["A", "B", "", "ünï"],
  days: [0, 1, 2.5, 40, 1e6, -3, undefined],
  rate: ["0", "1.00", "960.00", "-5.25", "12345678.90", undefined],
  due: ["2026-11-02", "2026-12-31", "2027-01-04", "1900-03-01", undefined],
  billable: [true, false, undefined],
} as const;

describe("a live graph moved on by cell edits", () => {
  test("equals a fresh build after 200 random cell edits", () => {
    const random = generator(20261107);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
    let props: TableProps = TABLE;
    const sentItems = [tableItem(TABLE)];
    for (let step = 0; step < 200; step++) {
      const row = pick(props.rows);
      const field = pick(Object.keys(VALUES)) as keyof typeof VALUES;
      const value = pick(VALUES[field] as readonly unknown[]);
      const { [field]: _, ...rest } = row as Record<string, unknown>;
      const next = value === undefined ? rest : { ...rest, [field]: value };
      const previous = props;
      props = { ...props, rows: props.rows.map((r) => (r === row ? (next as TableRow) : r)) };
      // One cell is one change at most: the graph moves on in place, never by a rebuild.
      const moved = inputChanges([tableItem(previous)], [tableItem(props)]);
      expect(moved?.length).toBeLessThanOrEqual(1);
      const live = liveGraph({
        items: sentItems,
        draft: new Map([["costs", props]]),
        shown: new Map([["costs", props]]),
      }) as BoardGraph;
      const fresh = sentGraph({
        items: [tableItem(props)],
        draft: new Map(),
        shown: new Map(),
      }) as BoardGraph;
      for (const { id } of props.rows) {
        for (const column of TABLE.columns) {
          const address = `costs.${id}.${column.field}`;
          expect(live.read(address)).toEqual(fresh.read(address));
        }
      }
      for (const column of TABLE.columns.filter(({ total }) => total !== undefined)) {
        expect(live.read(`costs.${column.field}`)).toEqual(fresh.read(`costs.${column.field}`));
      }
    }
  });
});
