// The Tree's edits (design decision 5): pure functions from a value to the next. Each returns a new
// value frozen at every level, or the same value when nothing changes, and never touches its
// input. An edit the contract would refuse changes nothing, so every value they return validates
// as an edited value: names of 1 to 200 characters, text fields of 1 to 1,000, finite numbers, an
// emptied field or children list removed, at most 500 nodes and 8 levels. A node the user adds
// takes the next view-made ID (design decision 11). The edits never compute one value from
// another and never build `changes` (open question 3, AD-20).

import {
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  TREE_TEXT_MAX_CHARS,
  type TreeColumnType,
  type TreeFieldValue,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { nextViewId } from "../../shared/ids.ts";
import {
  countNodes,
  frozenWith,
  type Located,
  locate,
  nodeIds,
  withList,
  without,
} from "./nodes.ts";

/** A node's own keys; every other key is a field. */
const NODE_KEYS: ReadonlySet<string> = new Set(["id", "label", "children"]);

// A length in code points, as the contract counts it.
const lengthOf = (text: string): number => [...text].length;

const isName = (label: string): boolean => label !== "" && lengthOf(label) <= TREE_LABEL_MAX_CHARS;

const hasRoom = (value: TreeProps): boolean => countNodes(value.nodes) < TREE_MAX_NODES;

// `value` with the node at `place` replaced by `node`.
const replaced = (value: TreeProps, place: Located, node: TreeNode): TreeProps =>
  frozenWith(
    value,
    withList(value.nodes, place.parentId, (list) => list.with(place.index, node)),
  );

/** The ID of the next node the user adds: `u-<n>`, one more than the highest in the value. */
export const nextNodeId = (value: TreeProps): string => nextViewId(nodeIds(value.nodes));

/**
 * Adds a node named `label` right after the node `nodeId`, under the same parent, or as the last
 * top-level node when there is no current node (an empty Tree). Nothing changes for an invalid
 * name, an unknown node or a Tree at the node limit.
 */
export const addAfter = (
  value: TreeProps,
  nodeId: string | undefined,
  label: string,
): TreeProps => {
  if (!isName(label) || !hasRoom(value)) return value;
  const node: TreeNode = { id: nextNodeId(value), label };
  if (nodeId === undefined) return frozenWith(value, [...value.nodes, node]);
  const place = locate(value.nodes, nodeId);
  if (place === undefined) return value;
  const insert = (list: readonly TreeNode[]) => list.toSpliced(place.index + 1, 0, node);
  return frozenWith(value, withList(value.nodes, place.parentId, insert));
};

/**
 * Adds a node named `label` as the last child of the node `nodeId`. Nothing changes for an invalid
 * name, an unknown node, a node at the depth limit or a Tree at the node limit.
 */
export const addChild = (value: TreeProps, nodeId: string, label: string): TreeProps => {
  const place = locate(value.nodes, nodeId);
  if (place === undefined || place.level >= TREE_MAX_DEPTH) return value;
  if (!isName(label) || !hasRoom(value)) return value;
  const node: TreeNode = { id: nextNodeId(value), label };
  return frozenWith(
    value,
    withList(value.nodes, nodeId, (list) => [...list, node]),
  );
};

/** Renames the node `nodeId`; nothing changes for an invalid name, the same name or an unknown node. */
export const rename = (value: TreeProps, nodeId: string, label: string): TreeProps => {
  const place = locate(value.nodes, nodeId);
  if (place === undefined || !isName(label) || place.node.label === label) return value;
  return replaced(value, place, { ...place.node, label });
};

// Whether a column of `type` takes `input`: a finite number, or text within the limit.
const accepts = (type: TreeColumnType, input: TreeFieldValue): boolean =>
  type === "number"
    ? typeof input === "number" && Number.isFinite(input)
    : typeof input === "string" && lengthOf(input) <= TREE_TEXT_MAX_CHARS;

/**
 * Sets the field `field` of the node `nodeId` to `input`, of its column's type; `undefined` or an
 * empty string empties it, removing the key. Nothing changes for a field no column declares, a
 * value of the wrong type or over the limit, the value it holds, or an unknown node.
 */
export const setField = (
  value: TreeProps,
  nodeId: string,
  field: string,
  input: TreeFieldValue | undefined,
): TreeProps => {
  const place = locate(value.nodes, nodeId);
  const type = value.columns?.find((column) => column.field === field)?.type;
  if (place === undefined || type === undefined || NODE_KEYS.has(field)) return value;
  const { node } = place;
  if (input === undefined || input === "") {
    return Object.hasOwn(node, field) ? replaced(value, place, without(node, field)) : value;
  }
  if (!accepts(type, input) || node[field] === input) return value;
  return replaced(value, place, { ...node, [field]: input });
};

/** Removes the node `nodeId` with its branch; nothing changes for an unknown node. */
export const remove = (value: TreeProps, nodeId: string): TreeProps => {
  const place = locate(value.nodes, nodeId);
  if (place === undefined) return value;
  const drop = (list: readonly TreeNode[]) => list.toSpliced(place.index, 1);
  return frozenWith(value, withList(value.nodes, place.parentId, drop));
};

/** How many nodes removing `nodeId` takes, itself included: 0 for an unknown node. */
export const removedCount = (value: TreeProps, nodeId: string): number => {
  const place = locate(value.nodes, nodeId);
  return place === undefined ? 0 : countNodes([place.node]);
};
