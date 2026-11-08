import { describe, expect, test } from "bun:test";
import type { TableColumn, TableProps } from "@askboard/contract";
import { TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import {
  editingStands,
  focusAfterAdd,
  type KeyContext,
  openFocus,
  settleFocus,
  type TableFocus,
  type TableKey,
  tableKey,
} from "./focus.ts";

const ROLES: TableProps = {
  ...TABLE_FIXTURE_ITEM.props,
  columns: [
    ...TABLE_FIXTURE_ITEM.props.columns,
    { field: "billable", label: "Billable", type: "toggle" },
  ],
};

const key = (name: string, more: Partial<TableKey> = {}): TableKey => ({
  key: name,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...more,
});

const at = (rowId: string, field: string): TableFocus => ({ rowId, field });

const context = (focus: TableFocus | undefined, more: Partial<KeyContext> = {}): KeyContext => ({
  props: ROLES,
  focus,
  editing: false,
  readOnly: false,
  ...more,
});

describe("the grid's first and settled focus", () => {
  test("opens on the first cell, and on none in a Table with no rows", () => {
    expect(openFocus(ROLES)).toEqual(at("pm", "role"));
    expect(openFocus({ ...ROLES, rows: [] })).toBeUndefined();
  });

  test("keeps a focus that names a cell, else falls back to the nearest row or the first cell", () => {
    const focus = at("dev", "rate");
    expect(settleFocus(ROLES, focus)).toBe(focus);
    expect(settleFocus(ROLES, at("ghost", "rate"))).toEqual(at("pm", "role"));
    expect(settleFocus(ROLES, at("dev", "ghost"))).toEqual(at("dev", "role"));
    expect(settleFocus(ROLES, undefined)).toEqual(at("pm", "role"));
    expect(settleFocus({ ...ROLES, rows: [] }, focus)).toBeUndefined();
  });

  test("a row added gets its first input cell current", () => {
    expect(focusAfterAdd(ROLES, "u-1")).toEqual(at("u-1", "role"));
    const formulaFirst: TableProps = {
      ...ROLES,
      columns: [ROLES.columns[3], ROLES.columns[0]] as TableProps["columns"],
    };
    expect(focusAfterAdd(formulaFirst, "u-1")).toEqual(at("u-1", "role"));
  });
});

describe("the arrow keys", () => {
  test.each([
    ["ArrowDown", at("pm", "days"), at("dev", "days")],
    ["ArrowUp", at("dev", "days"), at("pm", "days")],
    ["ArrowRight", at("pm", "days"), at("pm", "rate")],
    ["ArrowLeft", at("pm", "rate"), at("pm", "days")],
    ["Home", at("pm", "rate"), at("pm", "role")],
    ["End", at("pm", "role"), at("pm", "billable")],
  ] as const)("%s moves the current cell", (name, from, to) => {
    expect(tableKey(key(name), context(from))).toEqual({ kind: "focus", focus: to });
  });

  test.each([
    ["ArrowUp", at("pm", "days")],
    ["ArrowDown", at("dev", "days")],
    ["ArrowLeft", at("pm", "role")],
    ["ArrowRight", at("pm", "billable")],
    ["Home", at("pm", "role")],
    ["End", at("pm", "billable")],
  ] as const)("%s at the edge changes nothing", (name, from) => {
    expect(tableKey(key(name), context(from))).toEqual({ kind: "none" });
  });

  test("a key with no focus, or a focus off the grid, lands on the first cell", () => {
    expect(tableKey(key("ArrowDown"), context(undefined))).toEqual({
      kind: "focus",
      focus: at("pm", "role"),
    });
    expect(tableKey(key("ArrowDown"), context(at("ghost", "days")))).toEqual({
      kind: "focus",
      focus: at("pm", "role"),
    });
  });

  test("a read-only grid still navigates", () => {
    expect(tableKey(key("ArrowDown"), context(at("pm", "days"), { readOnly: true }))).toEqual({
      kind: "focus",
      focus: at("dev", "days"),
    });
  });

  test("a Table with no rows has nothing to move", () => {
    expect(
      tableKey(key("ArrowDown"), context(undefined, { props: { ...ROLES, rows: [] } })),
    ).toEqual({
      kind: "none",
    });
  });
});

describe("Enter, F2 and Space", () => {
  test.each(["Enter", "F2"])("%s opens the editor on an input cell", (name) => {
    expect(tableKey(key(name), context(at("pm", "rate")))).toEqual({ kind: "edit" });
    expect(tableKey(key(name), context(at("pm", "role")))).toEqual({ kind: "edit" });
  });

  test.each(["Enter", "F2"])("%s on a formula cell opens nothing", (name) => {
    expect(tableKey(key(name), context(at("pm", "amount")))).toEqual({ kind: "none" });
  });

  test("a read-only grid opens no editor and switches no toggle", () => {
    const readOnly = { readOnly: true };
    expect(tableKey(key("Enter"), context(at("pm", "rate"), readOnly))).toEqual({ kind: "none" });
    expect(tableKey(key(" "), context(at("pm", "billable"), readOnly))).toEqual({ kind: "none" });
  });

  test("Space on a toggle cycles unset, on, off, on", () => {
    const cycle = (cell: boolean | undefined): boolean | undefined => {
      const action = tableKey(
        key(" "),
        context(at("pm", "billable"), {
          props: {
            ...ROLES,
            rows: [cell === undefined ? { id: "pm" } : { id: "pm", billable: cell }],
          },
        }),
      );
      return action.kind === "toggle" ? action.value : undefined;
    };
    const first = cycle(undefined);
    const second = cycle(first);
    const third = cycle(second);
    expect([first, second, third]).toEqual([true, false, true]);
  });

  test.each(["Space", "Enter", "F2"])(
    "%s on an on/off cell switches it and opens no editor",
    (name) => {
      const keyed = key(name === "Space" ? " " : name);
      const press = (cell: boolean | undefined) =>
        tableKey(
          keyed,
          context(at("pm", "billable"), {
            props: {
              ...ROLES,
              rows: [cell === undefined ? { id: "pm" } : { id: "pm", billable: cell }],
            },
          }),
        );
      expect(press(undefined)).toEqual({ kind: "toggle", value: true });
      expect(press(false)).toEqual({ kind: "toggle", value: true });
      expect(press(true)).toEqual({ kind: "toggle", value: false });
    },
  );

  test.each(["Delete", "Backspace"])("%s on an on/off cell returns it to not set", (name) => {
    for (const cell of [true, false]) {
      const props = { ...ROLES, rows: [{ id: "pm", billable: cell }] };
      expect(tableKey(key(name), context(at("pm", "billable"), { props }))).toEqual({
        kind: "clear",
      });
    }
  });

  test.each(["Delete", "Backspace"])(
    "%s on an input or formula cell is nothing, as before",
    (name) => {
      for (const field of ["role", "days", "rate", "amount"]) {
        expect(tableKey(key(name), context(at("pm", field)))).toEqual({ kind: "none" });
      }
    },
  );

  test("any other key on an on/off cell is nothing", () => {
    for (const name of ["a", "Tab", "Escape", "1"]) {
      expect(tableKey(key(name), context(at("pm", "billable")))).toEqual({ kind: "none" });
    }
  });

  test("a read-only grid clears nothing", () => {
    expect(tableKey(key("Delete"), context(at("pm", "billable"), { readOnly: true }))).toEqual({
      kind: "none",
    });
  });

  test("Space on any other cell does nothing", () => {
    expect(tableKey(key(" "), context(at("pm", "rate")))).toEqual({ kind: "none" });
    expect(tableKey(key(" "), context(at("pm", "amount")))).toEqual({ kind: "none" });
  });
});

describe("while an editor is open", () => {
  test("Escape cancels it", () => {
    expect(tableKey(key("Escape"), context(at("pm", "rate"), { editing: true }))).toEqual({
      kind: "cancel",
    });
  });

  test("every other key is the editor's", () => {
    for (const name of ["ArrowDown", "Home", "Enter", "F2", " ", "a"]) {
      expect(tableKey(key(name), context(at("pm", "rate"), { editing: true }))).toEqual({
        kind: "none",
      });
    }
  });

  test("Escape with no editor open is no action", () => {
    expect(tableKey(key("Escape"), context(at("pm", "rate")))).toEqual({ kind: "none" });
  });
});

describe("keys that are not the Table's", () => {
  test("a key with a modifier, or while an input method composes, does nothing", () => {
    const focus = at("pm", "days");
    for (const more of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { shiftKey: true },
      { isComposing: true },
    ]) {
      expect(tableKey(key("ArrowDown", more), context(focus))).toEqual({ kind: "none" });
    }
    expect(tableKey(key("a"), context(focus))).toEqual({ kind: "none" });
  });

  test("a row ID `__proto__` is a row like any other", () => {
    const props: TableProps = { ...ROLES, rows: [{ id: "__proto__" }, { id: "constructor" }] };
    expect(tableKey(key("ArrowDown"), context(at("__proto__", "days"), { props }))).toEqual({
      kind: "focus",
      focus: at("constructor", "days"),
    });
  });
});

describe("editingStands", () => {
  const rate = ROLES.columns.find((column) => column.field === "rate") as TableColumn;
  const opened = { rowId: "pm", field: "rate", column: rate };

  test("holds while the row exists and the column is the one the editor opened on", () => {
    expect(editingStands(ROLES, opened)).toBe(true);
    expect(editingStands(ROLES, { ...opened, column: { ...rate } })).toBe(true);
  });

  test("falls when the row or the column is gone", () => {
    expect(editingStands(ROLES, { ...opened, rowId: "nobody" })).toBe(false);
    const columns = ROLES.columns.filter((column) => column.field !== "rate");
    expect(editingStands({ ...ROLES, columns }, opened)).toBe(false);
  });

  test("falls when the column became a formula column or an on/off one", () => {
    const swap = (column: TableColumn): TableProps => ({
      ...ROLES,
      columns: ROLES.columns.map((was) => (was.field === "rate" ? column : was)),
    });
    expect(editingStands(swap({ ...rate, formula: "[@days] * 2" }), opened)).toBe(false);
    expect(editingStands(swap({ ...rate, type: "toggle" }), opened)).toBe(false);
  });

  test("falls when the column's type, label or bounds changed, and never for an on/off or computed column opened on", () => {
    const swap = (column: TableColumn): TableProps => ({
      ...ROLES,
      columns: ROLES.columns.map((was) => (was.field === "rate" ? column : was)),
    });
    expect(editingStands(swap({ ...rate, type: "text" }), opened)).toBe(false);
    expect(editingStands(swap({ ...rate, label: "Other" }), opened)).toBe(false);
    const amount = ROLES.columns.find((column) => column.field === "amount") as TableColumn;
    expect(editingStands(ROLES, { rowId: "pm", field: "amount", column: amount })).toBe(false);
    const billable = ROLES.columns.find((column) => column.field === "billable") as TableColumn;
    expect(editingStands(ROLES, { rowId: "pm", field: "billable", column: billable })).toBe(false);
  });
});
