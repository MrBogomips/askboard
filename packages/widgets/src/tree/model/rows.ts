// The Tree's visible rows (design decision 5): what the treegrid shows of a value, one row per node
// whose ancestors are all expanded, in document order, with what its roles need (aria-level,
// aria-posinset, aria-setsize, aria-expanded). Expanding is view state, never draft: the component
// holds the set of collapsed nodes, empty when the Tree opens, so a standalone Tree opens fully
// expanded (open question 8) and a node that gains children later is expanded too.

import type { TreeNode } from "@askboard/contract";

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
