// The Tree's row selection (widget-editing-plus design decisions 1 and 3; spec, "Tree row
// selection"): the selected nodes as a set of IDs, view state that is in no draft, answer or
// change. Every function returns a new set and never touches its input. The set is always
// normalised, so a parent is in it exactly when every child of it is: selecting a parent selects
// the whole branch under it, and a parent's partial state is derived from its subtree, never kept.
// Collapsed rows count for "Select all", a node's subtree and the tri-state, and are skipped only
// by a range over the visible rows. Plain ECMAScript.

import type { TreeNode, TreeProps } from "@askboard/contract";
import { locate, type Nodes } from "./nodes.ts";
import type { TreeRow } from "./rows.ts";

/** The selected nodes' IDs. */
export type Selection = ReadonlySet<string>;

/** A row's check box: all of its branch selected, some of it, or none. */
export type CheckState = "checked" | "partial" | "none";

/** No node selected. */
export const NO_SELECTION: Selection = new Set();

// Every ID of a branch, its root included, in document order.
const branchOf = (node: TreeNode): string[] => [
  node.id,
  ...(node.children ?? []).flatMap(branchOf),
];

// `ids` made consistent with the tree: a node with children is in it when all its children are, a
// leaf when `ids` holds it, and an ID the tree does not hold is dropped.
const normalised = (nodes: Nodes, ids: ReadonlySet<string>): Selection => {
  const out = new Set<string>();
  const walk = (node: TreeNode): boolean => {
    const children = node.children ?? [];
    const selected = children.length === 0 ? ids.has(node.id) : children.map(walk).every(Boolean);
    if (selected) out.add(node.id);
    return selected;
  };
  nodes.forEach(walk);
  return out;
};

/** A row's check box: checked when selected, partial when part of its branch is. */
export const stateOf = (selection: Selection, node: TreeNode): CheckState => {
  if (selection.has(node.id)) return "checked";
  return (node.children ?? []).some((child) => stateOf(selection, child) !== "none")
    ? "partial"
    : "none";
};

/** The header check box: checked when every node is selected, none when none is. */
export const headerState = (selection: Selection, value: TreeProps): CheckState => {
  const states = value.nodes.map((node) => stateOf(selection, node));
  if (states.length > 0 && states.every((state) => state === "checked")) return "checked";
  return states.every((state) => state === "none") ? "none" : "partial";
};

/** How many nodes are selected, parents included. */
export const countOf = (selection: Selection): number => selection.size;

/** Selects the node `nodeId` with its branch; unknown nodes change nothing. */
export const selectSubtree = (
  selection: Selection,
  value: TreeProps,
  nodeId: string,
): Selection => {
  const place = locate(value.nodes, nodeId);
  if (place === undefined) return selection;
  return normalised(value.nodes, new Set([...selection, ...branchOf(place.node)]));
};

/** Toggles the node `nodeId` with its branch: a checked node clears, any other selects. */
export const toggle = (selection: Selection, value: TreeProps, nodeId: string): Selection => {
  const place = locate(value.nodes, nodeId);
  if (place === undefined) return selection;
  if (stateOf(selection, place.node) !== "checked") return selectSubtree(selection, value, nodeId);
  const branch = new Set(branchOf(place.node));
  return normalised(value.nodes, new Set([...selection].filter((id) => !branch.has(id))));
};

/**
 * Extends the selection over the visible `rows` from `anchorId` to `targetId`, either way round,
 * with each row's branch; collapsed rows are skipped as the rows skip them. Nothing changes when
 * either row is not shown.
 */
export const extend = (
  selection: Selection,
  value: TreeProps,
  rows: readonly TreeRow[],
  anchorId: string,
  targetId: string,
): Selection => {
  const from = rows.findIndex((row) => row.node.id === anchorId);
  const to = rows.findIndex((row) => row.node.id === targetId);
  if (from === -1 || to === -1) return selection;
  const between = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
  return normalised(
    value.nodes,
    new Set([...selection, ...between.flatMap((row) => branchOf(row.node))]),
  );
};

/** Every node, collapsed ones included. */
export const selectAll = (value: TreeProps): Selection =>
  normalised(value.nodes, new Set(value.nodes.flatMap(branchOf)));

/** No node: the same value `NO_SELECTION` is. */
export const selectNone = (): Selection => NO_SELECTION;

/** The selection without the nodes `value` no longer holds (a delete, a move cannot add any). */
export const pruned = (selection: Selection, value: TreeProps): Selection => {
  const kept = normalised(value.nodes, selection);
  return kept.size === selection.size && [...kept].every((id) => selection.has(id))
    ? selection
    : kept;
};

/** The leaves among the selected nodes, in document order: what a bulk adjustment changes. */
export const selectedLeaves = (selection: Selection, value: TreeProps): readonly TreeNode[] => {
  const leaves: TreeNode[] = [];
  const walk = (list: Nodes): void => {
    for (const node of list) {
      if ((node.children ?? []).length > 0) walk(node.children ?? []);
      else if (selection.has(node.id)) leaves.push(node);
    }
  };
  walk(value.nodes);
  return leaves;
};
