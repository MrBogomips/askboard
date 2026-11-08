// How a request's wording reads a Tabs layout's props (layouts, design decision 1), keyed
// `tabs.props.tabs[].items[].type`, and which tab a path is in. Nothing here validates.

import { isRecord, type Segments } from "../../problems.ts";
import { LAYOUT_CHILD_FIELDS, LAYOUT_CHILD_ITEM, LAYOUT_CHILD_TYPE } from "../shared/layouts.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import { TABS_MAX_TABS, TABS_MIN_TABS, TABS_TITLE_MAX_CHARS } from "./constants.ts";

export const TABS_EXPECTED: Readonly<Record<string, string>> = {
  "tabs.props": "a Tabs layout's props {tabs}",
  "tabs.props.tabs": `a list of ${TABS_MIN_TABS} to ${TABS_MAX_TABS} tabs, each {id, title, items}`,
  "tabs.props.tabs[]": "a tab {id, title, items}",
  "tabs.props.tabs[].id": `${ID_SHAPE}, unique among the Tabs' tabs and not starting with "u-"`,
  "tabs.props.tabs[].title": text(TABS_TITLE_MAX_CHARS),
  "tabs.props.tabs[].items": "a non-empty list of the items the tab's panel holds",
  "tabs.props.tabs[].items[]": LAYOUT_CHILD_ITEM,
  "tabs.props.tabs[].items[].type": LAYOUT_CHILD_TYPE,
};

export const TABS_FIELDS: Readonly<Record<string, string>> = {
  "tabs.props": "a Tabs layout's props hold only tabs",
  "tabs.props.tabs[]": "a tab holds only id, title and items",
  "tabs.props.tabs[].items[]": LAYOUT_CHILD_FIELDS,
};

/** The tab a path from a Tabs item is in, by its ID, worded `tab "costs"`. */
export const tabsElementOf = (item: unknown, rest: Segments): string | undefined => {
  if (!isRecord(item) || rest[1] !== "tabs" || !isIndex(rest[2])) return undefined;
  const props = Object.hasOwn(item, "props") ? item.props : undefined;
  const tabs = isRecord(props) && Array.isArray(props.tabs) ? props.tabs : undefined;
  const tab: unknown = tabs?.[Number(rest[2])];
  const id = isRecord(tab) ? tab.id : undefined;
  return typeof id === "string" ? `tab "${id}"` : undefined;
};
