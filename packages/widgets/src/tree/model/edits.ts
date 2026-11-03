// The Tree's edits (design decision 5): pure functions from a value to the next. Each returns a new
// value frozen at every level, or the same value when nothing changes, and never touches its
// input. An edit the contract would refuse changes nothing, so every value they return validates
// as an edited value: names of 1 to 200 characters, text fields of 1 to 1,000, finite numbers, a
// work breakdown's estimates from 0 to 100,000 working days, an emptied field or children list
// removed, at most 500 nodes and 8 levels. A work breakdown's parent, whose estimates PERT
// ignores, takes no estimate edit (molecules design decision 14). A node the user adds
// takes the next view-made ID (design decision 11). The edits never compute one value from
// another and never build `changes` (open question 3, AD-20).

import {
  GANTT_PLAN_ESTIMATES,
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  TREE_PERT_MAX_ESTIMATE,
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
  heightOf,
  isPert,
  type Located,
  locate,
  nodeIds,
  withChildren,
  withList,
  without,
} from "./nodes.ts";

/** The edits of the toolbar and the keys, each allowed or not by `can`. */
export type TreeEdit =
  | "addAfter"
  | "addChild"
  | "moveUp"
  | "moveDown"
  | "indent"
  | "outdent"
  | "remove";

/** A cell edit `can` also answers for: a work breakdown's estimate cells, which a parent has none of. */
export type FieldEdit = "editEstimate";

/** Why a work breakdown refuses an estimate: the contract's range of working days (F8). */
export const ESTIMATE_OUT_OF_RANGE = `An estimate is 0 to ${TREE_PERT_MAX_ESTIMATE.toLocaleString("en-US")} working days.`;

const ESTIMATES: ReadonlySet<string> = new Set(GANTT_PLAN_ESTIMATES);

/** A node's own keys; every other key is a field. */
const NODE_KEYS: ReadonlySet<string> = new Set(["id", "label", "children"]);

// A length in code points, as the contract counts it.
const lengthOf = (text: string): number => [...text].length;

const isName = (label: string): boolean => label !== "" && lengthOf(label) <= TREE_LABEL_MAX_CHARS;

const hasRoom = (value: TreeProps): boolean => countNodes(value.nodes) < TREE_MAX_NODES;

// Whether `edit` is possible on the node at `place`: the moving rules (proposal, open question 13)
// and the limits (open question 16). The one rule for `can` and for the edits themselves.
const possible = (edit: TreeEdit | FieldEdit, value: TreeProps, place: Located): boolean => {
  switch (edit) {
    case "addAfter":
      return hasRoom(value);
    case "addChild":
      return hasRoom(value) && place.level < TREE_MAX_DEPTH;
    case "moveUp":
      return place.index > 0;
    case "moveDown":
      return place.index < place.siblings.length - 1;
    case "indent":
      // The branch goes one level down: its deepest node lands at its level plus its height.
      return place.index > 0 && place.level + heightOf(place.node) <= TREE_MAX_DEPTH;
    case "outdent":
      return place.parentId !== undefined;
    case "remove":
      return true;
    case "editEstimate":
      return !isPert(value) || (place.node.children?.length ?? 0) === 0;
  }
};

// The place of the node `nodeId` when `edit` is possible on it.
const placeFor = (
  edit: TreeEdit | FieldEdit,
  value: TreeProps,
  nodeId: string,
): Located | undefined => {
  const place = locate(value.nodes, nodeId);
  return place !== undefined && possible(edit, value, place) ? place : undefined;
};

/**
 * Whether `edit` is possible on the node `nodeId`, for the toolbar's tools, the keys and a work
 * breakdown's estimate cells. With no current node, as in an empty Tree, only `addAfter` is, adding
 * a top-level node.
 */
export const can = (
  edit: TreeEdit | FieldEdit,
  value: TreeProps,
  nodeId: string | undefined,
): boolean =>
  nodeId === undefined
    ? edit === "addAfter" && hasRoom(value)
    : placeFor(edit, value, nodeId) !== undefined;

// `value` with the list holding the node at `place` replaced by `change` of that list.
const changed = (
  value: TreeProps,
  place: Located,
  change: (list: readonly TreeNode[]) => readonly TreeNode[],
): TreeProps => frozenWith(value, withList(value.nodes, place.parentId, change));

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
  if (!isName(label) || !can("addAfter", value, nodeId)) return value;
  const node: TreeNode = { id: nextNodeId(value), label };
  const place = nodeId === undefined ? undefined : locate(value.nodes, nodeId);
  if (place === undefined) return frozenWith(value, [...value.nodes, node]);
  return changed(value, place, (list) => list.toSpliced(place.index + 1, 0, node));
};

/**
 * Adds a node named `label` as the last child of the node `nodeId`. Nothing changes for an invalid
 * name, an unknown node, a node at the depth limit or a Tree at the node limit.
 */
export const addChild = (value: TreeProps, nodeId: string, label: string): TreeProps => {
  if (!isName(label) || !can("addChild", value, nodeId)) return value;
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
  return changed(value, place, (list) => list.with(place.index, { ...place.node, label }));
};

// Whether a column of `type` takes `input`: a finite number, or text within the limit.
const accepts = (type: TreeColumnType, input: TreeFieldValue): boolean =>
  type === "number"
    ? typeof input === "number" && Number.isFinite(input)
    : typeof input === "string" && lengthOf(input) <= TREE_TEXT_MAX_CHARS;

/**
 * Why a work breakdown refuses `input` as its estimate `field`: a number outside 0 to 100,000
 * working days. `undefined` when it takes it, as for an emptied estimate, another field or a Tree
 * without `pert`. `setField` refuses what this gives a reason for, and the cell editor shows it.
 */
export const estimateProblem = (
  value: TreeProps,
  field: string,
  input: TreeFieldValue | undefined,
): string | undefined =>
  isPert(value) &&
  ESTIMATES.has(field) &&
  typeof input === "number" &&
  !(input >= 0 && input <= TREE_PERT_MAX_ESTIMATE)
    ? ESTIMATE_OUT_OF_RANGE
    : undefined;

// Whether a work breakdown refuses `input` as the estimate `field` of the node at `place`: one
// `estimateProblem` gives a reason for, or any on a parent, whose estimate cells `can` refuses.
const refusedEstimate = (
  value: TreeProps,
  place: Located,
  field: string,
  input: TreeFieldValue | undefined,
): boolean =>
  isPert(value) &&
  ESTIMATES.has(field) &&
  (!possible("editEstimate", value, place) || estimateProblem(value, field, input) !== undefined);

/**
 * Sets the field `field` of the node `nodeId` to `input`, of its column's type; `undefined` or an
 * empty string empties it, removing the key. Nothing changes for a field no column declares, a
 * value of the wrong type or over the limit, the value it holds, or an unknown node; nor, in a
 * work breakdown, for an estimate `estimateProblem` refuses or a parent's estimate.
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
  if (refusedEstimate(value, place, field, input)) return value;
  const { node } = place;
  let next: TreeNode;
  if (input === undefined || input === "") {
    if (!Object.hasOwn(node, field)) return value;
    next = without(node, field);
  } else {
    if (!accepts(type, input) || node[field] === input) return value;
    next = { ...node, [field]: input };
  }
  return changed(value, place, (list) => list.with(place.index, next));
};

/** Removes the node `nodeId` with its branch; nothing changes for an unknown node. */
export const remove = (value: TreeProps, nodeId: string): TreeProps => {
  const place = placeFor("remove", value, nodeId);
  if (place === undefined) return value;
  return changed(value, place, (list) => list.toSpliced(place.index, 1));
};

/** How many nodes removing `nodeId` takes, itself included: 0 for an unknown node. */
export const removedCount = (value: TreeProps, nodeId: string): number => {
  const place = locate(value.nodes, nodeId);
  return place === undefined ? 0 : countNodes([place.node]);
};

// The node at `place` taken out of its list and put back at `index` of what remains.
const shifted = (value: TreeProps, place: Located, index: number): TreeProps =>
  changed(value, place, (list) => list.toSpliced(place.index, 1).toSpliced(index, 0, place.node));

/** Swaps the node `nodeId`, with its branch, with its previous sibling; refused on a first child. */
export const moveUp = (value: TreeProps, nodeId: string): TreeProps => {
  const place = placeFor("moveUp", value, nodeId);
  return place === undefined ? value : shifted(value, place, place.index - 1);
};

/** Swaps the node `nodeId`, with its branch, with its next sibling; refused on a last child. */
export const moveDown = (value: TreeProps, nodeId: string): TreeProps => {
  const place = placeFor("moveDown", value, nodeId);
  return place === undefined ? value : shifted(value, place, place.index + 1);
};

/**
 * Makes the node `nodeId`, with its branch, the last child of its previous sibling; refused on a
 * first child and when the branch would reach past the depth limit.
 */
export const indent = (value: TreeProps, nodeId: string): TreeProps => {
  const place = placeFor("indent", value, nodeId);
  const previous = place?.siblings[place.index - 1];
  if (place === undefined || previous === undefined) return value;
  const parent = withChildren(previous, [...(previous.children ?? []), place.node]);
  return changed(value, place, (list) => list.toSpliced(place.index - 1, 2, parent));
};

/**
 * Places the node `nodeId`, with its branch, right after its parent, its later siblings staying
 * under the parent; refused at the top level.
 */
export const outdent = (value: TreeProps, nodeId: string): TreeProps => {
  const place = placeFor("outdent", value, nodeId);
  const parent = place?.parentId === undefined ? undefined : locate(value.nodes, place.parentId);
  if (place === undefined || parent === undefined) return value;
  const left = withChildren(parent.node, place.siblings.toSpliced(place.index, 1));
  return changed(value, parent, (list) => list.toSpliced(parent.index, 1, left, place.node));
};
