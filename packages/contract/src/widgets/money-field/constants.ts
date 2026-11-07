// The MoneyField's constants and types (atoms, design decisions 1 and 2): the number of currencies
// a field offers, the schemas' IDs and the shapes of an item and its result. Each frozen constant is
// marked pure, so that a view chunk drops those it does not use.

/** A MoneyField's `currencies` hold at least this many codes. */
export const MONEY_FIELD_MIN_CURRENCIES = 2;
/** A MoneyField's `currencies` hold at most this many codes. */
export const MONEY_FIELD_MAX_CURRENCIES = 10;

export const MONEY_FIELD_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:money-field-props",
  result: "urn:askboard:output:money-field-result",
} as const);

/** Exactly one of `currency` and `currencies`; `min` and `max` are decimal strings. */
export type MoneyFieldProps = {
  readonly label: string;
  readonly description?: string;
  /** The one currency, an ISO 4217 code. */
  readonly currency?: string;
  /** The currencies the user picks from, 2 to 10 unique codes. */
  readonly currencies?: readonly string[];
  readonly min?: string;
  readonly max?: string;
};

export type MoneyFieldItem = {
  readonly type: "money-field";
  readonly id: string;
  readonly props: MoneyFieldProps;
};

/** A MoneyField's result: a decimal string and its currency, never a float. */
export type MoneyFieldResult = {
  readonly amount: string;
  readonly currency: string;
};
