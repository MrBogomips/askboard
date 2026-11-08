// The Toggle's constants and types (atoms, design decision 1): the schemas' IDs and the shapes of
// an item and its result.

export const TOGGLE_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:toggle-props",
  result: "urn:askboard:output:toggle-result",
} as const);

export type ToggleProps = {
  readonly label: string;
  readonly description?: string;
  /** The user must give a value before "Answer" (form-widget): the field's check fails while it has none. */
  readonly required?: boolean;
};

export type ToggleItem = {
  readonly type: "toggle";
  readonly id: string;
  readonly props: ToggleProps;
};

/** A Toggle's result: on or off; an untouched Toggle gives none. */
export type ToggleResult = boolean;
