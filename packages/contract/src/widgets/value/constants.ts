// The Value's constants and types (atoms, design decision 1): the kinds, the fields each kind
// holds, the limits, the schema's ID and the shape of an item. Each frozen constant is marked
// pure, so that a view chunk drops those it does not use.

/** A Value's `days`, a whole number from 0 to this. */
export const VALUE_MAX_DAYS = 100_000;

export const VALUE_KINDS = /* @__PURE__ */ Object.freeze([
  "number",
  "percent",
  "money",
  "date",
  "duration",
] as const);

export type ValueKind = (typeof VALUE_KINDS)[number];

/** Every field a Value's props may hold beside `kind` and `label`. */
export const VALUE_FIELDS = /* @__PURE__ */ Object.freeze([
  "value",
  "unit",
  "amount",
  "currency",
  "date",
  "days",
] as const);

/** The fields each kind requires and may hold, in order; any other field is refused. */
export const VALUE_KIND_FIELDS: Readonly<Record<ValueKind, readonly string[]>> =
  /* @__PURE__ */ Object.freeze({
    number: Object.freeze(["value", "unit"]),
    percent: Object.freeze(["value"]),
    money: Object.freeze(["amount", "currency"]),
    date: Object.freeze(["date"]),
    duration: Object.freeze(["days"]),
  });

/** The fields each kind requires: all of its fields but an optional `unit`. */
export const VALUE_REQUIRED_FIELDS: Readonly<Record<ValueKind, readonly string[]>> =
  /* @__PURE__ */ Object.freeze({
    number: Object.freeze(["value"]),
    percent: Object.freeze(["value"]),
    money: Object.freeze(["amount", "currency"]),
    date: Object.freeze(["date"]),
    duration: Object.freeze(["days"]),
  });

export const VALUE_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:value-props",
} as const);

export type ValueProps =
  | {
      readonly label?: string;
      readonly kind: "number";
      readonly value: number;
      readonly unit?: string;
    }
  | { readonly label?: string; readonly kind: "percent"; readonly value: number }
  | {
      readonly label?: string;
      readonly kind: "money";
      readonly amount: string;
      readonly currency: string;
    }
  | { readonly label?: string; readonly kind: "date"; readonly date: string }
  | { readonly label?: string; readonly kind: "duration"; readonly days: number };

export type ValueItem = {
  readonly type: "value";
  readonly id: string;
  readonly props: ValueProps;
};
