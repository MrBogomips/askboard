// Moving a node (spec, "Tree moving nodes"; proposal, open question 13): up and down swap it with
// its neighbouring sibling, indent makes it the last child of its previous sibling, outdent places
// it right after its parent; each carries the node's branch. The focus follows the node, in the
// same cell, and its new ancestors open, so that it shows: an indent opens the new parent.

import type { TreeProps } from "@askboard/contract";
import { applyDrop, type Drop } from "./model/drop.ts";
import { indent, moveDown, moveUp, outdent, type TreeEdit } from "./model/edits.ts";
import { focusOn, type TreeView } from "./model/focus.ts";

/** The edits that move a node. */
export type MoveEdit = Extract<TreeEdit, "moveUp" | "moveDown" | "indent" | "outdent">;

const MOVES: Readonly<Record<MoveEdit, (value: TreeProps, nodeId: string) => TreeProps>> =
  Object.freeze({ moveUp, moveDown, indent, outdent });

export const isMove = (edit: TreeEdit): edit is MoveEdit => Object.hasOwn(MOVES, edit);

type Moved = { readonly value: TreeProps; readonly view: TreeView };

// The result of putting `nodeId` where `next` holds it: the focus on it, in the same cell, its new
// ancestors open; the same view when nothing moved.
const landed = (value: TreeProps, view: TreeView, nodeId: string, next: TreeProps): Moved => {
  const cell = view.focus?.nodeId === nodeId ? view.focus.cell : undefined;
  return Object.freeze({
    value: next,
    view: next === value ? view : focusOn(view, next, nodeId, cell),
  });
};

/**
 * The value with `nodeId` moved by `edit`, and the view with the focus on it; the same value and
 * view when the move is not possible.
 */
export const afterMove = (
  edit: MoveEdit,
  value: TreeProps,
  view: TreeView,
  nodeId: string,
): Moved => landed(value, view, nodeId, MOVES[edit](value, nodeId));

/**
 * As `afterMove`, for a drop: the same value and view for a refused drop and one that moves
 * nothing, and an "into" drop opens the target, so that the node shows.
 */
export const afterDrop = (drop: Drop, value: TreeProps, view: TreeView, nodeId: string): Moved =>
  landed(value, view, nodeId, applyDrop(value, nodeId, drop));
