// Values inside the own evaluator and Excel's coercion rules. An error is a plain object;
// every other value is a primitive, and `null` is an empty cell.

import type { Address, FormulaErrorKind } from "../port.ts";

export interface ErrorValue {
  readonly kind: FormulaErrorKind;
  readonly origin: Address;
  readonly detail?: string;
}

export type Value = number | string | boolean | null | ErrorValue;

export function isError(v: Value): v is ErrorValue {
  return typeof v === "object" && v !== null;
}

export function err(kind: FormulaErrorKind, origin: Address, detail?: string): ErrorValue {
  return detail === undefined ? { kind, origin } : { kind, origin, detail };
}

/** Excel keeps 15 significant digits; comparisons and rounding work on that value. */
export function clean15(x: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(15));
}

/** Locale-independent: plain decimal text only (no grouping, no comma decimals). */
const NUMERIC_TEXT = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;

export function textToNumber(s: string): number | null {
  return NUMERIC_TEXT.test(s) ? Number(s) : null;
}

/** Arithmetic operand: booleans 1/0, empty 0, numeric text converted, other text #VALUE!. */
export function toNumber(v: Value, origin: Address): number | ErrorValue {
  if (typeof v === "number") return v;
  if (v === null) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = textToNumber(v);
    return n === null ? err("value", origin, `text "${v.slice(0, 32)}" is not a number`) : n;
  }
  return v;
}

/** Condition: numbers non-zero, empty FALSE, text TRUE/FALSE only. */
export function toBoolean(v: Value, origin: Address): boolean | ErrorValue {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  if (typeof v === "string") {
    const u = v.toUpperCase();
    if (u === "TRUE") return true;
    if (u === "FALSE") return false;
    return err("value", origin, "text is not a logical value");
  }
  return v;
}

/** A finite number, or #NUM! mapped to the port's `value`. */
export function finite(x: number, origin: Address): number | ErrorValue {
  if (Number.isNaN(x) || !Number.isFinite(x)) return err("value", origin, "result is not a finite number");
  return x === 0 ? 0 : x;
}

function typeRank(v: number | string | boolean): number {
  return typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2;
}

/** Excel's ordering: numbers < text < booleans; text case-insensitive; empty takes the other side's type. */
export function compare(a: number | string | boolean | null, b: number | string | boolean | null): number {
  const x = a === null ? emptyLike(b) : a;
  const y = b === null ? emptyLike(a) : b;
  const rx = typeRank(x);
  const ry = typeRank(y);
  if (rx !== ry) return rx - ry;
  if (typeof x === "number" && typeof y === "number") {
    const cx = clean15(x);
    const cy = clean15(y);
    return cx < cy ? -1 : cx > cy ? 1 : 0;
  }
  if (typeof x === "string" && typeof y === "string") {
    const ux = x.toUpperCase();
    const uy = y.toUpperCase();
    return ux < uy ? -1 : ux > uy ? 1 : 0;
  }
  return Number(x) - Number(y);
}

function emptyLike(other: number | string | boolean | null): number | string | boolean {
  if (typeof other === "string") return "";
  if (typeof other === "boolean") return false;
  return 0;
}
