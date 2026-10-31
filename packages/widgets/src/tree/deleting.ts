// Deleting a node (spec, "Tree deleting nodes"; proposal, open question 11): the node goes with its
// branch. A node with children goes only once the user confirms an inline question that says how
// many nodes go with it; a leaf goes at once. A focus in the branch moves to the node's next
// sibling, else the previous one, else the parent, worked out on the value that still holds it.

import type { TreeNode, TreeProps } from "@askboard/contract";
import { remove, removedCount } from "./model/edits.ts";
import { focusAfterRemove, type TreeView } from "./model/focus.ts";

/** What the question before deleting a node says: the node's name and how many nodes are under it. */
export type DeleteQuestion = { readonly label: string; readonly under: number };

const nodeIn = (nodes: readonly TreeNode[], id: string): TreeNode | undefined => {
  for (const node of nodes) {
    const found = node.id === id ? node : nodeIn(node.children ?? [], id);
    if (found !== undefined) return found;
  }
  return undefined;
};

/** The question deleting `nodeId` asks first, from the value as it is; `undefined` for a leaf or a node gone. */
export const deleteQuestionOf = (value: TreeProps, nodeId: string): DeleteQuestion | undefined => {
  const under = removedCount(value, nodeId) - 1;
  const label = nodeIn(value.nodes, nodeId)?.label;
  return under < 1 || label === undefined ? undefined : Object.freeze({ label, under });
};

/** The question's words after the node's name, for the `under` nodes of its branch. The wording is not recorded in EXPERIENCE.md. */
export const deletedWith = (under: number): string =>
  under === 1
    ? "and the node under it will be deleted."
    : `and the ${under} nodes under it will be deleted.`;

const idsIn = (node: TreeNode): string[] => [
  node.id,
  ...(node.children ?? []).flatMap((child) => idsIn(child)),
];

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
