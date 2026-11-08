// The PickField's constants and types (form-widget, design decision 4): the bounds of its options,
// the schemas' IDs and the shapes of an item and its result.

/** A PickField holds at least this many options. */
export const PICK_FIELD_MIN_OPTIONS = 2;
/** A PickField holds at most this many options, and a multiple pick at most as many IDs. */
export const PICK_FIELD_MAX_OPTIONS = 50;
/** Above this many options the board shows a filter field over the list. */
export const PICK_FILTER_OVER = 10;

export const PICK_FIELD_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:pick-field-props",
  result: "urn:askboard:output:pick-field-result",
} as const);

export type PickOption = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
};

export type PickFieldProps = {
  readonly label: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly options: readonly PickOption[];
  /** A multiple pick: checkboxes, and a list of IDs for the result. */
  readonly multiple?: boolean;
  /** Only with `multiple`: 1 to `maxItems`. */
  readonly minItems?: number;
  /** Only with `multiple`: at most the number of options. */
  readonly maxItems?: number;
};

export type PickFieldItem = {
  readonly type: "pick-field";
  readonly id: string;
  readonly props: PickFieldProps;
};

/** A single pick's result: an option ID; a multiple pick's: its distinct option IDs in the options' order. */
export type PickFieldResult = string | readonly string[];
