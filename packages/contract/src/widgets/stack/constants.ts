// The Stack's constants and types (layouts, design decision 1): the limit of its items, the schema's
// ID and the shape of an item. Each frozen constant is marked pure, so that a view chunk drops
// those it does not use.

import type { LayoutChild } from "../shared/layouts.ts";

export const STACK_MIN_ITEMS = 1;

export const STACK_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:stack-props",
} as const);

export type StackProps = { readonly items: readonly LayoutChild[] };

export type StackItem = {
  readonly type: "stack";
  readonly id: string;
  readonly props: StackProps;
};
