// Resolves a flat reference against the node index (AD-13): `item.field`, `item.child.field`
// wherever the child sits, a `*` for the children of the node before it in document order, an
// item's cell, or a range row by row. A cell of a known item with no node reads as empty.

import { REFERENCE_WILDCARD } from "@askboard/contract";
import type { Cell, ReferenceSyntax } from "../formula/lexer.ts";
import type { Address } from "../types.ts";
import { type ItemIndex, type NodeIndex, ROOT } from "./nodes.ts";

/** What a reference reads: one node or a list, null for an empty cell; or why it reads nothing. */
export type Resolution =
  | { readonly list: false; readonly address: Address | null }
  | { readonly list: true; readonly addresses: readonly (Address | null)[] }
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

const range = (index: NodeIndex, item: string, from: Cell, to: Cell): Resolution => {
  const addresses: (Address | null)[] = [];
  for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row++) {
    for (
      let column = Math.min(from.column, to.column);
      column <= Math.max(from.column, to.column);
      column++
    ) {
      const address = `${item}.${columnName(column)}${row}`;
      addresses.push(index.positions.has(address) ? address : null);
    }
  }
  return { list: true, addresses };
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
  return { list: true, addresses };
};

export const resolveReference = (index: NodeIndex, reference: ReferenceSyntax): Resolution => {
  const text = `reference [${referenceText(reference)}]`;
  const item = index.items.get(reference.item);
  if (item === undefined) return { missing: `${text} names no item ${reference.item}` };
  if (reference.form === "range") return range(index, reference.item, reference.from, reference.to);
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
