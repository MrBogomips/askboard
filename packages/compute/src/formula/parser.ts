// Precedence-climbing parser from tokens to an expression (formula spike, the own evaluator). A
// run of operators of one precedence becomes one `chain`, evaluated by a loop, so a long flat
// formula builds no deep tree. Every binary operator is left-associative and unary minus binds
// tighter than `^`, as in Excel. Nesting has a guard of its own, beyond the contract's limit, so
// the parser never overflows the stack whatever reaches it.

import {
  BINARY_OPERATOR_PRECEDENCE,
  type BinaryOperator,
  FORMULA_FUNCTIONS,
  type FormulaErrorKind,
  type FormulaFunction,
} from "@askboard/contract";
import type { Expression, FormulaProblem } from "./expression.ts";
import type { Token } from "./lexer.ts";

/** The parser's own nesting guard; the formula check refuses anything deeper than 64 first. */
export const MAX_NESTING = 256;

const FUNCTIONS: ReadonlyMap<string, FormulaFunction> = new Map(
  FORMULA_FUNCTIONS.map((entry) => [entry.name, entry]),
);

const PRECEDENCE: ReadonlyMap<string, number> = new Map(Object.entries(BINARY_OPERATOR_PRECEDENCE));

class Refusal extends Error {
  readonly kind: FormulaErrorKind;

  constructor(kind: FormulaErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const fail = (message: string, kind: FormulaErrorKind = "syntax"): never => {
  throw new Refusal(kind, message);
};

const describe = (token: Token): string => {
  switch (token.kind) {
    case "number":
      return token.text;
    case "text":
      return `"${token.value}"`;
    case "boolean":
      return token.value ? "TRUE" : "FALSE";
    case "name":
      return token.name;
    case "operator":
      return token.symbol;
    case "reference":
      return `[${token.source}]`;
    case "open":
      return "(";
    case "close":
      return ")";
    case "comma":
      return ",";
  }
};

const arguments_ = (n: number): string => (n === 1 ? "1 argument" : `${n} arguments`);

const arityOf = ({ name, minArgs, maxArgs }: FormulaFunction, got: number): string | undefined => {
  if (got >= minArgs && got <= maxArgs) return undefined;
  const takes = minArgs === maxArgs ? arguments_(minArgs) : `${minArgs} to ${maxArgs} arguments`;
  return `${name} takes ${takes}, got ${got}`;
};

class Parser {
  readonly tokens: readonly Token[];
  #pos = 0;
  #depth = 0;

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  formula(): Expression {
    const expression = this.binary(1);
    const rest = this.#peek();
    if (rest !== undefined) fail(`unexpected ${describe(rest)} at ${rest.at}`);
    return expression;
  }

  #peek(): Token | undefined {
    return this.tokens[this.#pos];
  }

  #precedence(): number | undefined {
    const token = this.#peek();
    return token?.kind === "operator" ? PRECEDENCE.get(token.symbol) : undefined;
  }

  #nested<T>(read: () => T): T {
    if (++this.#depth > MAX_NESTING) fail(`nesting deeper than ${MAX_NESTING}`);
    const result = read();
    this.#depth--;
    return result;
  }

  #expect(kind: Token["kind"], message: string): void {
    if (this.#peek()?.kind !== kind) fail(message);
    this.#pos++;
  }

  binary(least: number): Expression {
    let left = this.#unary();
    for (;;) {
      const precedence = this.#precedence();
      if (precedence === undefined || precedence < least) return left;
      const operators: BinaryOperator[] = [];
      const operands: Expression[] = [left];
      while (this.#precedence() === precedence) {
        operators.push((this.tokens[this.#pos++] as { symbol: BinaryOperator }).symbol);
        operands.push(this.binary(precedence + 1));
      }
      left = { k: "chain", operators, operands };
    }
  }

  #unary(): Expression {
    const token = this.#peek();
    if (token?.kind === "operator" && token.symbol === "-") {
      this.#pos++;
      return { k: "negate", operand: this.#nested(() => this.#unary()) };
    }
    return this.#primary();
  }

  #call(name: string): Expression {
    const entry =
      FUNCTIONS.get(name) ?? fail(`function ${name} is not whitelisted`, "not-whitelisted");
    this.#expect("open", `expected ( after ${name}`);
    const args: Expression[] = [];
    this.#nested(() => {
      if (this.#peek()?.kind === "close") return;
      args.push(this.binary(1));
      while (this.#peek()?.kind === "comma") {
        this.#pos++;
        args.push(this.binary(1));
      }
    });
    this.#expect("close", `expected ) to close ${name}`);
    const wrong = arityOf(entry, args.length);
    if (wrong !== undefined) fail(wrong);
    return { k: "call", name: entry.name, args };
  }

  #primary(): Expression {
    const token = this.#peek() ?? fail("unexpected end of formula");
    this.#pos++;
    switch (token.kind) {
      case "number":
        if (!Number.isFinite(token.value)) fail(`number ${token.text} is out of range`);
        return { k: "number", value: token.value };
      case "text":
        return { k: "text", value: token.value };
      case "boolean":
        return { k: "boolean", value: token.value };
      case "reference":
        return { k: "reference", index: token.index };
      case "name":
        return token.call ? this.#call(token.name) : fail(`unknown name ${token.name}`);
      case "open": {
        const inner = this.#nested(() => this.binary(1));
        this.#expect("close", "expected )");
        return inner;
      }
      default:
        return fail(`unexpected ${describe(token)} at ${token.at}`);
    }
  }
}

/** Parses a formula's tokens; references become indexes in order of appearance. */
export const parse = (tokens: readonly Token[]): Expression | FormulaProblem => {
  try {
    return new Parser(tokens).formula();
  } catch (error) {
    if (error instanceof Refusal) return { kind: error.kind, reason: error.message };
    throw error;
  }
};
