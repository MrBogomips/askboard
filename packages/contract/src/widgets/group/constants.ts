// The Group's constants and types (layouts, design decision 1): the limits of its title,
// description and items, the schema's ID and the shape of an item. Lengths count code points.

import type { LayoutChild } from "../shared/layouts.ts";

export const GROUP_TITLE_MAX_CHARS = 200;
export const GROUP_DESCRIPTION_MAX_CHARS = 1_000;
export const GROUP_MIN_ITEMS = 1;

export const GROUP_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:group-props",
} as const);

export type GroupProps = {
  readonly title: string;
  readonly description?: string;
  readonly items: readonly LayoutChild[];
};

export type GroupItem = {
  readonly type: "group";
  readonly id: string;
  readonly props: GroupProps;
};
