// What a Tree cell shows (design decision 6): a number as AskBoard's own en-US formatter writes
// it, which its parser reads back, a text as it is, and an absent field as nothing. Agent text is
// returned as a string for React to render as text, never as markup (AD-8).

import type { TreeColumn, TreeNode } from "@askboard/contract";
import { formatNumber } from "../shared/number.ts";

/** The name column's header. The wording is not recorded in EXPERIENCE.md. */
export const NAME_COLUMN = "Name";

/** The text of the node's field in `column`: empty when the node has none. */
export const fieldText = (node: TreeNode, column: TreeColumn): string => {
  const value = Object.hasOwn(node, column.field) ? node[column.field] : undefined;
  if (typeof value === "number") return formatNumber(value);
  return typeof value === "string" ? value : "";
};
