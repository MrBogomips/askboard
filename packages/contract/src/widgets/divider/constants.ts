// The Divider's constants and types (atoms, design decision 1): the schema's ID and the shape of
// an item.

export const DIVIDER_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:divider-props",
} as const);

/** A Divider holds no field. */
export type DividerProps = Readonly<Record<string, never>>;

export type DividerItem = {
  readonly type: "divider";
  readonly id: string;
  readonly props: DividerProps;
};
