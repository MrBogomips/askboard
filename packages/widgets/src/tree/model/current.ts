// The Tree's current row (widget-editing-plus design decision 10; spec, "Tree current row"): the
// one node the toolbar's move, indent, outdent, add and delete tools act on. It is set by a click
// or an arrow key and is `undefined` when a Tree opens, so that the tools have no target until the
// user chooses one; it is view state beside the focus and the selection, never in the draft, and
// it survives the focus leaving the treegrid.

import type { TreeProps } from "@askboard/contract";
import { can, type FieldEdit, type TreeEdit } from "./edits.ts";
import type { TreeFocus, TreeView } from "./focus.ts";
import { locate } from "./nodes.ts";

/** The current row's node ID, or `undefined` while no row is current. */
export type Current = string | undefined;

/** `current` while the value still holds the node, else no row is current. */
export const currentIn = (value: TreeProps, current: Current): Current =>
  current !== undefined && locate(value.nodes, current) !== undefined ? current : undefined;

/**
 * Whether `edit` is possible on the current row: as `can` says for it, and with no current row
 * only in an empty Tree, where "Add node" adds the first node.
 */
export const canAct = (edit: TreeEdit | FieldEdit, value: TreeProps, current: Current): boolean =>
  current === undefined && value.nodes.length > 0 ? false : can(edit, value, current);

/**
 * Where an add starts: the current row, in the cell the focus has on it, else on the row alone;
 * nowhere with no current row.
 */
export const anchorOf = (view: TreeView, current: Current): TreeFocus | undefined => {
  if (current === undefined) return undefined;
  const { focus } = view;
  return focus?.nodeId === current ? focus : { nodeId: current };
};
