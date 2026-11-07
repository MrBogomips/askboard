// The TextField's constants and types (atoms, design decision 1): the limit of its text, the
// schemas' IDs and the shapes of an item and its result. Each frozen constant is marked pure, so
// that a view chunk drops those it does not use.

/** A TextField's `maxLength`, from 1 to this, and its text when `maxLength` is absent. */
export const TEXT_FIELD_MAX_CHARS = 10_000;

export const TEXT_FIELD_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:text-field-props",
  result: "urn:askboard:output:text-field-result",
} as const);

export type TextFieldProps = {
  readonly label: string;
  readonly description?: string;
  /** Line breaks are part of the text; false when absent. */
  readonly multiline?: boolean;
  /** In code points; `TEXT_FIELD_MAX_CHARS` when absent. */
  readonly maxLength?: number;
};

export type TextFieldItem = {
  readonly type: "text-field";
  readonly id: string;
  readonly props: TextFieldProps;
};

/** A TextField's result: the text, 1 to `maxLength` code points. */
export type TextFieldResult = string;
