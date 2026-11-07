// The Tabs layout's constants and types (layouts, design decision 1): the limits of its tabs, the
// schema's ID and the shape of an item. Lengths count code points.

import type { LayoutChild } from "../shared/layouts.ts";

export const TABS_MIN_TABS = 2;
export const TABS_MAX_TABS = 8;
export const TABS_TITLE_MAX_CHARS = 80;

export const TABS_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:tabs-props",
} as const);

/** One tab: its ID, unique in the Tabs, its title and the items its panel holds. */
export type Tab = {
  readonly id: string;
  readonly title: string;
  readonly items: readonly LayoutChild[];
};

export type TabsProps = { readonly tabs: readonly Tab[] };

export type TabsItem = {
  readonly type: "tabs";
  readonly id: string;
  readonly props: TabsProps;
};
