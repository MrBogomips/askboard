// The interpreter: walks the AST of one node. Recursion depth is bounded by the parser's
// nesting guard; a long run of one operator is a `chain` evaluated by a loop.

import type { Address } from "../port.ts";
import type { Ctx } from "./functions.ts";
import type { Ast } from "./parser.ts";
import { compare, err, finite, isError, toNumber, type Value } from "./values.ts";

const COMPARISONS = new Set(["=", "<>", "<", "<=", ">", ">="]);

export function evaluate(ast: Ast, ctx: Ctx): Value {
  switch (ast.k) {
    case "num":
      return ast.v;
    case "str":
      return ast.v;
    case "bool":
      return ast.v;
    case "ref":
      return ctx.slotValue(ast.slot);
    case "list":
      return err("value", ctx.origin, "a list where one value is expected");
    case "neg": {
      const v = evaluate(ast.e, ctx);
      if (isError(v)) return v;
      const n = toNumber(v, ctx.origin);
      return isError(n) ? n : finite(-n, ctx.origin);
    }
    case "pos":
      return evaluate(ast.e, ctx);
    case "chain":
      return chain(ast.ops, ast.xs, ctx);
    case "call":
      return ast.fn.call(ast.args, ctx);
  }
}

function chain(ops: readonly string[], xs: readonly Ast[], ctx: Ctx): Value {
  let acc = evaluate(xs[0] as Ast, ctx);
  for (let i = 0; i < ops.length; i++) {
    if (isError(acc)) return acc;
    const rhs = evaluate(xs[i + 1] as Ast, ctx);
    if (isError(rhs)) return rhs;
    acc = apply(ops[i] as string, acc, rhs, ctx.origin);
  }
  return acc;
}

function apply(op: string, a: Exclude<Value, object>, b: Exclude<Value, object>, origin: Address): Value {
  if (COMPARISONS.has(op)) {
    const c = compare(a, b);
    switch (op) {
      case "=":
        return c === 0;
      case "<>":
        return c !== 0;
      case "<":
        return c < 0;
      case "<=":
        return c <= 0;
      case ">":
        return c > 0;
      default:
        return c >= 0;
    }
  }
  const x = toNumber(a, origin);
  if (isError(x)) return x;
  const y = toNumber(b, origin);
  if (isError(y)) return y;
  switch (op) {
    case "+":
      return finite(x + y, origin);
    case "-":
      return finite(x - y, origin);
    case "*":
      return finite(x * y, origin);
    case "/":
      return y === 0 ? err("division-by-zero", origin) : finite(x / y, origin);
    case "^":
      if (x === 0 && y === 0) return err("value", origin, "0^0");
      if (x === 0 && y < 0) return err("division-by-zero", origin);
      return finite(x ** y, origin);
    default:
      return err("syntax", origin, `operator ${op}`);
  }
}
