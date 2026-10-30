// The whitelisted functions as a frozen, module-private table. Names resolve through a
// Map, never through property lookup on an object, so `constructor` or `__proto__` cannot
// reach anything. Each function receives its arguments unevaluated: IF is lazy, and the
// aggregates treat references and typed values differently, as Excel does.

import type { Address } from "../port.ts";
import { FUNCTIONS } from "../whitelist.ts";
import { MAX_SERIAL, MIN_SERIAL, networkdays, workday } from "./dates.ts";
import type { Ast } from "./parser.ts";
import { clean15, type ErrorValue, err, finite, isError, textToNumber, toBoolean, toNumber, type Value } from "./values.ts";

export interface Ctx {
  /** The node being evaluated: errors raised here name it. */
  readonly origin: Address;
  scalar(ast: Ast): Value;
  slotValue(slot: number): Value;
}

export interface FunctionEntry {
  readonly min: number;
  readonly max: number;
  readonly call: (args: readonly Ast[], ctx: Ctx) => Value;
}

const MANY = 255;

/** Numbers of an aggregate: inside references only numbers count; typed values are converted. */
function numbers(args: readonly Ast[], ctx: Ctx): number[] | ErrorValue {
  const out: number[] = [];
  for (const a of args) {
    if (a.k === "ref" || a.k === "list") {
      const slots = a.k === "ref" ? [a.slot] : a.slots;
      for (const s of slots) {
        const v = ctx.slotValue(s);
        if (isError(v)) return v;
        if (typeof v === "number") out.push(v);
      }
      continue;
    }
    const v = ctx.scalar(a);
    if (isError(v)) return v;
    if (v === null) continue;
    const n = toNumber(v, ctx.origin);
    if (isError(n)) return n;
    out.push(n);
  }
  return out;
}

function logicals(args: readonly Ast[], ctx: Ctx): boolean[] | ErrorValue {
  const out: boolean[] = [];
  for (const a of args) {
    if (a.k === "ref" || a.k === "list") {
      const slots = a.k === "ref" ? [a.slot] : a.slots;
      for (const s of slots) {
        const v = ctx.slotValue(s);
        if (isError(v)) return v;
        if (typeof v === "boolean") out.push(v);
        else if (typeof v === "number") out.push(v !== 0);
      }
      continue;
    }
    const v = ctx.scalar(a);
    if (isError(v)) return v;
    if (v === null) continue;
    const b = toBoolean(v, ctx.origin);
    if (isError(b)) return b;
    out.push(b);
  }
  return out.length === 0 ? err("value", ctx.origin, "no logical values") : out;
}

function num(a: Ast | undefined, ctx: Ctx): number | ErrorValue {
  if (!a) return err("value", ctx.origin, "missing argument");
  const v = ctx.scalar(a);
  return isError(v) ? v : toNumber(v, ctx.origin);
}

function array(a: Ast, ctx: Ctx): Value[] {
  if (a.k === "ref") return [ctx.slotValue(a.slot)];
  if (a.k === "list") return a.slots.map((s) => ctx.slotValue(s));
  return [ctx.scalar(a)];
}

/** Splits a number into mantissa and exponent at 15 significant digits, so scaling is exact in decimal. */
function scaled(x: number, digits: number): number {
  const [m, e] = Math.abs(x).toExponential(14).split("e");
  return Number(`${m}e${Number(e) + digits}`);
}

function unscale(v: number, digits: number, sign: number): number {
  // Through the exponent again: String(v) is itself exponential from 1e21 on.
  const [m, e] = v.toExponential().split("e");
  const r = Number(`${m}e${Number(e) - digits}`);
  return sign < 0 ? -r : r;
}

function roundWith(args: readonly Ast[], ctx: Ctx, mode: "half" | "up"): Value {
  const x = num(args[0], ctx);
  if (isError(x)) return x;
  const d = num(args[1], ctx);
  if (isError(d)) return d;
  if (x === 0) return 0;
  const digits = Math.trunc(d);
  if (Math.abs(digits) > 300) return err("value", ctx.origin, "digits out of range");
  const v = scaled(x, digits);
  const r = mode === "half" ? Math.floor(v + 0.5) : Math.ceil(v);
  return finite(unscale(r, digits, Math.sign(x)), ctx.origin);
}

function aggregate(reduce: (xs: number[], ctx: Ctx) => Value): FunctionEntry["call"] {
  return (args, ctx) => {
    const xs = numbers(args, ctx);
    return Array.isArray(xs) ? reduce(xs, ctx) : xs;
  };
}

function date(a: Ast | undefined, ctx: Ctx): number | ErrorValue {
  const x = num(a, ctx);
  if (isError(x)) return x;
  const s = Math.floor(x);
  return s < MIN_SERIAL || s > MAX_SERIAL ? err("value", ctx.origin, "not a date in range") : s;
}

const entries: Array<[string, FunctionEntry]> = [
  ["SUM", { min: 1, max: MANY, call: aggregate((xs, ctx) => finite(xs.reduce((s, x) => s + x, 0), ctx.origin)) }],
  ["MIN", { min: 1, max: MANY, call: aggregate((xs) => (xs.length === 0 ? 0 : xs.reduce((m, x) => (x < m ? x : m)))) }],
  ["MAX", { min: 1, max: MANY, call: aggregate((xs) => (xs.length === 0 ? 0 : xs.reduce((m, x) => (x > m ? x : m)))) }],
  ["SUMSQ", { min: 1, max: MANY, call: aggregate((xs, ctx) => finite(xs.reduce((s, x) => s + x * x, 0), ctx.origin)) }],
  [
    "AVERAGE",
    {
      min: 1,
      max: MANY,
      call: aggregate((xs, ctx) => (xs.length === 0 ? err("division-by-zero", ctx.origin, "AVERAGE of no numbers") : xs.reduce((s, x) => s + x, 0) / xs.length)),
    },
  ],
  [
    "COUNT",
    {
      min: 1,
      max: MANY,
      call: (args, ctx) => {
        // COUNT ignores errors and non-numbers instead of propagating them.
        let count = 0;
        for (const a of args) {
          for (const v of array(a, ctx)) {
            if (typeof v === "number") count++;
            else if (a.k !== "ref" && a.k !== "list" && (typeof v === "boolean" || (typeof v === "string" && textToNumber(v) !== null))) count++;
          }
        }
        return count;
      },
    },
  ],
  [
    "IF",
    {
      min: 2,
      max: 3,
      call: (args, ctx) => {
        const c = ctx.scalar(args[0] as Ast);
        if (isError(c)) return c;
        const b = toBoolean(c, ctx.origin);
        if (isError(b)) return b;
        const branch = b ? args[1] : args[2];
        return branch ? ctx.scalar(branch) : false;
      },
    },
  ],
  [
    "AND",
    {
      min: 1,
      max: MANY,
      call: (args, ctx) => {
        const bs = logicals(args, ctx);
        return Array.isArray(bs) ? bs.every((b) => b) : bs;
      },
    },
  ],
  [
    "OR",
    {
      min: 1,
      max: MANY,
      call: (args, ctx) => {
        const bs = logicals(args, ctx);
        return Array.isArray(bs) ? bs.some((b) => b) : bs;
      },
    },
  ],
  [
    "NOT",
    {
      min: 1,
      max: 1,
      call: (args, ctx) => {
        const v = ctx.scalar(args[0] as Ast);
        if (isError(v)) return v;
        const b = toBoolean(v, ctx.origin);
        return isError(b) ? b : !b;
      },
    },
  ],
  [
    "ABS",
    {
      min: 1,
      max: 1,
      call: (args, ctx) => {
        const x = num(args[0], ctx);
        return isError(x) ? x : Math.abs(x);
      },
    },
  ],
  [
    "SQRT",
    {
      min: 1,
      max: 1,
      call: (args, ctx) => {
        const x = num(args[0], ctx);
        if (isError(x)) return x;
        return x < 0 ? err("value", ctx.origin, "SQRT of a negative number") : Math.sqrt(x);
      },
    },
  ],
  ["ROUND", { min: 2, max: 2, call: (args, ctx) => roundWith(args, ctx, "half") }],
  ["ROUNDUP", { min: 2, max: 2, call: (args, ctx) => roundWith(args, ctx, "up") }],
  [
    "CEILING",
    {
      min: 2,
      max: 2,
      call: (args, ctx) => {
        const x = num(args[0], ctx);
        if (isError(x)) return x;
        const s = num(args[1], ctx);
        if (isError(s)) return s;
        if (s === 0 || x === 0) return 0;
        if (x > 0 && s < 0) return err("value", ctx.origin, "CEILING of a positive number with a negative significance");
        return finite(Math.ceil(clean15(x / s)) * s, ctx.origin);
      },
    },
  ],
  [
    "SUMPRODUCT",
    {
      min: 1,
      max: MANY,
      call: (args, ctx) => {
        const arrays = args.map((a) => array(a, ctx));
        const length = arrays[0]?.length ?? 0;
        for (const arr of arrays) {
          for (const v of arr) if (isError(v)) return v;
          if (arr.length !== length) return err("value", ctx.origin, "SUMPRODUCT of lists of different length");
        }
        let sum = 0;
        for (let i = 0; i < length; i++) {
          let p = 1;
          for (const arr of arrays) {
            const v = arr[i];
            p *= typeof v === "number" ? v : 0;
          }
          sum += p;
        }
        return finite(sum, ctx.origin);
      },
    },
  ],
  [
    "WORKDAY",
    {
      min: 2,
      max: 2,
      call: (args, ctx) => {
        const start = date(args[0], ctx);
        if (isError(start)) return start;
        const n = num(args[1], ctx);
        if (isError(n)) return n;
        if (Math.abs(n) > MAX_SERIAL) return err("value", ctx.origin, "WORKDAY days out of range");
        const r = workday(start, n);
        return r < MIN_SERIAL || r > MAX_SERIAL ? err("value", ctx.origin, "WORKDAY result out of range") : r;
      },
    },
  ],
  [
    "NETWORKDAYS",
    {
      min: 2,
      max: 2,
      call: (args, ctx) => {
        const a = date(args[0], ctx);
        if (isError(a)) return a;
        const b = date(args[1], ctx);
        return isError(b) ? b : networkdays(a, b);
      },
    },
  ],
];

const TABLE: ReadonlyMap<string, FunctionEntry> = (() => {
  const table = new Map<string, FunctionEntry>();
  for (const [name, entry] of entries) {
    // Only names the whitelist lists can enter the table.
    if (FUNCTIONS.has(name)) table.set(name, Object.freeze(entry));
  }
  return Object.freeze(table);
})();

export function lookup(name: string): FunctionEntry | undefined {
  return TABLE.get(name);
}

export function arity(fn: FunctionEntry): [number, number] {
  return [fn.min, fn.max];
}

export function tableNames(): string[] {
  return [...TABLE.keys()];
}
