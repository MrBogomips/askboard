// The interpreter: walks one cell's expression. Recursion is bounded by the formula check's nesting
// limit; a long run of one operator is a `chain`, evaluated by a loop. Errors propagate from the
// left operand first, as in Excel.

import type { BinaryOperator } from "@askboard/contract";
import type { Expression } from "../formula/expression.ts";
import { type Ctx, implementationOf } from "./functions.ts";
import {
  type EngineReference,
  type EngineScalar,
  type EngineValue,
  isEngineError,
} from "./port.ts";
import { compare, err, finite, toNumber } from "./values.ts";

const COMPARISONS: Readonly<Record<string, (c: number) => boolean>> = {
  "=": (c) => c === 0,
  "<>": (c) => c !== 0,
  "<": (c) => c < 0,
  "<=": (c) => c <= 0,
  ">": (c) => c > 0,
  ">=": (c) => c >= 0,
};

const power = (x: number, y: number, origin: number): EngineValue => {
  if (x === 0 && y === 0) return err("value", origin, "0^0");
  if (x === 0 && y < 0) return err("division-by-zero", origin);
  return finite(x ** y, origin);
};

const ARITHMETIC: Readonly<Record<string, (x: number, y: number, origin: number) => EngineValue>> =
  {
    "+": (x, y, origin) => finite(x + y, origin),
    "-": (x, y, origin) => finite(x - y, origin),
    "*": (x, y, origin) => finite(x * y, origin),
    "/": (x, y, origin) => (y === 0 ? err("division-by-zero", origin) : finite(x / y, origin)),
    "^": power,
  };

const apply = (
  operator: BinaryOperator,
  a: EngineScalar,
  b: EngineScalar,
  origin: number,
): EngineValue => {
  const comparison = COMPARISONS[operator];
  if (comparison !== undefined) return comparison(compare(a, b));
  const x = toNumber(a, origin);
  if (isEngineError(x)) return x;
  const y = toNumber(b, origin);
  if (isEngineError(y)) return y;
  return (ARITHMETIC[operator] as (x: number, y: number, origin: number) => EngineValue)(
    x,
    y,
    origin,
  );
};

const evaluate = (expression: Expression, ctx: Ctx): EngineValue => {
  switch (expression.k) {
    case "number":
    case "text":
    case "boolean":
      return expression.value;
    case "reference": {
      const read = ctx.reference(expression);
      if (read?.list !== false) {
        return err("value", ctx.origin, "a list where one value is expected");
      }
      return read.cells[0]?.[1] ?? null;
    }
    case "negate": {
      const x = toNumber(evaluate(expression.operand, ctx), ctx.origin);
      return isEngineError(x) ? x : finite(-x, ctx.origin);
    }
    case "chain": {
      let acc = evaluate(expression.operands[0] as Expression, ctx);
      for (const [i, operator] of expression.operators.entries()) {
        if (isEngineError(acc)) return acc;
        const rhs = evaluate(expression.operands[i + 1] as Expression, ctx);
        if (isEngineError(rhs)) return rhs;
        acc = apply(operator, acc, rhs, ctx.origin);
      }
      return acc;
    }
    case "call": {
      const implementation = implementationOf(expression.name);
      if (implementation === undefined) {
        return err(
          "not-whitelisted",
          ctx.origin,
          `function ${expression.name} is not in the engine's table`,
        );
      }
      return implementation(expression.args, ctx);
    }
  }
};

/** Evaluates a formula cell; `valueAt` reads another cell by engine name. */
export const evaluateCell = (
  expression: Expression,
  references: readonly EngineReference[],
  origin: number,
  valueAt: (name: number) => EngineValue,
): EngineValue => {
  const read = (name: number): EngineValue => (name < 0 ? null : valueAt(name));
  const ctx: Ctx = {
    origin,
    scalar: (inner) => evaluate(inner, ctx),
    reference: (inner) => {
      if (inner.k !== "reference") return undefined;
      const reference = references[inner.index];
      if (reference === undefined) {
        return { list: false, size: 1, cells: [[0, err("syntax", origin, "unknown reference")]] };
      }
      if (reference.list) {
        const cells = reference.cells.map(([at, name]) => [at, read(name)] as const);
        return { list: true, size: reference.size, cells };
      }
      return { list: false, size: 1, cells: reference.name < 0 ? [] : [[0, read(reference.name)]] };
    },
  };
  return evaluate(expression, ctx);
};
