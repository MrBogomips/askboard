import { describe, expect, test } from "bun:test";
import type { TableProps, TableRow } from "@askboard/contract";
import { TABLE_EDITED_PROPS, TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { addRow, deleteRow, setCell } from "./edits.ts";
import { cellChanged, changeCounter, marksOf, NO_MARKS } from "./marks.ts";

const SENT = TABLE_FIXTURE_ITEM.props;

describe("what the user changed against the Table as sent", () => {
  test("an untouched Table has no marks and the counter reads none", () => {
    const marks = marksOf(SENT, SENT);
    expect(marks.count).toBe(0);
    expect(marks.added.size + marks.removed.length + marks.changed.size).toBe(0);
    expect(marks).toEqual(NO_MARKS);
    expect(changeCounter(marks, "en-US")).toBe("No changes");
  });

  test("a lowered rate is one changed cell", () => {
    const marks = marksOf(SENT, setCell(SENT, "pm", "rate", "960.00"));
    expect(marks.count).toBe(1);
    expect(cellChanged(marks, "pm", "rate")).toBe(true);
    expect(cellChanged(marks, "pm", "days")).toBe(false);
    expect(cellChanged(marks, "dev", "rate")).toBe(false);
    expect(changeCounter(marks, "en-US")).toBe("Your changes: 1");
  });

  test("an emptied cell and a cell filled in are changes too", () => {
    const emptied = marksOf(SENT, setCell(SENT, "pm", "rate", undefined));
    expect(cellChanged(emptied, "pm", "rate")).toBe(true);
    const sparse: TableProps = { ...SENT, rows: [{ id: "pm" }, ...SENT.rows.slice(1)] };
    const filled = marksOf(sparse, setCell(sparse, "pm", "days", 3));
    expect(cellChanged(filled, "pm", "days")).toBe(true);
    expect(filled.count).toBe(1);
  });

  test("a value put back is no change", () => {
    const back = setCell(setCell(SENT, "pm", "rate", "1.00"), "pm", "rate", "1040.00");
    expect(marksOf(SENT, back).count).toBe(0);
  });

  test("an added row counts once, whatever its cells hold", () => {
    const added = addRow(SENT, "last");
    if (added.kind !== "added") throw new Error("not added");
    const filled = setCell(setCell(added.value, "u-1", "role", "QA"), "u-1", "days", 5);
    const marks = marksOf(SENT, filled);
    expect(marks.added).toEqual(new Set(["u-1"]));
    expect(marks.count).toBe(1);
    expect(cellChanged(marks, "u-1", "role")).toBe(false);
  });

  test("a deleted row counts once and is named", () => {
    const deleted = deleteRow(SENT, "dev");
    if (deleted.kind !== "deleted") throw new Error("not deleted");
    const marks = marksOf(SENT, deleted.value);
    expect(marks.removed).toEqual(["dev"]);
    expect(marks.count).toBe(1);
  });

  test("changed cells, added rows and deleted rows add up", () => {
    const marks = marksOf(SENT, TABLE_EDITED_PROPS);
    expect(marks.count).toBe(2);
    expect(marks.added).toEqual(new Set(["u-1"]));
    expect(cellChanged(marks, "pm", "rate")).toBe(true);
    const more = marksOf(
      SENT,
      setCell(
        {
          ...TABLE_EDITED_PROPS,
          rows: TABLE_EDITED_PROPS.rows.slice(0, 1).concat(TABLE_EDITED_PROPS.rows.slice(2)),
        },
        "pm",
        "days",
        1,
      ),
    );
    expect(more.count).toBe(4);
    expect(more.removed).toEqual(["dev"]);
  });

  test("a reordered Table has the same marks: a move is no counted change", () => {
    const reversed: TableProps = { ...SENT, rows: [...SENT.rows].reverse() };
    expect(marksOf(SENT, reversed).count).toBe(0);
  });

  test("the counter reads in the ask's language", () => {
    const marks = marksOf(SENT, TABLE_EDITED_PROPS);
    expect(changeCounter(marks, "en-US")).toBe("Your changes: 2");
    expect(changeCounter(marks, "it-IT")).not.toContain("Your changes");
    expect(changeCounter(NO_MARKS, "it-IT")).not.toBe("No changes");
  });

  test("rows and fields named like inherited names are only data", () => {
    const table: TableProps = {
      ...SENT,
      columns: [{ field: "constructor", label: "C", type: "text" }],
      rows: [{ id: "__proto__", constructor: "a" } as unknown as TableRow],
    };
    const marks = marksOf(table, setCell(table, "__proto__", "constructor", "b"));
    expect(cellChanged(marks, "__proto__", "constructor")).toBe(true);
    expect(cellChanged(marks, "toString", "constructor")).toBe(false);
    expect(cellChanged(NO_MARKS, "constructor", "constructor")).toBe(false);
    expect(marks.count).toBe(1);
  });
});
