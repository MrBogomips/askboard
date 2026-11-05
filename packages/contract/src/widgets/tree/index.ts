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

/** The largest estimate of a Tree with `pert`, in working days; the smallest is 0 (F8). */
export const TREE_PERT_MAX_ESTIMATE = 100_000;

/**
 * The built-in derived fields of a Tree with `pert` (AD-13, FR-15), which compute writes as PERT
 * and its roll-ups: on every node, `<item>.<node>.expected` and `.spread`, and on the item,
 * `<item>.expected` and `<item>.spread`. A Tree without `pert` derives nothing.
 */
export const TREE_PERT_DERIVED = /* @__PURE__ */ Object.freeze({
  node: Object.freeze(["expected", "spread"] as const),
  item: Object.freeze(["expected", "spread"] as const),
});

/**
 * Which derived values a work breakdown's answer carries (F7): its `fields`, each rounded half
 * away from zero to `decimals`, the item's always (`itemTotals`), a node's only when its rounded
 * value differs from the board as sent or the agent did not send the node (`onlyChanged`); a value
 * in error never. The rounding is compute's `ROUND`.
 */
export const TREE_PERT_ANSWER_DERIVED = /* @__PURE__ */ Object.freeze({
  fields: TREE_PERT_DERIVED.node,
  decimals: 2,
  itemTotals: true,
  onlyChanged: true,
} as const);

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
 * A work breakdown's props (molecules design decision 8): a Tree's, with PERT over the three
 * estimate columns and the levels open at first, from 1 to `TREE_MAX_DEPTH`. A type of its own,
 * so that `TreeProps` keeps no field of a primitive type.
 */
export type TreePertProps = TreeProps & { readonly pert: true; readonly openDepth?: number };

/** The derived fields of a Tree: `TREE_PERT_DERIVED` with `pert`, none without it. */
export const treeDerivedFields = (
  props: TreeProps | TreePertProps,
): typeof TREE_PERT_DERIVED | undefined =>
  (props as { readonly pert?: unknown }).pert === true ? TREE_PERT_DERIVED : undefined;

/**
 * Who wrote a Tree's props: the agent, whose IDs may not start with the view's prefix `u-`, or the
 * view, whose edited value may hold the nodes the user added (design decision 11).
 */
export type TreeOrigin = "agent" | "edited";

/** A Tree item in a question. */
export type TreeItem = { readonly type: "tree"; readonly id: string; readonly props: TreeProps };
