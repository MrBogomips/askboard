// The view's one reader of the items a question holds at every depth of its layouts (layouts,
// design decision 6): the shell, the board page and `assemble` ask here, so that none of them
// walks a layout by hand. It is a thin view over the contract's walker, which knows which lists a
// layout holds; a Ranking's elements and an area's questions are never walked. Plain ECMAScript.

import { isLayoutType, nestedItemsOf } from "@askboard/contract";
import type { WidgetItem } from "./view-document.ts";

// Each items list's walk, made once: a board document is never changed in place, only replaced.
const WALKS = new WeakMap<readonly WidgetItem[], readonly WidgetItem[]>();
const NONE: readonly WidgetItem[] = Object.freeze([]);

/**
 * Every item of a question's `items` at every depth, depth first in document order, layouts
 * included; the same list for the same `items`.
 */
export const nestedWidgetItemsOf = (
  items: readonly WidgetItem[] | undefined,
): readonly WidgetItem[] => {
  if (items === undefined || items.length === 0) return NONE;
  const known = WALKS.get(items);
  if (known !== undefined) return known;
  const walked = Object.freeze(nestedItemsOf(items).map(({ item }) => item as WidgetItem));
  WALKS.set(items, walked);
  return walked;
};

/** The items that may hold a value, a result or an entry: every nested item but the layouts. */
export const valueItemsOf = (items: readonly WidgetItem[] | undefined): readonly WidgetItem[] =>
  nestedWidgetItemsOf(items).filter((item) => !isLayoutType(item.type));

/** The item `itemId` among a question's items at any depth, if it holds one. */
export const nestedItemById = (
  items: readonly WidgetItem[] | undefined,
  itemId: string,
): WidgetItem | undefined => nestedWidgetItemsOf(items).find((item) => item.id === itemId);
