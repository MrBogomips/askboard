// The node index: every field and cell of a checked source as one node, in document order (item
// fields, then cells row by row, then children depth first), with each item's tree kept for
// wildcards. Child IDs are unique within their item (AD-7), so `item.child.field` names a node
// wherever the child sits; walks use explicit stacks, so a deep tree costs no call stack.

import { parseCell } from "@askboard/contract";
import {
  cellsOf,
  checkCurrency,
  checkId,
  type FieldInput,
  type FieldsItem,
  fieldsOf,
  type GraphChild,
  type GraphItem,
  type GraphSource,
  isRecord,
  listOf,
  refuse,
} from "../source.ts";
import type { Address } from "../types.ts";

export type NodeEntry = FieldInput & { readonly address: Address };

export type ItemCell = { readonly column: number; readonly row: number; readonly address: Address };

export type ItemIndex = {
  /** Each node's children in document order; the item's own top level is under "". */
  readonly children: ReadonlyMap<string, readonly string[]>;
  readonly childIds: ReadonlySet<string>;
  /** The item's cells, row by row. */
  readonly cells: readonly ItemCell[];
};

export type NodeIndex = {
  readonly entries: readonly NodeEntry[];
  readonly items: ReadonlyMap<string, ItemIndex>;
  readonly positions: ReadonlyMap<Address, number>;
};

/** The item's own top level in `ItemIndex.children`; no ID is empty. */
export const ROOT = "";

const indexChildren = (
  item: FieldsItem,
  where: string,
  entries: NodeEntry[],
): Omit<ItemIndex, "cells"> => {
  const children = new Map<string, string[]>([[ROOT, []]]);
  const childIds = new Set<string>();
  const stack: { child: unknown; parent: string }[] = listOf<unknown>(
    item.children,
    "children",
    where,
  )
    .map((child) => ({ child, parent: ROOT }))
    .reverse();
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const { child, parent } = next;
    if (!isRecord(child)) return refuse(`${where}: a child is not an object`);
    const id = checkId(child.id, "child", `${where}: `);
    if (childIds.has(id)) refuse(`${where}: child ID ${id} is used twice`);
    childIds.add(id);
    children.get(parent)?.push(id);
    children.set(id, []);
    for (const [field, input] of fieldsOf(child.fields, `${where}, child ${id}`, item.currency)) {
      entries.push({ ...input, address: `${item.id}.${id}.${field}` });
    }
    const below = listOf<GraphChild>(child.children, "children", `${where}, child ${id}`);
    for (let i = below.length - 1; i >= 0; i--) stack.push({ child: below[i], parent: id });
  }
  return { children, childIds };
};

const indexItem = (item: FieldsItem, entries: NodeEntry[]): ItemIndex => {
  const where = `item ${item.id}`;
  const currency = checkCurrency(item.currency, where);
  for (const [field, input] of fieldsOf(item.fields, where, currency)) {
    entries.push({ ...input, address: `${item.id}.${field}` });
  }
  const cells: ItemCell[] = [];
  for (const [cell, input] of cellsOf(item.cells, where, currency)) {
    const address = `${item.id}.${cell}`;
    entries.push({ ...input, address });
    cells.push({ ...(parseCell(cell) as { column: number; row: number }), address });
  }
  return { ...indexChildren(item, where, entries), cells };
};

/** Checks a source of `fields` items and indexes its nodes. */
export const indexSource = (items: readonly FieldsItem[]): NodeIndex => {
  const entries: NodeEntry[] = [];
  const indexed = new Map<string, ItemIndex>();
  for (const item of items) indexed.set(item.id, indexItem(item, entries));
  const positions = new Map<Address, number>();
  for (const [position, entry] of entries.entries()) positions.set(entry.address, position);
  return { entries, items: indexed, positions };
};

const KINDS: ReadonlySet<unknown> = new Set(["fields", "wbs-pert", "gantt-plan", "gantt"]);

/** The source's items, each an object with a known kind and an ID used once. */
export const checkItems = (source: GraphSource): readonly GraphItem[] => {
  if (!isRecord(source) || !Array.isArray(source.items)) refuse("the source has no list of items");
  const seen = new Set<string>();
  return source.items.map((item: unknown) => {
    if (!isRecord(item)) return refuse("an item is not an object");
    const id = checkId(item.id, "item", "");
    if (seen.has(id)) refuse(`item ID ${id} is used twice`);
    seen.add(id);
    if (!KINDS.has(item.kind))
      refuse(`item ${id} has the unknown kind ${JSON.stringify(item.kind)}`);
    return item as GraphItem;
  });
};
