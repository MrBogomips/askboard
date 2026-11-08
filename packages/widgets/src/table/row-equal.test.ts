import { describe, expect, test } from "bun:test";
import type { TableProps } from "@askboard/contract";
import { tableWorstForm } from "@askboard/contract/fixtures";
import type { BoardContent } from "@askboard/view/catalog";
import { type BoardGraph, liveGraph } from "../board-graph/board-graph.ts";
import { derivedMarks } from "./model/derived.ts";
import { setCell } from "./model/edits.ts";
import { marksOf } from "./model/marks.ts";
import type { NodeRowProps } from "./row.tsx";
import { rowPropsEqual } from "./row-equal.ts";

// Review U-1 of review-table-g6 (table-widget task 6.11): the rows the Table gives its grid after
// one edit of the worst form, built as `widget.tsx` builds them, and how many of them draw again.
const ID = "worst";
const NONE: ReadonlySet<string> = new Set();
const NO_LINES: NodeRowProps["lines"] = Object.freeze([]);
// The component's `useCallback` gives one function for the Table's life.
const lineText = () => null;

const graphFor = (shown: BoardContent["shown"]): BoardGraph => {
  const board: BoardContent = {
    items: [{ type: "table", id: ID, props: SENT }],
    draft: new Map(),
    shown,
  };
  return liveGraph(board) as BoardGraph;
};

const SENT = tableWorstForm();

const rowsOf = (value: TableProps, graph: BoardGraph): readonly NodeRowProps[] => {
  const marks = marksOf(SENT, value);
  const derived = derivedMarks({
    itemId: ID,
    props: value,
    sentProps: SENT,
    live: graph,
    sent: graphFor(new Map([[ID, SENT]])),
  });
  const byRow = new Map<string, Set<string>>();
  for (const key of derived.cells) {
    const at = key.indexOf(".");
    const rowId = key.slice(0, at);
    byRow.set(rowId, (byRow.get(rowId) ?? new Set<string>()).add(key.slice(at + 1)));
  }
  return value.rows.map((row, index) => ({
    itemId: ID,
    row,
    position: index + 1,
    columns: value.columns,
    stop: undefined,
    current: false,
    editable: true,
    added: marks.added.has(row.id),
    changed: marks.changed.get(row.id),
    derived: byRow.get(row.id) ?? NONE,
    graph,
    refused: new Set<string>(),
    entries: undefined,
    editing: undefined,
    lines: NO_LINES,
    lineText,
  }));
};

describe("rows that draw again after one edit of the worst form", () => {
  const before = rowsOf(SENT, graphFor(new Map([[ID, { ...SENT } as TableProps]])));
  const edited = setCell(SENT, "r100", "a", 50);
  const after = rowsOf(edited, graphFor(new Map([[ID, edited]])));

  test("the edit is a one-cell edit and the graphs are other objects", () => {
    expect(edited).not.toBe(SENT);
    expect(after[0]?.graph).not.toBe(before[0]?.graph);
    expect(SENT.rows).toHaveLength(200);
  });

  test("at most the edited row draws again, the other 199 keep what they drew", () => {
    const again = after.filter((row, at) => !rowPropsEqual(before[at] as NodeRowProps, row));
    expect(again.map((row) => row.row.id)).toEqual(["r100"]);
  });

  test("a row draws again when its own computed value, cell, mark, entry or line differs", () => {
    const one = after[0] as NodeRowProps;
    const other = after[199] as NodeRowProps;
    expect(rowPropsEqual(one, { ...one })).toBe(true);
    expect(rowPropsEqual(one, { ...one, changed: new Set(["a"]) })).toBe(false);
    expect(rowPropsEqual(one, { ...one, derived: new Set(["b"]) })).toBe(false);
    expect(rowPropsEqual(one, { ...one, entries: new Map([["a", "oops"]]) })).toBe(false);
    expect(
      rowPropsEqual(one, { ...one, lines: [{ key: "k", column: undefined, text: "t" }] }),
    ).toBe(false);
    expect(rowPropsEqual(one, { ...one, refused: new Set(["b"]) })).toBe(false);
    expect(rowPropsEqual(one, { ...one, current: true })).toBe(false);
    expect(rowPropsEqual(one, { ...one, row: other.row })).toBe(false);
    expect(rowPropsEqual(one, { ...one, graph: undefined })).toBe(false);
  });

  test("equal sets, maps and lines held by other objects are the same row", () => {
    const one = after[0] as NodeRowProps;
    const lines = [{ key: "k", column: "A", text: "t" }];
    const a = { ...one, changed: new Set(["a"]), entries: new Map([["a", "x"]]), lines };
    const b = {
      ...one,
      changed: new Set(["a"]),
      entries: new Map([["a", "x"]]),
      lines: lines.map((line) => ({ ...line })),
    };
    expect(rowPropsEqual(a, b)).toBe(true);
  });
});
