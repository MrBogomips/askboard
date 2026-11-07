// The DateField's constants and types (atoms, design decision 1): the schemas' IDs and the shapes
// of an item and its result.

export const DATE_FIELD_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:date-field-props",
  result: "urn:askboard:output:date-field-result",
} as const);

export type DateFieldProps = {
  readonly label: string;
  readonly description?: string;
  /** The earliest day, an RFC 3339 full-date. */
  readonly min?: string;
  /** The latest day, not before `min`. */
  readonly max?: string;
};

export type DateFieldItem = {
  readonly type: "date-field";
  readonly id: string;
  readonly props: DateFieldProps;
};

/** A DateField's result: an RFC 3339 full-date. */
export type DateFieldResult = string;
