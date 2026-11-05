// The whitelisted functions as code, in a frozen module-private table built only from the
// contract's whitelist (AD-13). Names resolve through a Map, never through property lookup, so
// `constructor` or `__proto__` reach nothing. Each function gets its arguments unevaluated: IF is
// lazy, and aggregates treat references and typed values differently, as Excel does.

import { FORMULA_FUNCTIONS, type FunctionName } from "@askboard/contract";
import { MAX_SERIAL, MIN_SERIAL, workday } from "../dates.ts";
import type { Expression } from "../formula/expression.ts";
import { type EngineError, type EngineValue, isEngineError } from "./port.ts";
import { clean15, err, finite, toBoolean, toNumber } from "./values.ts";

export type Ctx = {
  /** The engine name of the cell being evaluated: errors raised here name it. */
  readonly origin: number;
  scalar(expression: Expression): EngineValue;
  /** What a reference argument reads, or undefined when the argument is not a reference. */
  reference(expression: Expression): Read | undefined;
};

/** A reference's `size` places; `cells` holds the non-empty ones as [place, value], the rest empty. */
export type Read = {
  readonly list: boolean;
  readonly size: number;
  readonly cells: readonly (readonly [number, EngineValue])[];
};

type Implementation = (args: readonly Expression[], ctx: Ctx) => EngineValue;

/** An aggregate's numbers: inside references only numbers count; typed values are converted. */
const numbers = (args: readonly Expression[], ctx: Ctx): number[] | EngineError => {
  const out: number[] = [];
  for (const arg of args) {
    const read = ctx.reference(arg);
    for (const [, v] of read?.cells ?? []) {
      if (isEngineError(v)) return v;
      if (typeof v === "number") out.push(v);
    }
    if (read !== undefined) continue;
    const v = ctx.scalar(arg);
    if (v === null) continue;
    const n = toNumber(v, ctx.origin);
    if (isEngineError(n)) return n;
    out.push(n);
  }
  return out;
};

/** AND's values: inside references booleans and numbers count; text and empty are ignored. */
const logicals = (args: readonly Expression[], ctx: Ctx): boolean[] | EngineError => {
  const out: boolean[] = [];
  for (const arg of args) {
    const read = ctx.reference(arg);
    for (const [, v] of read?.cells ?? []) {
      if (isEngineError(v)) return v;
      if (typeof v === "boolean") out.push(v);
      else if (typeof v === "number") out.push(v !== 0);
    }
    if (read !== undefined) continue;
    const v = ctx.scalar(arg);
    if (v === null) continue;
    const b = toBoolean(v, ctx.origin);
    if (isEngineError(b)) return b;
    out.push(b);
  }
  return out.length === 0 ? err("value", ctx.origin, "no logical values") : out;
};

const number = (arg: Expression | undefined, ctx: Ctx): number | EngineError =>
  arg === undefined
    ? err("value", ctx.origin, "missing argument")
    : toNumber(ctx.scalar(arg), ctx.origin);

/** An argument as places: a reference's, or one typed value. */
const places = (arg: Expression, ctx: Ctx): Read =>
  ctx.reference(arg) ?? { list: false, size: 1, cells: [[0, ctx.scalar(arg)]] };

/** A number at 15 significant digits, as mantissa text and exponent, so scaling is exact in decimal. */
const digits15 = (x: number): [string, number] => {
  const [m, e] = Math.abs(x).toExponential(14).split("e");
  return [m as string, Number(e)];
};

const unscaled = (v: number, digits: number, sign: number): number => {
  // Through the exponent again: String(v) is itself exponential from 1e21 on.
  const [m, e] = v.toExponential().split("e");
  const r = Number(`${m}e${Number(e) - digits}`);
  return sign < 0 ? -r : r;
};

/** The most decimal places, either way, that ROUND and ROUNDUP take. */
const MAX_DIGITS = 300;

// ROUND's and ROUNDUP's arithmetic, for digits within ±MAX_DIGITS: `x` to `digits` places, half
// away from zero or up, in decimal from its 15 significant digits.
const rounded = (x: number, digits: number, mode: "half" | "up"): number => {
  if (x === 0) return 0;
  const [m, e] = digits15(x);
  // Rounding below the 15th significant digit leaves the 15-digit value: ROUND(1E300,10) is 1E300.
  if (e + digits >= 15) return clean15(x);
  const v = Number(`${m}e${e + digits}`);
  return unscaled(mode === "half" ? Math.floor(v + 0.5) : Math.ceil(v), digits, Math.sign(x));
};

const round =
  (mode: "half" | "up"): Implementation =>
  (args, ctx) => {
    const x = number(args[0], ctx);
    if (isEngineError(x)) return x;
    const d = number(args[1], ctx);
    if (isEngineError(d)) return d;
    const digits = Math.trunc(d);
    if (x !== 0 && Math.abs(digits) > MAX_DIGITS) {
      return err("value", ctx.origin, "digits out of range");
    }
    return finite(rounded(x, digits, mode), ctx.origin);
  };

/**
 * The evaluator's own ROUND on a number (molecules design decision 10): `x` to `digits` decimal
 * places, exactly as a `ROUND` formula gives it, so that a widget rounds a derived value as a
 * formula would; NaN where the formula gives an error.
 */
export const roundNumber = (x: number, digits: number): number => {
  const whole = Math.trunc(digits);
  if (x !== 0 && !(Math.abs(whole) <= MAX_DIGITS)) return Number.NaN;
  const value = rounded(x, whole, "half");
  return Number.isFinite(value) ? value || 0 : Number.NaN;
};

const aggregate =
  (reduce: (xs: number[], ctx: Ctx) => EngineValue): Implementation =>
  (args, ctx) => {
    const xs = numbers(args, ctx);
    return Array.isArray(xs) ? reduce(xs, ctx) : xs;
  };

const date = (arg: Expression | undefined, ctx: Ctx): number | EngineError => {
  const x = number(arg, ctx);
  if (isEngineError(x)) return x;
  const day = Math.floor(x);
  return day < MIN_SERIAL || day > MAX_SERIAL
    ? err("value", ctx.origin, "not a date in range")
    : day;
};

/** Products place by place; an empty place or a non-number counts as 0, so only filled places add. */
const sumproduct: Implementation = (args, ctx) => {
  const lists = args.map((arg) => places(arg, ctx));
  const size = lists[0]?.size ?? 0;
  for (const list of lists) {
    for (const [, v] of list.cells) if (isEngineError(v)) return v;
    if (list.size !== size)
      return err("value", ctx.origin, "SUMPRODUCT of lists of different length");
  }
  const [first, ...rest] = lists.map((list) => new Map(list.cells));
  let sum = 0;
  for (const [at, v] of first ?? []) {
    let product = typeof v === "number" ? v : 0;
    for (const other of rest) {
      const w = other.get(at);
      product *= typeof w === "number" ? w : 0;
    }
    sum += product;
  }
  return finite(sum, ctx.origin);
};

const IMPLEMENTATIONS: Readonly<Record<FunctionName, Implementation>> = {
  SUM: aggregate((xs, ctx) =>
    finite(
      xs.reduce((s, x) => s + x, 0),
      ctx.origin,
    ),
  ),
  // A reduce, not a spread: a range may hold 65,536 cells, past the engines' argument limits.
  MIN: aggregate((xs) => xs.reduce((m, x) => Math.min(m, x), xs[0] ?? 0)),
  MAX: aggregate((xs) => xs.reduce((m, x) => Math.max(m, x), xs[0] ?? 0)),
  SUMSQ: aggregate((xs, ctx) =>
    finite(
      xs.reduce((s, x) => s + x * x, 0),
      ctx.origin,
    ),
  ),
  IF: (args, ctx) => {
    const condition = toBoolean(ctx.scalar(args[0] as Expression), ctx.origin);
    if (isEngineError(condition)) return condition;
    const branch = condition ? args[1] : args[2];
    return branch === undefined ? false : ctx.scalar(branch);
  },
  AND: (args, ctx) => {
    const bs = logicals(args, ctx);
    return Array.isArray(bs) ? bs.every((b) => b) : bs;
  },
  SQRT: (args, ctx) => {
    const x = number(args[0], ctx);
    if (isEngineError(x)) return x;
    return x < 0 ? err("value", ctx.origin, "SQRT of a negative number") : Math.sqrt(x);
  },
  ROUND: round("half"),
  ROUNDUP: round("up"),
  SUMPRODUCT: sumproduct,
  WORKDAY: (args, ctx) => {
    const start = date(args[0], ctx);
    if (isEngineError(start)) return start;
    const n = number(args[1], ctx);
    if (isEngineError(n)) return n;
    if (Math.abs(n) > MAX_SERIAL) return err("value", ctx.origin, "WORKDAY days out of range");
    const day = workday(start, n);
    return day < MIN_SERIAL || day > MAX_SERIAL
      ? err("value", ctx.origin, "WORKDAY result out of range")
      : day;
  },
};

const TABLE: ReadonlyMap<string, Implementation> = new Map(
  FORMULA_FUNCTIONS.map((entry) => [entry.name, Object.freeze(IMPLEMENTATIONS[entry.name])]),
);

export const implementationOf = (name: string): Implementation | undefined => TABLE.get(name);

export const functionNames = (): Iterable<string> => TABLE.keys();
