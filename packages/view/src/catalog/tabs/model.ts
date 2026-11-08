// The Tabs layout's reading of its props and of the entries (layouts, design decision 7): plain
// functions, tested without a DOM.

import { nestedItemsOf } from "@askboard/contract";
import { isRecord, itemsIn } from "../layouts/layout.ts";
import type { BoardWidgetItem } from "../port.ts";

export type Tab = {
  readonly id: string;
  readonly title: string;
  readonly items: readonly BoardWidgetItem[];
};

// The tabs of the item's props, each with its ID, title and items; an error naming the Tabs when the
// props hold none, so the item fails (AD-10).
export const tabsOf = (itemId: string, props: unknown): readonly Tab[] => {
  const list = isRecord(props) && Object.hasOwn(props, "tabs") ? props.tabs : undefined;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`the Tabs layout "${itemId}" holds no tabs`);
  }
  return list.map((tab: unknown): Tab => {
    const own = (key: string): unknown =>
      isRecord(tab) && Object.hasOwn(tab, key) ? tab[key] : undefined;
    const { id, title } = { id: own("id"), title: own("title") };
    if (typeof id !== "string" || typeof title !== "string") {
      throw new Error(`the Tabs layout "${itemId}" holds a tab with no ID or title`);
    }
    return { id, title, items: itemsIn("Tabs layout", itemId, own("items")) };
  });
};

// Whether the tab's items hold, at any depth, a field with an entry.
export const needsCorrection = (tab: Tab, entries: ReadonlySet<string> | undefined): boolean =>
  entries !== undefined &&
  entries.size > 0 &&
  nestedItemsOf(tab.items).some(({ item }) => entries.has((item as { id: string }).id));
