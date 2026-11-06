// What a Tree cell shows (design decision 6): a number as AskBoard's own en-US formatter writes
// it, which its parser reads back, a text as it is, and an absent field as nothing. Agent text is
// returned as a string for React to render as text, never as markup (AD-8). A work breakdown, a
// Tree with `pert`, names its name column "Work package", shows a leaf's estimates with the `d`
// affix and a parent's, which PERT ignores, as nothing, and adds two value columns (molecules
// design decision 14; EXPERIENCE, Copy: the labels are provisional).

import {
  GANTT_PLAN_ESTIMATES,
  type Locale,
  type TreeColumn,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import type { Say } from "@askboard/view/catalog";
import { formatNumber } from "../shared/number.ts";
import { isPert } from "./model/nodes.ts";

/**
 * The two value columns' headers from the catalogue: a label short enough for one line, and the
 * column's full name as its tip (review F-22).
 */
export const PERT_HEADERS = [
  { label: "tree.expected", tip: "tree.expectedEffort" },
  { label: "tree.spread", tip: "tree.spread" },
] as const;

const ESTIMATES: ReadonlySet<string> = new Set(GANTT_PLAN_ESTIMATES);

/** The unit affix of a work breakdown's estimates and values: working days. */
const DAYS = "d";

/** The name column's header for `value`: "Work package" for a work breakdown, else "Name". */
export const nameColumnOf = (value: TreeProps, text: Say): string =>
  text(isPert(value) ? "tree.wbsNameColumn" : "tree.nameColumn");

/** The text of the node's field in `column`, in the ask's locale: empty when the node has none. */
export const fieldText = (node: TreeNode, column: TreeColumn, locale: Locale = "en-US"): string => {
  const value = Object.hasOwn(node, column.field) ? node[column.field] : undefined;
  if (typeof value === "number") return formatNumber(value, locale);
  return typeof value === "string" ? value : "";
};

/**
 * The text of a work breakdown's field: an estimate with the `d` affix where the row has estimate
 * cells, a leaf's, and nothing where it has none; any other field as `fieldText` gives it.
 */
export const pertFieldText = (
  node: TreeNode,
  column: TreeColumn,
  estimates: boolean,
  locale: Locale = "en-US",
): string => {
  if (!ESTIMATES.has(column.field)) return fieldText(node, column, locale);
  const text = estimates ? fieldText(node, column, locale) : "";
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
