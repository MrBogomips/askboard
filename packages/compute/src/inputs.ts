// An input value in the engine's terms, or why it does not fit its node's type: a date becomes a
// serial, money a number. Values are read whatever the locale: money is a plain decimal string.

import { serialOf } from "./dates.ts";
import type { Scalar, ValueType } from "./types.ts";

export type Converted =
  | { readonly value: number | string | boolean | null }
  | { readonly reason: string };

const DECIMAL = /^-?\d+(\.\d+)?$/;
const FIRST_DATE = "1900-03-01";
const LAST_DATE = "9999-12-31";

const describe = (value: unknown): string => {
  if (typeof value === "string") return "text";
  if (typeof value === "boolean") return "a boolean";
  if (typeof value === "number") return Number.isFinite(value) ? "a number" : String(value);
  return Array.isArray(value) ? "a list" : "an object";
};

const date = (value: unknown): Converted => {
  if (typeof value !== "string") return { reason: `a full-date, not ${describe(value)}` };
  const serial = serialOf(value);
  if (serial === undefined) {
    return { reason: `${JSON.stringify(value)} is not a date from ${FIRST_DATE} to ${LAST_DATE}` };
  }
  return { value: serial };
};

const money = (value: unknown): Converted => {
  if (typeof value === "string" && DECIMAL.test(value)) return { value: Number(value) };
  const given = typeof value === "string" ? JSON.stringify(value) : describe(value);
  return { reason: `money is a decimal string, not ${given}` };
};

export const convertInput = (type: ValueType, value: Scalar | undefined): Converted => {
  if (value === null || value === undefined) return { value: null };
  switch (type) {
    case "date":
      return date(value);
    case "money":
      return money(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? { value }
        : { reason: `a number, not ${describe(value)}` };
    case "text":
      return typeof value === "string" ? { value } : { reason: `text, not ${describe(value)}` };
    case "boolean":
      return typeof value === "boolean"
        ? { value }
        : { reason: `a boolean, not ${describe(value)}` };
  }
};
