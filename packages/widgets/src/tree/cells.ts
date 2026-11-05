// What a Tree cell shows (design decision 6): a number as AskBoard's own en-US formatter writes
// it, which its parser reads back, a text as it is, and an absent field as nothing. Agent text is
// returned as a string for React to render as text, never as markup (AD-8). A work breakdown, a
// Tree with `pert`, names its name column "Work package", shows a leaf's estimates with the `d`
// affix and a parent's, which PERT ignores, as nothing, and adds two value columns (molecules
// design decision 14; EXPERIENCE, Copy: the labels are provisional).

import {
  GANTT_PLAN_ESTIMATES,
  type TreeColumn,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { formatNumber } from "../shared/number.ts";
import { isPert } from "./model/nodes.ts";

/** The name column's header. The wording is not recorded in EXPERIENCE.md. */
export const NAME_COLUMN = "Name";

/** A work breakdown's name column header (EXPERIENCE, Copy, WBS with PERT). */
export const WBS_NAME_COLUMN = "Work package";

/** A work breakdown's value columns, after the fields: each row's expected effort and spread. */
export const PERT_VALUE_COLUMNS = ["Expected effort", "Spread"] as const;

/** The name of a work breakdown's Total row, its item's roll-ups (provisional: design decision 14). */
export const TOTAL_ROW = "Total";

const ESTIMATES: ReadonlySet<string> = new Set(GANTT_PLAN_ESTIMATES);

/** The unit affix of a work breakdown's estimates and values: working days. */
const DAYS = "d";

/** The name column's header for `value`. */
export const nameColumnOf = (value: TreeProps): string =>
  isPert(value) ? WBS_NAME_COLUMN : NAME_COLUMN;

/** The text of the node's field in `column`: empty when the node has none. */
export const fieldText = (node: TreeNode, column: TreeColumn): string => {
  const value = Object.hasOwn(node, column.field) ? node[column.field] : undefined;
  if (typeof value === "number") return formatNumber(value);
  return typeof value === "string" ? value : "";
};

/**
 * The text of a work breakdown's field: an estimate with the `d` affix where the row has estimate
 * cells, a leaf's, and nothing where it has none; any other field as `fieldText` gives it.
 */
export const pertFieldText = (node: TreeNode, column: TreeColumn, estimates: boolean): string => {
  if (!ESTIMATES.has(column.field)) return fieldText(node, column);
  const text = estimates ? fieldText(node, column) : "";
  return text === "" ? "" : `${text} ${DAYS}`;
};

/**
 * The affix the editor of the cell `cell` keeps beside its input (DESIGN.md, Input atoms): `d` on a
 * work breakdown's estimate, none elsewhere.
 */
export const affixOf = (value: TreeProps, cell: number): string | undefined => {
  const field = cell === 0 ? undefined : value.columns?.[cell - 1]?.field;
  return isPert(value) && field !== undefined && ESTIMATES.has(field) ? DAYS : undefined;
};
