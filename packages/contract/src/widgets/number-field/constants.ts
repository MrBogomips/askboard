// The NumberField's constants and types (atoms, design decision 1): the limit of its step, the
// schemas' IDs and the shapes of an item and its result. Each frozen constant is marked pure, so
// that a view chunk drops those it does not use.

import { ATOM_NUMBER_BOUND } from "../shared/atoms.ts";

/** A NumberField's `step`, above 0, is at most this: the span of its bounds. */
export const NUMBER_FIELD_STEP_MAX = 2 * ATOM_NUMBER_BOUND;

export const NUMBER_FIELD_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:number-field-props",
  result: "urn:askboard:output:number-field-result",
} as const);

export type NumberFieldProps = {
  readonly label: string;
  readonly description?: string;
  readonly min?: number;
  readonly max?: number;
  /** Counted from `min`, else from 0. */
  readonly step?: number;
  readonly integer?: boolean;
  readonly unit?: string;
};

export type NumberFieldItem = {
  readonly type: "number-field";
  readonly id: string;
  readonly props: NumberFieldProps;
};

/** A NumberField's result: a JSON number. */
export type NumberFieldResult = number;
