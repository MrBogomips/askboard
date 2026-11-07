// The Text's constants and types (atoms, design decision 1): the limit of its text, its formats,
// the schema's ID and the shape of an item. Each frozen constant is marked pure, so that a view
// chunk drops those it does not use.

/** A Text's `text`, and a Markdown option preview, hold 1 to this many code points. */
export const TEXT_MAX_CHARS = 10_000;

export const TEXT_FORMATS = /* @__PURE__ */ Object.freeze(["plain", "markdown"] as const);

export const TEXT_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:text-props",
} as const);

export type TextProps = {
  readonly text: string;
  /** `plain` when absent. */
  readonly format?: (typeof TEXT_FORMATS)[number];
};

export type TextItem = {
  readonly type: "text";
  readonly id: string;
  readonly props: TextProps;
};
