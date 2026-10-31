// The values a graph carries and how a node in error reads, for every caller of `compute`.

import type { FormulaErrorKind } from "@askboard/contract";

/** A node's address: a reference without its brackets, `item.field`, `item.child.field` or `item.A1`. */
export type Address = string;

/** Dates travel as RFC 3339 `full-date` strings and money as decimal strings (AD-7); empty is null. */
export type Scalar = number | string | boolean | null;

export type ValueType = "number" | "money" | "date" | "boolean" | "text";

export const VALUE_TYPES: readonly ValueType[] = Object.freeze([
  "number",
  "money",
  "date",
  "boolean",
  "text",
]);

/** A node in error: the kind, the node where the error arose and why. */
export type FormulaError = {
  readonly error: FormulaErrorKind;
  readonly address: Address;
  readonly detail?: string;
};

export type NodeResult = Scalar | FormulaError;

export const isFormulaError = (result: NodeResult): result is FormulaError =>
  typeof result === "object" && result !== null;
