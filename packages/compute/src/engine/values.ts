// Excel's coercion rules inside the engine (formula spike, the own evaluator). An error is a plain
// object; every other value is a primitive, and null is an empty cell.

import type { FormulaErrorKind } from "@askboard/contract";
import { type EngineError, type EngineScalar, type EngineValue, isEngineError } from "./port.ts";

export const err = (kind: FormulaErrorKind, origin: number, detail?: string): EngineError =>
  detail === undefined ? { kind, origin } : { kind, origin, detail };

/** Excel keeps 15 significant digits; comparisons and rounding work on that value. */
export const clean15 = (x: number): number =>
  x === 0 || !Number.isFinite(x) ? x : Number(x.toPrecision(15));

/** Plain decimal text only, whatever the locale: no grouping, no decimal comma. */
const NUMERIC_TEXT = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;

/**
 * An arithmetic operand: booleans 1 and 0, empty 0, numeric text converted, other text #VALUE!.
 * Numeric text past the largest number (`"1e400"`) is #VALUE! too, never Infinity.
 */
export const toNumber = (v: EngineValue, origin: number): number | EngineError => {
  if (typeof v === "number" || isEngineError(v)) return v;
  if (v === null) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = NUMERIC_TEXT.test(v) ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : err("value", origin, `text "${v.slice(0, 32)}" is not a number`);
};

/** A condition: numbers are TRUE unless 0, empty is FALSE, text only "TRUE" or "FALSE". */
export const toBoolean = (v: EngineValue, origin: number): boolean | EngineError => {
  if (typeof v === "boolean" || isEngineError(v)) return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  const text = v.toUpperCase();
  if (text === "TRUE" || text === "FALSE") return text === "TRUE";
  return err("value", origin, "text is not a logical value");
};

/** A finite number, or #NUM! as `value`; never -0. */
export const finite = (x: number, origin: number): number | EngineError => {
  if (!Number.isFinite(x)) return err("value", origin, "result is not a finite number");
  return x === 0 ? 0 : x;
};

const rank = (v: number | string | boolean): number =>
  typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2;

const emptyLike = (other: EngineScalar): number | string | boolean => {
  if (typeof other === "string") return "";
  if (typeof other === "boolean") return false;
  return 0;
};

/** Excel's order: numbers < text < booleans; text without case; empty takes the other side's type. */
export const compare = (a: EngineScalar, b: EngineScalar): number => {
  const x = a ?? emptyLike(b);
  const y = b ?? emptyLike(a);
  if (rank(x) !== rank(y)) return rank(x) - rank(y);
  const [u, v] =
    typeof x === "number" && typeof y === "number"
      ? [clean15(x), clean15(y)]
      : typeof x === "string" && typeof y === "string"
        ? [x.toUpperCase(), y.toUpperCase()]
        : [Number(x), Number(y)];
  return u < v ? -1 : u > v ? 1 : 0;
};
