// The Row's constants and types (layouts, design decision 1): the limits of its items and weights,
// the schema's ID and the shape of an item.

import type { LayoutChild } from "../shared/layouts.ts";

export const ROW_MIN_ITEMS = 2;
export const ROW_MAX_ITEMS = 4;
/** A weight is a whole number from 1 to this. */
export const ROW_MIN_WEIGHT = 1;
export const ROW_MAX_WEIGHT = 4;

export const ROW_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:row-props",
} as const);

export type RowProps = {
  readonly items: readonly LayoutChild[];
  /** Relative widths, weights keyed by the ID of one of the items; 1 for an item with none. */
  readonly widths?: Readonly<Record<string, number>>;
};

export type RowItem = {
  readonly type: "row";
  readonly id: string;
  readonly props: RowProps;
};
