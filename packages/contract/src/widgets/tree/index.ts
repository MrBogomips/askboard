// The Tree's item contract (FR-11, design decision 2): its types, limits and element shape. Its
// schemas are `tree-props.json` and `tree-changes.json`, standalone until the input format reaches
// 1.1; a Tree's changes are the output format's `Change`, with no alias. Plain ECMAScript with no
// JSON import, so that the Tree's chunk can bundle what it reads from here.

import type { ElementShape } from "../element-diff.ts";

/**
 * The Tree's element shape for the generic diff (AD-20, design decision 3): its nodes, each holding
 * its children under `children`. Every other key of a node but `id` is a field, `label` included.
 */
export const TREE_SHAPE = {
  elements: "nodes",
  children: "children",
} as const satisfies ElementShape;

/** At most this many nodes, so that an unvirtualised tree stays responsive (open question 16). */
export const TREE_MAX_NODES = 500;

/** At most this many levels: a top-level node is at level 1. */
export const TREE_MAX_DEPTH = 8;

/** At most this many columns. */
export const TREE_MAX_COLUMNS = 8;

/** The longest name of a node or a column; a name holds at least one character. */
export const TREE_LABEL_MAX_CHARS = 200;

/** The longest text field; a text field holds at least one character, and is absent when empty. */
export const TREE_TEXT_MAX_CHARS = 1_000;

/**
 * A column's field: one of AD-13's reference segments that compute reads as a field name, never as
 * a cell, since cells are upper case. `id`, `label` and `children` are a node's own keys, never a
 * field (open question 17).
 */
export const TREE_FIELD_PATTERN = "^[a-z][A-Za-z0-9]{0,63}$";

export type TreeColumnType = "text" | "number";

export type TreeColumn = {
  readonly field: string;
  readonly label: string;
  readonly type: TreeColumnType;
};

/** A field's value: a string in a text column, a number in a number column. */
export type TreeFieldValue = string | number;

export type TreeNode = {
  readonly id: string;
  /** The node's name, addressed as the field `label` (`item.node.label`). */
  readonly label: string;
  /** Absent on a leaf: a children list is never empty. */
  readonly children?: readonly TreeNode[];
  readonly [field: string]: TreeFieldValue | readonly TreeNode[] | undefined;
};

export type TreeProps = {
  readonly columns?: readonly TreeColumn[];
  readonly nodes: readonly TreeNode[];
};

/**
 * Who wrote a Tree's props: the agent, whose IDs may not start with the view's prefix `u-`, or the
 * view, whose edited value may hold the nodes the user added (design decision 11).
 */
export type TreeOrigin = "agent" | "edited";

/** A Tree item in a question. */
export type TreeItem = { readonly type: "tree"; readonly id: string; readonly props: TreeProps };
