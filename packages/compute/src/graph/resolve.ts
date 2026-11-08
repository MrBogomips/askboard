// Resolves a flat reference against the node index (AD-13): `item.field`, `item.child.field`
// wherever the child sits, a `*` for the children of the node before it in document order, an
// item's cell, or a range row by row. A cell of a known item with no node reads as empty.

import { REFERENCE_WILDCARD, ROW_REFERENCE_PREFIX } from "@askboard/contract";
import type { Cell, ReferenceSyntax } from "../formula/lexer.ts";
import type { Address } from "../types.ts";
import { type ItemIndex, type NodeIndex, ROOT } from "./nodes.ts";

/**
 * What a reference reads: one node, null for an empty cell; or a list of `size` places of which
 * `cells` holds the ones with a node, as [place, address] in order, the rest empty; or why it
 * reads nothing. A range lists only the cells that exist, so its size costs nothing.
 */
export type Resolution =
  | { readonly list: false; readonly address: Address | null }
  | {
      readonly list: true;
      readonly size: number;
      readonly cells: readonly (readonly [number, Address])[];
    }
  | { readonly missing: string };

/** A column number from 1 as letters: 1 is A, 27 is AA. */
export const columnName = (column: number): string => {
  let letters = "";
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
};

const cellName = ({ column, row }: Cell): string => `${columnName(column)}${row}`;

/** The reference as written, without brackets. */
export const referenceText = (reference: ReferenceSyntax): string => {
  switch (reference.form) {
    case "row":
      return `${ROW_REFERENCE_PREFIX}${reference.field}`;
    case "cell":
      return `${reference.item}.${reference.cell}`;
    case "range":
      return `${reference.item}.${cellName(reference.from)}:${cellName(reference.to)}`;
    case "field": {
      const segments = [reference.item];
      if (reference.child !== undefined) segments.push(reference.child);
      for (let i = 0; i < reference.levels; i++) segments.push(REFERENCE_WILDCARD);
      return [...segments, reference.field].join(".");
    }
  }
};

/** A range row by row: its size, and the item's cells inside it at their row-major places. */
const range = (item: ItemIndex, from: Cell, to: Cell): Resolution => {
  const [top, bottom] = [Math.min(from.row, to.row), Math.max(from.row, to.row)];
  const [left, right] = [Math.min(from.column, to.column), Math.max(from.column, to.column)];
  const width = right - left + 1;
  const cells = item.cells
    .filter(({ column, row }) => row >= top && row <= bottom && column >= left && column <= right)
    .map(({ column, row, address }) => [(row - top) * width + column - left, address] as const);
  return { list: true, size: width * (bottom - top + 1), cells };
};

const wildcard = (
  index: NodeIndex,
  item: ItemIndex,
  reference: ReferenceSyntax & { form: "field" },
): Resolution => {
  let level: readonly string[] = [reference.child ?? ROOT];
  for (let i = 0; i < reference.levels; i++) {
    level = level.flatMap((node) => item.children.get(node) ?? []);
  }
  const addresses = level
    .map((node) => `${reference.item}.${node}.${reference.field}`)
    .filter((address) => index.positions.has(address));
  if (addresses.length === 0)
    return { missing: `wildcard [${referenceText(reference)}] matches no node` };
  return {
    list: true,
    size: addresses.length,
    cells: addresses.map((address, at) => [at, address] as const),
  };
};

/**
 * `[@field]` on the node `own`: where `own` is `item.child.field`, the field of the same child.
 * No ID or field name holds a dot, so the address's three segments are an item, a child and a
 * field; a node of any other shape (an item's field, a cell) has no row.
 */
const rowReference = (index: NodeIndex, field: string, own: Address | undefined): Resolution => {
  const text = `reference [${ROW_REFERENCE_PREFIX}${field}]`;
  const segments = own?.split(".") ?? [];
  if (segments.length !== 3) return { missing: `${text} is read outside a row` };
  const address = `${segments[0]}.${segments[1]}.${field}`;
  if (!index.positions.has(address)) return { missing: `${text} names no node` };
  return { list: false, address };
};

/** Resolves a reference; `own` is the address of the node whose formula holds it (for `[@field]`). */
export const resolveReference = (
  index: NodeIndex,
  reference: ReferenceSyntax,
  own?: Address,
): Resolution => {
  if (reference.form === "row") return rowReference(index, reference.field, own);
  const text = `reference [${referenceText(reference)}]`;
  const item = index.items.get(reference.item);
  if (item === undefined) return { missing: `${text} names no item ${reference.item}` };
  if (reference.form === "range") return range(item, reference.from, reference.to);
  if (reference.form === "cell") {
    const address = `${reference.item}.${reference.cell}`;
    return { list: false, address: index.positions.has(address) ? address : null };
  }
  if (reference.child !== undefined && !item.childIds.has(reference.child)) {
    return { missing: `${text} names no child ${reference.child} of ${reference.item}` };
  }
  if (reference.levels > 0) return wildcard(index, item, reference);
  const segments = [reference.item, reference.child, reference.field].filter(
    (s) => s !== undefined,
  );
  const address = segments.join(".");
  if (!index.positions.has(address)) return { missing: `${text} names no node` };
  return { list: false, address };
};
