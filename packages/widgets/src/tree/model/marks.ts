// The change highlight's marks (design decision 5; proposal, open question 14): what the user
// changed against the value the agent sent, per node, and the count "Your changes: N" shows. For
// display only: the model never builds `changes` (AD-20). A node counts as moved by the rule of
// the contract's diff, so the marks name the nodes whose `move` the answer carries: a kept node
// moved to another parent, or left out of a longest run of its siblings that keep their sent
// order. A swap of two siblings marks one of them, whichever the user moved.

import type { TreeNode, TreeProps } from "@askboard/contract";

export type NodeMark = {
  /** The user added the node: its row takes the change bar. */
  readonly added: boolean;
  /** Its parent or its place among its siblings changed: its name takes a change mark. */
  readonly moved: boolean;
  readonly renamed: boolean;
  /** The fields whose value changed, an emptied one included, in code-unit order. */
  readonly fields: readonly string[];
};

export type TreeMarks = {
  /** The mark of each node of the edited value that changed; none for an unchanged node. */
  readonly byNode: ReadonlyMap<string, NodeMark>;
  /** Each added, removed, moved or edited node once, every node of a removed branch included. */
  readonly count: number;
};

/** A node's own keys; every other key is a field. */
const NODE_KEYS: ReadonlySet<string> = new Set(["id", "label", "children"]);

type Placed = {
  readonly node: TreeNode;
  readonly parentId: string | undefined;
  readonly at: number;
};

// Every node by ID, in document order, with its parent and its place among its siblings.
const placesOf = (nodes: readonly TreeNode[]): Map<string, Placed> => {
  const places = new Map<string, Placed>();
  const walk = (list: readonly TreeNode[], parentId: string | undefined): void => {
    list.forEach((node, at) => {
      places.set(node.id, { node, parentId, at });
      walk(node.children ?? [], node.id);
    });
  };
  walk(nodes, undefined);
  return places;
};

// The places in `values` of one of its longest increasing subsequences, by patience sorting, as
// the contract's diff picks them, so that a mark and a `move` fall on the same node.
const longestIncreasing = (values: readonly number[]): Set<number> => {
  const tails: number[] = [];
  const previous: number[] = [];
  values.forEach((value, at) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((values[tails[middle] as number] as number) < value) low = middle + 1;
      else high = middle;
    }
    previous[at] = tails[low - 1] ?? -1;
    tails[low] = at;
  });
  const kept = new Set<number>();
  for (let at = tails.at(-1) ?? -1; at !== -1; at = previous[at] ?? -1) kept.add(at);
  return kept;
};

// The kept nodes that did not move: in each edited sibling list, those that keep their parent and
// form a longest subsequence in their sent order.
const stayers = (sent: Map<string, Placed>, edited: Map<string, Placed>): Set<string> => {
  const lists = new Map<string | undefined, string[]>();
  for (const [id, { parentId }] of edited) {
    const was = sent.get(id);
    if (was === undefined || was.parentId !== parentId) continue;
    lists.set(parentId, [...(lists.get(parentId) ?? []), id]);
  }
  const stay = new Set<string>();
  for (const ids of lists.values()) {
    const kept = longestIncreasing(ids.map((id) => sent.get(id)?.at ?? 0));
    ids.forEach((id, at) => {
      if (kept.has(at)) stay.add(id);
    });
  }
  return stay;
};

const fieldsOf = (node: TreeNode): string[] =>
  Object.keys(node).filter((key) => !NODE_KEYS.has(key));

// The fields whose value differs, a field one of them lacks included, in code-unit order.
const changedFields = (was: TreeNode, node: TreeNode): readonly string[] =>
  Object.freeze(
    [...new Set([...fieldsOf(was), ...fieldsOf(node)])]
      .sort()
      .filter((field) => was[field] !== node[field]),
  );

/** The mark of a node the user added. */
export const ADDED: NodeMark = Object.freeze({
  added: true,
  moved: false,
  renamed: false,
  fields: [],
});

// A kept node's mark, or `undefined` when nothing about it changed.
const keptMark = (was: TreeNode, node: TreeNode, moved: boolean): NodeMark | undefined => {
  const renamed = was.label !== node.label;
  const fields = changedFields(was, node);
  if (!moved && !renamed && fields.length === 0) return undefined;
  return Object.freeze({ added: false, moved, renamed, fields });
};

/** What the user changed in `edited` against `sent`, per node, and how many nodes it touches. */
export const marksOf = (sent: TreeProps, edited: TreeProps): TreeMarks => {
  const before = placesOf(sent.nodes);
  const after = placesOf(edited.nodes);
  const stay = stayers(before, after);
  const byNode = new Map<string, NodeMark>();
  for (const [id, { node }] of after) {
    const was = before.get(id);
    const mark = was === undefined ? ADDED : keptMark(was.node, node, !stay.has(id));
    if (mark !== undefined) byNode.set(id, mark);
  }
  const removed = [...before.keys()].filter((id) => !after.has(id)).length;
  return Object.freeze({ byNode, count: byNode.size + removed });
};

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Deep equality of JSON values: arrays by element, objects by key, whatever the keys' order.
const sameJson = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, at) => sameJson(x, b[at]));
  }
  if (!isObject(a) || !isObject(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
  );
};

/**
 * Whether two values hold the same nodes, whatever the order of their keys: when the edits come
 * back to the agent's value, the component puts `undefined` in the draft. The edits never change
 * the columns, so only the nodes are compared.
 */
export const sameNodes = (a: TreeProps, b: TreeProps): boolean => sameJson(a.nodes, b.nodes);
