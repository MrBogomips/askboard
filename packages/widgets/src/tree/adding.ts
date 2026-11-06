// A node the user adds (spec, "Tree adding nodes"; proposal, open question 12): "Add node" puts it
// right after the current node and "Add child" as the current node's last child, which expands.
// It starts with its name being entered and is in no value until a name is committed: the Tree
// shows it from `withPending`, under a name that is never shown and never sent, and the draft
// stays as it was. An empty name, Escape or leaving the name empty takes it away again, so no
// default label is ever sent as the user's (AD-10).

import { type Locale, TREE_LABEL_MAX_CHARS, type TreeProps } from "@askboard/contract";
import { type CellEntry, nameTooLong } from "./entry.ts";
import { addAfter, addChild, can, nextNodeId, type TreeEdit } from "./model/edits.ts";
import { focusOn, type TreeFocus, type TreeView } from "./model/focus.ts";

/** The tools that add a node. */
export type AddEdit = Extract<TreeEdit, "addAfter" | "addChild">;

/** An add whose node's name is being entered: the tool, and the focus it started from. */
export type PendingAdd = {
  readonly edit: AddEdit;
  /** The current node and cell when the add started; `undefined` in an empty Tree. */
  readonly anchor: TreeFocus | undefined;
};

/** The pending node's name while it shows: never shown, since its editor opens empty, and never sent. */
export const PENDING_NAME = "new node";

// A length in code points, as the contract counts it.
const lengthOf = (text: string): number => [...text].length;

const added = (value: TreeProps, add: PendingAdd, label: string): TreeProps =>
  add.edit === "addAfter"
    ? addAfter(value, add.anchor?.nodeId, label)
    : add.anchor === undefined
      ? value
      : addChild(value, add.anchor.nodeId, label);

/** The add `edit` from the focus `anchor`, or `undefined` when it is not possible there. */
export const pendingAdd = (
  edit: AddEdit,
  value: TreeProps,
  anchor: TreeFocus | undefined,
): PendingAdd | undefined =>
  can(edit, value, anchor?.nodeId) ? Object.freeze({ edit, anchor }) : undefined;

/** The value the Tree shows: `value` with the pending add's node, if any. */
export const withPending = (value: TreeProps, add: PendingAdd | undefined): TreeProps =>
  add === undefined ? value : added(value, add, PENDING_NAME);

/**
 * Commits `text` as the new node's name: the value with the node, the same value for an empty
 * name, which takes the node away, or the refusal of a name past the contract's limit.
 */
export const enterNewName = (
  value: TreeProps,
  add: PendingAdd,
  text: string,
  language: Locale = "en-US",
): CellEntry =>
  lengthOf(text) > TREE_LABEL_MAX_CHARS
    ? Object.freeze({ kind: "refused", reason: nameTooLong(language) })
    : Object.freeze({ kind: "value", value: added(value, add, text) });

/** The view while the name is entered: the focus on the new node's name, its parent expanded. */
export const viewOfAdd = (view: TreeView, value: TreeProps, add: PendingAdd): TreeView =>
  focusOn(view, withPending(value, add), nextNodeId(value), 0);

/**
 * The view once the new node is taken away: the focus back where the add started; in an empty
 * Tree the same view, whose focus on the gone node the component drops, as for any node gone.
 */
export const viewWithoutAdd = (view: TreeView, value: TreeProps, add: PendingAdd): TreeView =>
  add.anchor === undefined ? view : focusOn(view, value, add.anchor.nodeId, add.anchor.cell);
