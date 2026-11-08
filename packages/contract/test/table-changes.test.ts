// The Table's changes (table-widget, task 1.4; contract spec: Table changes), composed over the
// shipped registry with `withWidgetTypes(...TABLE_TYPES)` while the type is not registered
// (design decision 14). The edited value's changes are the generic diff's, narrowed to `add`,
// `remove` and `set`; a reordered value gives a `move`, which falls outside them.

import { describe, expect, test } from "bun:test";
import {
  TABLE_EDITED_PROPS,
  TABLE_FIXTURE_ITEM,
  TABLE_TYPES,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  applyElementChanges,
  type Change,
  elementChanges,
  TABLE_SCHEMA_IDS,
  TABLE_SHAPE,
  TABLE_WIDGET,
  type TableProps,
  type TableRow,
  tablePropsProblems,
  widgetChangesProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { elementShapeOf, widgetItemProblems } from "../src/validate.ts";

const TYPES = withWidgetTypes(...TABLE_TYPES);
const ITEM = TABLE_FIXTURE_ITEM;
const PROPS = ITEM.props;
const QUESTION = { id: "q", props: { text: "Which?" } };
const diff = (edited: TableProps): readonly Change[] =>
  elementChanges(ITEM.id, PROPS as never, edited as never, TABLE_SHAPE);
const refused = (changes: unknown) => widgetChangesProblems(ITEM, changes, TYPES);

describe("Table changes", () => {
  test("the entry's changes schema is the Table's own, and its shape is a flat list of rows", () => {
    expect(TABLE_WIDGET.edits?.changes.$id).toBe(TABLE_SCHEMA_IDS.changes);
    expect(TABLE_SHAPE).toEqual({ elements: "rows" });
    expect(elementShapeOf(ITEM, TYPES)).toEqual(TABLE_SHAPE);
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });

  test("a lowered rate and an added row are a set and an add", () => {
    const changes = diff(TABLE_EDITED_PROPS);
    expect(changes).toEqual([
      { op: "set", target: "costs.pm.rate", value: "960.00" },
      {
        op: "add",
        target: "costs.u-1",
        after: "dev",
        value: { role: "Tester", days: 10, rate: "600.00" },
      },
    ]);
    expect(refused(changes)).toEqual([]);
    expect(applyElementChanges(ITEM.id, PROPS as never, changes, TABLE_SHAPE)).toEqual(
      TABLE_EDITED_PROPS as never,
    );
  });

  test("an emptied cell is a set to null, a row added first has no `after`, a removed row is a remove", () => {
    const cleared = {
      ...PROPS,
      rows: [{ id: "pm", role: "Project manager", days: 18 }, PROPS.rows[1] as TableRow],
    };
    expect(diff(cleared)).toEqual([{ op: "set", target: "costs.pm.rate", value: null }]);
    const first = { ...PROPS, rows: [{ id: "u-1", role: "x" }, ...PROPS.rows.slice(1)] };
    const changes = diff(first);
    expect(changes).toEqual([
      { op: "add", target: "costs.u-1", value: { role: "x" } },
      { op: "remove", target: "costs.pm" },
    ]);
    expect(refused(changes)).toEqual([]);
    expect(refused(diff({ ...PROPS, rows: [] }))).toEqual([]);
  });

  test("no change at all passes", () => {
    expect(diff(PROPS)).toEqual([]);
    expect(refused([])).toEqual([]);
  });

  test("a move falls outside the Table's changes, naming the item and the operation", () => {
    const reordered = { ...PROPS, rows: [...PROPS.rows].reverse() };
    const changes = diff(reordered);
    expect(changes.map(({ op }) => op)).toEqual(["move"]);
    const [problem] = refused(changes);
    expect(problem?.message).toContain("item costs");
    expect(problem?.message).toContain("move of costs.dev");
    expect(refused([{ op: "move", target: "costs.dev" }])).not.toEqual([]);
  });

  test("a change of another shape falls outside them: a parent, a column's target, a value of the wrong kind", () => {
    const outside: readonly unknown[] = [
      { op: "add", target: "costs.u-1", parent: "pm", value: {} },
      { op: "add", target: "costs.u-1.rate", value: {} },
      { op: "add", target: "costs.u-1", value: "x" },
      { op: "remove", target: "costs.pm.rate" },
      { op: "remove", target: "costs" },
      { op: "set", target: "costs.pm", value: "x" },
      { op: "set", target: "costs.pm.Rate", value: "1.00" },
      { op: "set", target: "costs.pm.rate.x", value: "1.00" },
      { op: "set", target: "costs.pm.rate", value: { amount: "1.00" } },
      { op: "set", target: "costs.pm.rate", value: ["1.00"] },
      { op: "set", target: "costs.pm.rate", value: "" },
      { op: "set", target: "costs.pm.rate" },
      { op: "patch", target: "costs.pm.rate", value: "1.00" },
    ];
    for (const change of outside)
      expect([change, refused([change]).length > 0]).toEqual([change, true]);
    const inside: readonly unknown[] = [
      { op: "set", target: "costs.pm.rate", value: "960.00" },
      { op: "set", target: "costs.pm.days", value: 17.5 },
      { op: "set", target: "costs.pm.flag", value: true },
      { op: "set", target: "costs.pm.rate", value: null },
      { op: "set", target: "costs.__proto__.constructor", value: "x" },
      { op: "add", target: "costs.__proto__", value: {} },
      { op: "remove", target: "costs.constructor" },
    ];
    for (const change of inside) expect([change, refused([change])]).toEqual([change, []]);
  });

  test("a set of a computed field cannot come from a value the checks accept: the row that holds it is refused", () => {
    const forged = {
      ...PROPS,
      rows: [{ ...(PROPS.rows[0] as TableRow), amount: "1.00" }, PROPS.rows[1] as TableRow],
    };
    expect(tablePropsProblems(forged, "edited").map(({ path }) => path)).toEqual([
      "/rows/0/amount",
    ]);
    const refusals = widgetItemProblems({ ...ITEM, props: forged }, QUESTION, "edited", TYPES);
    expect(refusals.map(({ path }) => path)).toEqual(["/rows/0/amount"]);
  });
});

// A seeded property test (mulberry32): for 1,000 random edits of a Table's rows, the diff's changes
// are all the Table's changes, and applying them in order gives the edited value back.
const generator = (seed: number) => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (count: number): number => Math.floor(next() * count);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)] as T;
  return { int, pick };
};

const ID_POOL = [
  "pm",
  "dev",
  "qa",
  "ops",
  "__proto__",
  "constructor",
  "toString",
  "u-1",
  "u-2",
  "r9",
];
const COLUMNS = [
  { field: "role", label: "Role", type: "text" },
  { field: "days", label: "Days", type: "number" },
  { field: "rate", label: "Rate", type: "money", currency: "USD" },
  { field: "done", label: "Done", type: "toggle" },
  { field: "start", label: "Start", type: "date" },
] as const;

describe("generated edits", () => {
  test("1,000 edits (cells set and emptied, rows added after any row or first, rows removed) round-trip and stay within the Table's changes", () => {
    const random = generator(0x7ab1e);
    const cell = (field: string): string | number | boolean =>
      field === "role"
        ? random.pick(["Dev", "QA", "😀".repeat(1 + random.int(5))])
        : field === "days"
          ? random.int(100) / 4
          : field === "rate"
            ? `${random.int(2000)}.${String(random.int(100)).padStart(2, "0")}`
            : field === "done"
              ? random.int(2) === 0
              : `2026-0${1 + random.int(9)}-1${random.int(9)}`;
    const row = (id: string): TableRow => {
      const fields = COLUMNS.filter(() => random.int(3) > 0).map(
        ({ field }) => [field, cell(field)] as const,
      );
      return { id, ...Object.fromEntries(fields) } as TableRow;
    };
    let changed = 0;
    for (let run = 0; run < 1_000; run++) {
      const ids = ID_POOL.slice()
        .sort(() => random.int(3) - 1)
        .slice(0, 1 + random.int(5));
      const sent = { columns: COLUMNS, rows: ids.map(row) } as unknown as TableProps;
      const item = { type: "table", id: "costs", props: sent };
      let rows = [...sent.rows];
      // An ID once in the value is not added again at another place: that would be a move.
      const used = new Set(ids);
      for (let step = random.int(6); step >= 0; step--) {
        const kind = random.int(4);
        const at = rows.length === 0 ? 0 : random.int(rows.length);
        if (kind === 0 && rows.length > 0) {
          const target = rows[at] as TableRow;
          const field = random.pick(COLUMNS).field;
          const next = { ...target };
          if (random.int(3) === 0) delete (next as Record<string, unknown>)[field];
          else (next as Record<string, unknown>)[field] = cell(field);
          rows = rows.map((r, index) => (index === at ? next : r));
        } else if (kind === 1) {
          const free = ID_POOL.filter((id) => !used.has(id));
          const id = free.length > 0 ? random.pick(free) : undefined;
          if (id !== undefined) {
            used.add(id);
            rows.splice(random.int(rows.length + 1), 0, row(id));
          }
        } else if (kind === 2 && rows.length > 0) {
          rows.splice(at, 1);
        }
      }
      const edited = { ...sent, rows } as TableProps;
      const changes = elementChanges("costs", sent as never, edited as never, TABLE_SHAPE);
      const rebuilt = applyElementChanges("costs", sent as never, changes, TABLE_SHAPE);
      expect([run, rebuilt]).toEqual([run, edited as never]);
      expect([run, widgetChangesProblems(item, changes, TYPES)]).toEqual([run, []]);
      if (changes.length > 0) changed++;
    }
    expect(changed).toBeGreaterThan(500);
  });
});
