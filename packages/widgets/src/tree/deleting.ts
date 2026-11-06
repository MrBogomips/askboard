// Deleting a node (spec, "Tree deleting nodes"; proposal, open question 11): the node goes with its
// branch. A node with children, or one on whose branch tasks of a linked plan depend (molecules,
// view spec, "Deleting a package with dependents"), goes only once the user confirms an inline
// question that says how many nodes go with it and how many tasks depend on it; another leaf goes
// at once. A focus in the branch moves to the node's next
// sibling, else the previous one, else the parent, worked out on the value that still holds it.

import type { TreeNode, TreeProps } from "@askboard/contract";
import type { Say } from "@askboard/view/catalog";
import { remove, removedCount } from "./model/edits.ts";
import { focusAfterRemove, type TreeView } from "./model/focus.ts";

/**
 * What the question before deleting a node says: the node's name, how many nodes are under it, and
 * how many tasks of the plans over the Tree depend on its branch; and, once the confirmed delete was
 * refused, the field error naming the plan's limit (`linked.ts`).
 */
export type DeleteQuestion = {
  readonly label: string;
  readonly under: number;
  readonly dependents: number;
  readonly refusal?: string;
};

/** How many tasks of the plans over the Tree depend on the packages `ids`, none outside them. */
export type CountDependents = (ids: readonly string[]) => number;

const NO_DEPENDENTS: CountDependents = () => 0;

const nodeIn = (nodes: readonly TreeNode[], id: string): TreeNode | undefined => {
  for (const node of nodes) {
    const found = node.id === id ? node : nodeIn(node.children ?? [], id);
    if (found !== undefined) return found;
  }
  return undefined;
};

const idsIn = (node: TreeNode): string[] => [
  node.id,
  ...(node.children ?? []).flatMap((child) => idsIn(child)),
];

/** The IDs of `nodeId`'s branch, its own first; none for a node gone. */
export const branchIdsOf = (value: TreeProps, nodeId: string): readonly string[] => {
  const node = nodeIn(value.nodes, nodeId);
  return Object.freeze(node === undefined ? [] : idsIn(node));
};

/**
 * The question deleting `nodeId` asks first, from the value as it is; `undefined` for a node gone,
 * and for a leaf no task depends on unless `always`, as once its delete was refused.
 */
export const deleteQuestionOf = (
  value: TreeProps,
  nodeId: string,
  countDependents: CountDependents = NO_DEPENDENTS,
  always = false,
): DeleteQuestion | undefined => {
  const label = nodeIn(value.nodes, nodeId)?.label;
  if (label === undefined) return undefined;
  const under = removedCount(value, nodeId) - 1;
  const dependents = countDependents(branchIdsOf(value, nodeId));
  return under < 1 && dependents < 1 && !always
    ? undefined
    : Object.freeze({ label, under, dependents });
};

// How many tasks depend on the node, or on its branch: the design's provisional wording
// (molecules, design decision 14).
const dependedOn = (dependents: number, under: number, text: Say): string => {
  if (dependents < 1) return "";
  const key = under < 1 ? "tree.delete.dependsOnIt" : "tree.delete.dependsOnThem";
  return ` ${text(key, { count: dependents })}`;
};

/**
 * The question's words after the node's name, for the `under` nodes of its branch and the
 * `dependents` tasks of the plans over the Tree, in the ask's language through `text`. The wording
 * is not recorded in EXPERIENCE.md.
 */
export const deletedWith = (under: number, dependents: number, text: Say): string => {
  const deleted =
    under < 1 ? text("tree.delete.alone") : text("tree.delete.under", { count: under });
  return `${deleted}${dependedOn(dependents, under, text)}`;
};

/**
 * The value without `nodeId` and its branch, and the view with the focus moved off it when the
 * focus is in the branch; a focus elsewhere, as when the question was answered after the user
 * moved on, stays where it is.
 */
export const afterDelete = (
  value: TreeProps,
  view: TreeView,
  nodeId: string,
): { readonly value: TreeProps; readonly view: TreeView } => {
  const node = nodeIn(value.nodes, nodeId);
  const focus = view.focus?.nodeId;
  const moved = focusAfterRemove(view, value, nodeId);
  const stays = node !== undefined && focus !== undefined && !idsIn(node).includes(focus);
  return Object.freeze({
    value: remove(value, nodeId),
    view: stays ? Object.freeze({ ...moved, focus: view.focus }) : moved,
  });
};
