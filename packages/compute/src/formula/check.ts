// The formula check that runs before any engine (AD-13): length, grammar, nesting depth and range
// sizes against the contract's limits, then names and operators against its whitelist, then the
// parse. It needs no graph, so the send-time check and the board refuse the same formulas.

import {
  FORMULA_FUNCTIONS,
  FORMULA_MAX_CHARS,
  FORMULA_MAX_DEPTH,
  RANGE_MAX_CELLS,
  REFUSED_OPERATORS,
} from "@askboard/contract";
import type { Expression, FormulaProblem } from "./expression.ts";
import { lex, type ReferenceSyntax, type Token } from "./lexer.ts";
import { parse } from "./parser.ts";

export type CheckedFormula = {
  readonly expression: Expression;
  /** The formula's references in order of appearance; an expression's `index` points here. */
  readonly references: readonly ReferenceSyntax[];
};

const WHITELISTED: ReadonlySet<string> = new Set(FORMULA_FUNCTIONS.map((entry) => entry.name));
const REFUSED: ReadonlySet<string> = new Set(REFUSED_OPERATORS);

export const isProblem = (checked: CheckedFormula | FormulaProblem): checked is FormulaProblem =>
  "kind" in checked;

/** Whether a sign at this place is unary: at the start, or after an operator, `(` or `,`. */
const startsOperand = (previous: Token | undefined): boolean =>
  previous === undefined ||
  previous.kind === "operator" ||
  previous.kind === "open" ||
  previous.kind === "comma";

/**
 * Nesting as the parser counts it: each open parenthesis (calls included) and each unary sign
 * whose operand is not finished. Signs before `(` or a call stay open until its `)`.
 */
const deepestNesting = (tokens: readonly Token[]): number => {
  let depth = 0;
  let pending = 0;
  const carried: number[] = [];
  let deepest = 0;
  let previous: Token | undefined;
  for (const token of tokens) {
    const sign = token.kind === "operator" && (token.symbol === "-" || token.symbol === "+");
    if (sign && startsOperand(previous)) pending++;
    if (token.kind === "open") {
      depth += pending + 1;
      carried.push(pending);
      pending = 0;
    }
    deepest = Math.max(deepest, depth + pending);
    if (token.kind === "close") depth -= (carried.pop() ?? 0) + 1;
    if (
      token.kind === "number" ||
      token.kind === "text" ||
      token.kind === "boolean" ||
      token.kind === "reference"
    ) {
      pending = 0;
    }
    previous = token;
  }
  return deepest;
};

const limitProblem = (tokens: readonly Token[]): FormulaProblem | undefined => {
  const nesting = deepestNesting(tokens);
  if (nesting > FORMULA_MAX_DEPTH) {
    const reason = `nesting of ${nesting} levels, over the limit of ${FORMULA_MAX_DEPTH}`;
    return { kind: "over-limit", reason };
  }
  for (const token of tokens) {
    if (token.kind !== "reference" || token.reference.form !== "range") continue;
    if (token.reference.cells > RANGE_MAX_CELLS) {
      const { cells } = token.reference;
      const reason = `range [${token.source}] of ${cells} cells, over the limit of ${RANGE_MAX_CELLS}`;
      return { kind: "over-limit", reason };
    }
  }
  return undefined;
};

const nameProblem = (tokens: readonly Token[]): FormulaProblem | undefined => {
  let previous: Token | undefined;
  for (const token of tokens) {
    if (token.kind === "name" && !token.call) {
      return { kind: "syntax", reason: `unknown name ${token.name}` };
    }
    if (token.kind === "name" && !WHITELISTED.has(token.name)) {
      return { kind: "not-whitelisted", reason: `function ${token.name} is not whitelisted` };
    }
    if (token.kind === "operator" && REFUSED.has(token.symbol)) {
      return { kind: "not-whitelisted", reason: `operator ${token.symbol} is not whitelisted` };
    }
    if (token.kind === "operator" && token.symbol === "+" && startsOperand(previous)) {
      return { kind: "not-whitelisted", reason: "unary + is not whitelisted" };
    }
    previous = token;
  }
  return undefined;
};

/** Checks a formula; returns its expression and references, or the first problem found. */
export const checkFormula = (formula: string): CheckedFormula | FormulaProblem => {
  if (formula.length > FORMULA_MAX_CHARS) {
    const reason = `formula of ${formula.length} characters, over the limit of ${FORMULA_MAX_CHARS}`;
    return { kind: "over-limit", reason };
  }
  const lexed = lex(formula);
  if (!lexed.ok) return { kind: "syntax", reason: lexed.reason };
  const problem = limitProblem(lexed.tokens) ?? nameProblem(lexed.tokens);
  if (problem !== undefined) return problem;
  const expression = parse(lexed.tokens);
  if ("kind" in expression) return expression;
  const references: ReferenceSyntax[] = [];
  for (const token of lexed.tokens)
    if (token.kind === "reference") references.push(token.reference);
  return { expression, references };
};
