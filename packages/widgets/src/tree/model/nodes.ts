// What the Tree model's modules share about a value's nodes: finding a node with its place, the
// node count and a branch's height for the contract's limits, and the frozen copy every edit
// returns. Node IDs are
// unique at every level (design decision 11), so an ID names one node.

import type { TreeNode, TreeProps } from "@askboard/contract";

export type Nodes = readonly TreeNode[];

/** A node and its place: its parent (`undefined` at the top level), its siblings and its level. */
export type Located = {
  readonly node: TreeNode;
  readonly parentId: string | undefined;
  /** The list that holds it, itself included. */
  readonly siblings: Nodes;
  readonly index: number;
  /** 1 at the top level. */
  readonly level: number;
};

/** The node `id` with its place, or `undefined` when the value holds no such node. */
export const locate = (nodes: Nodes, id: string): Located | undefined => {
  const search = (
    list: Nodes,
    parentId: string | undefined,
    level: number,
  ): Located | undefined => {
    for (const [index, node] of list.entries()) {
      if (node.id === id) return { node, parentId, siblings: list, index, level };
      const found = search(node.children ?? [], node.id, level + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return search(nodes, undefined, 1);
};

/** How many nodes `nodes` holds, at every level. */
export const countNodes = (nodes: Nodes): number =>
  nodes.reduce((count, node) => count + 1 + countNodes(node.children ?? []), 0);

/** How many levels the branch of `node` spans: 1 for a leaf. */
export const heightOf = (node: TreeNode): number =>
  1 + Math.max(0, ...(node.children ?? []).map(heightOf));

/** Every node's ID, in document order. */
export function* nodeIds(nodes: Nodes): Generator<string> {
  for (const node of nodes) {
    yield node.id;
    yield* nodeIds(node.children ?? []);
  }
}

/** `node` without the key `key`: a copy built with `fromEntries`, so that `__proto__` stays a key. */
export const without = (node: TreeNode, key: string): TreeNode =>
  Object.fromEntries(Object.entries(node).filter(([name]) => name !== key)) as TreeNode;

/** `node` with `children`; a node left with no child loses the key, since a list is never empty. */
export const withChildren = (node: TreeNode, children: Nodes): TreeNode =>
  children.length > 0 ? { ...node, children } : without(node, "children");

/**
 * `nodes` with the list under `parentId`, the top level when it is `undefined`, replaced by
 * `change` of that list.
 */
export const withList = (
  nodes: Nodes,
  parentId: string | undefined,
  change: (list: Nodes) => Nodes,
): Nodes => {
  if (parentId === undefined) return change(nodes);
  return nodes.map((node) => {
    if (node.id === parentId) return withChildren(node, change(node.children ?? []));
    if (node.children === undefined) return node;
    return withChildren(node, withList(node.children, parentId, change));
  });
};

// A deep copy, frozen at every level, its objects built with `fromEntries` as in `without`.
const frozenCopy = (value: unknown): unknown => {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy));
  if (typeof value !== "object" || value === null) return value;
  return Object.freeze(
    Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, frozenCopy(inner)])),
  );
};

/** `value` holding `nodes`, as a new value frozen at every level; `value` stays untouched. */
export const frozenWith = (value: TreeProps, nodes: Nodes): TreeProps =>
  frozenCopy({ ...value, nodes }) as TreeProps;
