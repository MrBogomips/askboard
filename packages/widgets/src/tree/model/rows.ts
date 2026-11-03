// The Tree's visible rows (design decision 5): what the treegrid shows of a value, one row per node
// whose ancestors are all expanded, in document order, with what its roles need (aria-level,
// aria-posinset, aria-setsize, aria-expanded). Expanding is view state, never draft: the component
// holds the set of collapsed nodes, empty when a Tree without `pert` opens, so a standalone Tree
// opens fully expanded (open question 8) and a node that gains children later is expanded too. A
// work breakdown opens with the levels above its `openDepth` open (molecules design decision 14).

import type { TreeNode, TreeProps } from "@askboard/contract";
import { isPert } from "./nodes.ts";

export type TreeRow = {
  readonly node: TreeNode;
  /** The node's depth, 1 at the top level (aria-level). */
  readonly level: number;
  /** The parent's ID, `undefined` at the top level. */
  readonly parentId: string | undefined;
  /** The node's place among its siblings, from 1 (aria-posinset). */
  readonly position: number;
  /** How many siblings it has, itself included (aria-setsize). */
  readonly setSize: number;
  readonly hasChildren: boolean;
  /** Whether its children show: never on a leaf. */
  readonly expanded: boolean;
};

/** The rows the treegrid shows of `nodes`, every node expanded unless `collapsed` holds its ID. */
export const visibleRows = (
  nodes: readonly TreeNode[],
  collapsed: ReadonlySet<string>,
): readonly TreeRow[] => {
  const rows: TreeRow[] = [];
  const walk = (list: readonly TreeNode[], level: number, parentId: string | undefined): void => {
    list.forEach((node, at) => {
      const children = node.children ?? [];
      const hasChildren = children.length > 0;
      const expanded = hasChildren && !collapsed.has(node.id);
      const setSize = list.length;
      const row = { node, level, parentId, position: at + 1, setSize, hasChildren, expanded };
      rows.push(Object.freeze(row));
      if (expanded) walk(children, level + 1, node.id);
    });
  };
  walk(nodes, 1, undefined);
  return Object.freeze(rows);
};

/** The levels a work breakdown opens with when its props set no `openDepth` (EXPERIENCE, WBS with PERT). */
export const PERT_OPEN_DEPTH = 2;

/**
 * The collapsed nodes a Tree opens with: none without `pert`; in a work breakdown, every node with
 * children at its `openDepth` level or below, so the levels above it show open and the rest closed.
 */
export const openingCollapsed = (value: TreeProps): ReadonlySet<string> => {
  const collapsed = new Set<string>();
  if (!isPert(value)) return collapsed;
  const depth = value.openDepth ?? PERT_OPEN_DEPTH;
  const walk = (list: readonly TreeNode[], level: number): void => {
    for (const node of list) {
      const children = node.children ?? [];
      if (children.length === 0) continue;
      if (level >= depth) collapsed.add(node.id);
      walk(children, level + 1);
    }
  };
  walk(value.nodes, 1);
  return collapsed;
};
