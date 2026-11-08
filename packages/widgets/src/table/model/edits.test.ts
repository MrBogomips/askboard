import { describe, expect, test } from "bun:test";
import { TABLE_MAX_ROWS, type TableProps, type TableRow } from "@askboard/contract";
import { TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { addRow, deleteRow, fixedRows, setCell } from "./edits.ts";

const ROLES = TABLE_FIXTURE_ITEM.props;

const ids = (value: TableProps): string[] => value.rows.map((row) => row.id);

const rowsOf = (count: number): TableProps => ({
  ...ROLES,
  rows: Array.from({ length: count }, (_, index): TableRow => ({ id: `r${index}` })),
});

const frozenAlong = (value: TableProps, ...rows: string[]): boolean =>
  Object.isFrozen(value) &&
  Object.isFrozen(value.rows) &&
  rows.every((id) => Object.isFrozen(value.rows.find((row) => row.id === id)));

describe("setCell", () => {
  test("gives a new frozen value with the one cell changed, and leaves its input alone", () => {
    const before = structuredClone(ROLES);
    const next = setCell(ROLES, "pm", "rate", "960.00");
    expect(next).not.toBe(ROLES);
    expect(next.rows[0]).toEqual({ ...(ROLES.rows[0] as TableRow), rate: "960.00" });
    expect(next.rows[1]).toBe(ROLES.rows[1]);
    expect(ROLES).toEqual(before);
    expect(
      Object.isFrozen(next) && Object.isFrozen(next.rows) && Object.isFrozen(next.rows[0]),
    ).toBe(true);
  });

  test("keeps the columns, label and the other rows in place", () => {
    const next = setCell(ROLES, "dev", "days", 40);
    expect(next.columns).toBe(ROLES.columns);
    expect(next.label).toBe("Roles");
    expect(ids(next)).toEqual(["pm", "dev"]);
  });

  test("empties a cell by taking its key out", () => {
    const next = setCell(ROLES, "pm", "rate", undefined);
    expect("rate" in (next.rows[0] as TableRow)).toBe(false);
    expect(next.rows[0]).toEqual({ id: "pm", role: "Project manager", days: 18 });
  });

  test("sets a cell of an empty row, and a toggle to false", () => {
    const table: TableProps = {
      ...rowsOf(1),
      columns: [...ROLES.columns, { field: "flag", label: "Flag", type: "toggle" }],
    };
    const next = setCell(setCell(table, "r0", "days", 3), "r0", "flag", false);
    expect(next.rows[0]).toEqual({ id: "r0", days: 3, flag: false });
  });

  test.each([
    ["the same value", "pm", "days", 18],
    ["an unknown row", "ghost", "days", 1],
    ["a formula column", "pm", "amount", "1.00"],
    ["the row's id", "pm", "id", "x"],
  ] as const)("is the input itself for %s", (_, row, field, value) => {
    expect(setCell(ROLES, row, field, value)).toBe(ROLES);
  });

  test("takes a field named like an inherited name, and a row ID `__proto__`", () => {
    const table: TableProps = {
      ...ROLES,
      columns: [{ field: "constructor", label: "C", type: "text" }],
      rows: [{ id: "__proto__" }],
    };
    const next = setCell(table, "__proto__", "constructor", "x");
    expect(Object.hasOwn(next.rows[0] as object, "constructor")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(next.rows[0], "constructor")?.value).toBe("x");
    expect(Object.getPrototypeOf(next.rows[0])).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).constructor).toBe(Object);
  });
});

describe("addRow", () => {
  test("adds an empty row after the current row with the next view ID", () => {
    const result = addRow(ROLES, { after: "pm" });
    expect(result.kind).toBe("added");
    if (result.kind !== "added") return;
    expect(result.rowId).toBe("u-1");
    expect(ids(result.value)).toEqual(["pm", "u-1", "dev"]);
    expect(result.value.rows[1]).toEqual({ id: "u-1" });
    expect(frozenAlong(result.value, "u-1")).toBe(true);
    expect(ids(ROLES)).toEqual(["pm", "dev"]);
  });

  test("adds first, last, and at the end for a row it does not know", () => {
    const first = addRow(ROLES, "first");
    const last = addRow(ROLES, "last");
    const lost = addRow(ROLES, { after: "ghost" });
    expect(first.kind === "added" && ids(first.value)).toEqual(["u-1", "pm", "dev"]);
    expect(last.kind === "added" && ids(last.value)).toEqual(["pm", "dev", "u-1"]);
    expect(lost.kind === "added" && ids(lost.value)).toEqual(["pm", "dev", "u-1"]);
  });

  test("numbers from the highest view ID the rows hold, and into an empty Table", () => {
    const table: TableProps = {
      ...ROLES,
      rows: [{ id: "u-4" }, { id: "pm" }, { id: "u-2" }],
    };
    expect(addRow(table, "last")).toMatchObject({ rowId: "u-5" });
    expect(addRow({ ...ROLES, rows: [] }, "last")).toMatchObject({ rowId: "u-1" });
  });

  test("refuses the 201st row with a code and gives no value", () => {
    const full = rowsOf(TABLE_MAX_ROWS);
    expect(addRow(full, "last")).toEqual({ kind: "refused", code: "maxRows" });
    const one = addRow(rowsOf(TABLE_MAX_ROWS - 1), "last");
    expect(one.kind === "added" && one.value.rows.length).toBe(TABLE_MAX_ROWS);
  });

  test("refuses on a Table with fixed rows", () => {
    expect(addRow({ ...ROLES, fixedRows: true }, "last")).toEqual({
      kind: "refused",
      code: "fixed",
    });
  });
});

describe("deleteRow", () => {
  test("removes the row and makes the next one current", () => {
    const result = deleteRow(ROLES, "pm");
    expect(result.kind).toBe("deleted");
    if (result.kind !== "deleted") return;
    expect(ids(result.value)).toEqual(["dev"]);
    expect(result.current).toBe("dev");
    expect(frozenAlong(result.value)).toBe(true);
    expect(ids(ROLES)).toEqual(["pm", "dev"]);
  });

  test("makes the previous row current after the last one, and none after the only one", () => {
    expect(deleteRow(ROLES, "dev")).toMatchObject({ current: "pm" });
    const only = deleteRow({ ...ROLES, rows: [{ id: "a" }] }, "a");
    expect(only).toMatchObject({ kind: "deleted", current: undefined });
    expect(only.kind === "deleted" && only.value.rows).toEqual([]);
  });

  test("refuses an unknown row, and any row of a Table with fixed rows", () => {
    expect(deleteRow(ROLES, "ghost")).toEqual({ kind: "refused", code: "noRow" });
    expect(deleteRow({ ...ROLES, fixedRows: true }, "pm")).toEqual({
      kind: "refused",
      code: "fixed",
    });
  });

  test("deletes a row named `__proto__`", () => {
    const table: TableProps = { ...ROLES, rows: [{ id: "__proto__" }, { id: "b" }] };
    const result = deleteRow(table, "__proto__");
    expect(result.kind === "deleted" && ids(result.value)).toEqual(["b"]);
  });
});

describe("fixedRows", () => {
  test("is true only for `fixedRows: true`", () => {
    expect(fixedRows(ROLES)).toBe(false);
    expect(fixedRows({ ...ROLES, fixedRows: true })).toBe(true);
  });
});
