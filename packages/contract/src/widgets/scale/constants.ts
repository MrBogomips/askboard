// The Scale's constants and types (approval-scale-ranking, design decision 1): the limits of its
// props, the schemas' IDs and the shapes of an item and its result. Each frozen constant is marked
// pure, so that a view chunk drops those it does not use.

/** A scale's `min` and `max` lie within this many either way. */
export const SCALE_BOUND = 1_000_000_000;
/** A scale divides into at most this many steps. */
export const SCALE_MAX_STEPS = 1000;
/** A rating shows at most this many values, one toggle each. */
export const SCALE_RATING_MAX_VALUES = 11;
export const SCALE_LABEL_MAX_CHARS = 60;
export const SCALE_UNIT_MAX_CHARS = 20;
/** The step when the props give none. */
export const SCALE_DEFAULT_STEP = 1;
/** A value is on a step, and a scale divides into whole steps, within this fraction of a step. */
export const SCALE_STEP_TOLERANCE = 1e-9;

export const SCALE_DISPLAYS = /* @__PURE__ */ Object.freeze(["slider", "rating"] as const);

export const SCALE_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:scale-props",
  result: "urn:askboard:output:scale-result",
} as const);

export type ScaleProps = {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly range?: boolean;
  readonly display?: (typeof SCALE_DISPLAYS)[number];
  readonly minLabel?: string;
  readonly maxLabel?: string;
  readonly unit?: string;
};

export type ScaleItem = {
  readonly type: "scale";
  readonly id: string;
  readonly props: ScaleProps;
};

/** A Scale's result: `value`, or `low` and `high` when its props have `range`. */
export type ScaleResult =
  | { readonly value: number }
  | { readonly low: number; readonly high: number };
