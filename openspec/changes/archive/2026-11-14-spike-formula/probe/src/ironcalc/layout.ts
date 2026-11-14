// Where each graph node lives in the IronCalc workbook (design decision 2). Field nodes go on
// the field sheet, one column per (item, field, depth) with rows in document order, so the
// nodes a trailing wildcard matches (the children of one node at one depth) are one
// contiguous range. Spreadsheet cells (`item.A1`) keep their own A1 geometry on a sheet per
// spreadsheet item, so `[item.A1:B3]` is the same range there. Column A of the field sheet
// stays empty: an empty wildcard list points at A1.

import type { Address, GraphNode } from "../port.ts";
import { cellName, parseCell } from "../refs.ts";
import type { ResolvedReference } from "../precheck.ts";

export interface Cell {
  readonly sheet: number;
  readonly row: number;
  readonly col: number;
}

export interface Layout {
  readonly cells: ReadonlyMap<Address, Cell>;
  /** Data sheets: the field sheet(s) first, then one per spreadsheet item. */
  readonly sheets: number;
  readonly sheetOfItem: ReadonlyMap<string, number>;
}

const MAX_COLUMNS = 16384;
const MAX_ROWS = 1048576;
/** Column A of sheet 0 is never written. */
export const EMPTY_CELL: Cell = { sheet: 0, row: 1, col: 1 };

function cellItem(address: Address): { item: string; cell: string } | null {
  const dot = address.indexOf(".");
  if (dot < 0 || address.indexOf(".", dot + 1) >= 0) return null;
  const cell = address.slice(dot + 1);
  return parseCell(cell) ? { item: address.slice(0, dot), cell } : null;
}

export function layoutNodes(nodes: readonly GraphNode[], rangeItems: readonly string[]): Layout {
  const cells = new Map<Address, Cell>();
  const groups = new Map<string, { sheet: number; col: number; rows: number }>();
  let sheet = 0;
  let nextCol = 2;
  const sheetItems: string[] = [];
  for (const node of nodes) {
    const c = cellItem(node.address);
    if (c) {
      if (!sheetItems.includes(c.item)) sheetItems.push(c.item);
      continue;
    }
    const segs = node.address.split(".");
    const key = `${segs[0]}\u0000${segs[segs.length - 1]}\u0000${segs.length - 2}`;
    let g = groups.get(key);
    if (!g) {
      if (nextCol > MAX_COLUMNS) {
        sheet++;
        nextCol = 1;
      }
      g = { sheet, col: nextCol++, rows: 0 };
      groups.set(key, g);
    }
    g.rows++;
    if (g.rows > MAX_ROWS) throw new Error(`more than ${MAX_ROWS} nodes in one column`);
    cells.set(node.address, { sheet: g.sheet, row: g.rows, col: g.col });
  }
  for (const item of rangeItems) if (!sheetItems.includes(item)) sheetItems.push(item);
  const sheetOfItem = new Map<string, number>();
  sheetItems.forEach((item, i) => sheetOfItem.set(item, sheet + 1 + i));
  for (const node of nodes) {
    const c = cellItem(node.address);
    if (!c) continue;
    const p = parseCell(c.cell) as { col: number; row: number };
    cells.set(node.address, { sheet: sheetOfItem.get(c.item) as number, row: p.row, col: p.col });
  }
  return { cells, sheets: sheet + 1 + sheetItems.length, sheetOfItem };
}

/** A1 text of a cell, sheet-qualified when it is on another sheet than `from`. */
export function a1(cell: Cell, from: number, sheetNames: readonly string[], absolute = false): string {
  const name = absolute ? cellName(cell.col, cell.row).replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2") : cellName(cell.col, cell.row);
  return cell.sheet === from ? name : `${sheetNames[cell.sheet]}!${name}`;
}

/**
 * The engine text for one reference: a cell, a contiguous range, or (when a wildcard's
 * matches are not contiguous) a comma-separated list, which only works as function arguments.
 */
export function referenceTarget(
  ref: ResolvedReference,
  range: { from: string; to: string } | undefined,
  layout: Layout,
): { kind: "cell"; cell: Cell } | { kind: "range"; from: Cell; to: Cell } | { kind: "list"; cells: Cell[] } {
  if (range) {
    const item = ref.text.slice(0, ref.text.indexOf("."));
    const sheet = layout.sheetOfItem.get(item) as number;
    const a = parseCell(range.from) as { col: number; row: number };
    const b = parseCell(range.to) as { col: number; row: number };
    const from = { sheet, row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) };
    const to = { sheet, row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) };
    return { kind: "range", from, to };
  }
  if (ref.kind === "single") return { kind: "cell", cell: layout.cells.get(ref.addresses[0] as Address) as Cell };
  const list = ref.addresses.map((a) => layout.cells.get(a) as Cell);
  if (list.length === 0) return { kind: "cell", cell: EMPTY_CELL };
  const first = list[0] as Cell;
  const contiguous = list.every((c, i) => c.sheet === first.sheet && c.col === first.col && c.row === first.row + i);
  if (contiguous) return { kind: "range", from: first, to: list[list.length - 1] as Cell };
  return { kind: "list", cells: list };
}
