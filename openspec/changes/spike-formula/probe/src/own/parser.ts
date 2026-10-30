// Precedence-climbing parser from refs.ts's tokens to an AST. A run of left-associative
// operators of one precedence becomes one `chain` node evaluated by a loop, so a long flat
// formula never builds a deep tree; nesting (parentheses, calls, unary signs) is guarded.

import type { Token } from "../refs.ts";
import { arity, type FunctionEntry, lookup } from "./functions.ts";

export type Ast =
  | { readonly k: "num"; readonly v: number }
  | { readonly k: "str"; readonly v: string }
  | { readonly k: "bool"; readonly v: boolean }
  | { readonly k: "ref"; readonly slot: number }
  /** A wildcard or range: node slots in order, -1 for a range cell with no node. */
  | { readonly k: "list"; readonly slots: readonly number[] }
  | { readonly k: "neg"; readonly e: Ast }
  | { readonly k: "pos"; readonly e: Ast }
  | { readonly k: "chain"; readonly ops: readonly string[]; readonly xs: readonly Ast[] }
  | { readonly k: "call"; readonly name: string; readonly fn: FunctionEntry; readonly args: readonly Ast[] };

/** Excel's precedence: comparison < additive < multiplicative < power; unary signs bind tighter than ^. */
const PRECEDENCE = new Map<string, number>([
  ["=", 1],
  ["<>", 1],
  ["<", 1],
  ["<=", 1],
  [">", 1],
  [">=", 1],
  ["+", 2],
  ["-", 2],
  ["*", 3],
  ["/", 3],
  ["^", 4],
]);

/** Own guard, independent of the shared 64-level limit, so the parser never overflows the stack. */
export const MAX_NESTING = 256;

export class ParseError extends Error {}

export function parse(tokens: readonly Token[], resolveRef: (token: Token) => Ast): Ast {
  let pos = 0;
  let depth = 0;

  const peek = (): Token | undefined => tokens[pos];
  const fail = (message: string): never => {
    throw new ParseError(message);
  };
  const enter = (): void => {
    depth++;
    if (depth > MAX_NESTING) fail(`nesting deeper than ${MAX_NESTING}`);
  };

  function binary(minPrec: number): Ast {
    let left = unary();
    for (;;) {
      const t = peek();
      const prec = t?.kind === "op" ? PRECEDENCE.get(t.text) : undefined;
      if (prec === undefined || prec < minPrec) return left;
      const ops: string[] = [];
      const xs: Ast[] = [left];
      for (;;) {
        const u = peek();
        if (u?.kind !== "op" || PRECEDENCE.get(u.text) !== prec) break;
        pos++;
        ops.push(u.text);
        xs.push(binary(prec + 1));
      }
      left = { k: "chain", ops, xs };
    }
  }

  function unary(): Ast {
    const t = peek();
    if (t?.kind === "op" && (t.text === "-" || t.text === "+")) {
      pos++;
      enter();
      const e = unary();
      depth--;
      return t.text === "-" ? { k: "neg", e } : { k: "pos", e };
    }
    return primary();
  }

  function primary(): Ast {
    const t = peek();
    if (!t) return fail("unexpected end of formula");
    pos++;
    switch (t.kind) {
      case "number": {
        const v = Number(t.text);
        return Number.isFinite(v) ? { k: "num", v } : fail(`number ${t.text} out of range`);
      }
      case "string":
        return { k: "str", v: t.text };
      case "bool":
        return { k: "bool", v: t.text === "TRUE" };
      case "ref":
        return resolveRef(t);
      case "lparen": {
        enter();
        const e = binary(1);
        depth--;
        if (peek()?.kind !== "rparen") fail("expected )");
        pos++;
        return e;
      }
      case "ident":
        return call(t);
      default:
        return fail(`unexpected ${t.text} at ${t.start}`);
    }
  }

  function call(t: Token): Ast {
    const fn = lookup(t.text);
    if (!fn) return fail(`function ${t.text} is not whitelisted`);
    if (peek()?.kind !== "lparen") fail(`expected ( after ${t.text}`);
    pos++;
    enter();
    const args: Ast[] = [];
    if (peek()?.kind !== "rparen") {
      for (;;) {
        args.push(binary(1));
        if (peek()?.kind === "comma") {
          pos++;
          continue;
        }
        break;
      }
    }
    if (peek()?.kind !== "rparen") fail(`expected ) to close ${t.text}`);
    pos++;
    depth--;
    const [min, max] = arity(fn);
    if (args.length < min || args.length > max) fail(`${t.text} takes ${min === max ? min : `${min} to ${max}`} arguments, got ${args.length}`);
    return { k: "call", name: t.text, fn, args };
  }

  const ast = binary(1);
  if (pos < tokens.length) fail(`unexpected ${tokens[pos]?.text} at ${tokens[pos]?.start}`);
  return ast;
}
