// Helpers for the mathjs parser check (task 5.2): rewrite a formula's references to plain
// names, rewrite Excel syntax to mathjs syntax token by token, and inspect a mathjs AST for
// node types, whitelist conformance and the places where its semantics differ from Excel's.

import type { MathNode } from "mathjs";
import type { Token } from "./refs.ts";
import { FUNCTIONS } from "./whitelist.ts";

export interface Rewritten {
  /** The formula with each `[reference]` replaced by r0, r1… (same reference, same name). */
  readonly plain: string;
  /** The same tokens in mathjs syntax: `=` to `==`, `<>` to `!=`, booleans, JSON strings. */
  readonly translated: string;
  readonly names: ReadonlySet<string>;
}

/** Rebuilds the formula from the lexer's token spans, so only reference spans change. */
export function rewrite(formula: string, tokens: readonly Token[]): Rewritten {
  const names = new Map<string, string>();
  const nameOf = (text: string): string => {
    let name = names.get(text);
    if (name === undefined) {
      name = `r${names.size}`;
      names.set(text, name);
    }
    return name;
  };
  let plain = "";
  let cursor = 0;
  const translated: string[] = [];
  for (const t of tokens) {
    if (t.kind === "ref") {
      plain += formula.slice(cursor, t.start) + nameOf(t.text);
      cursor = t.end;
    }
    translated.push(translate(t, formula, nameOf));
  }
  plain += formula.slice(cursor);
  return { plain, translated: translated.join(" "), names: new Set(names.values()) };
}

function translate(t: Token, formula: string, nameOf: (text: string) => string): string {
  switch (t.kind) {
    case "ref":
      return nameOf(t.text);
    case "string":
      return JSON.stringify(t.text);
    case "bool":
      return t.text === "TRUE" ? "true" : "false";
    case "op":
      if (t.text === "=") return "==";
      if (t.text === "<>") return "!=";
      return t.text;
    default:
      return formula.slice(t.start, t.end);
  }
}

/** Excel operators the grammar admits, as mathjs's OperatorNode `fn` names. */
const ALLOWED_OPERATORS = new Set([
  "add",
  "subtract",
  "multiply",
  "divide",
  "pow",
  "unaryMinus",
  "unaryPlus",
  "equal",
  "unequal",
  "smaller",
  "smallerEq",
  "larger",
  "largerEq",
]);

export interface AstReport {
  readonly nodeTypes: Readonly<Record<string, number>>;
  /** OperatorNode fn names, with `(implicit)` when mathjs inserted the multiplication. */
  readonly operators: readonly string[];
  readonly functions: readonly string[];
  /** Null when every node is in the whitelist; else the first offending node. */
  readonly refused: string | null;
  readonly mismatches: readonly string[];
  readonly maxDepth: number;
}

type AnyNode = MathNode & {
  fn?: unknown;
  op?: string;
  implicit?: boolean;
  isPercentage?: boolean;
  args?: MathNode[];
  name?: string;
  content?: MathNode;
};

/** Walks the AST with an explicit stack: a flat 1 MB sum is a left-deep tree. */
export function inspect(root: MathNode, names: ReadonlySet<string>): AstReport {
  const nodeTypes: Record<string, number> = {};
  const operators = new Set<string>();
  const functions = new Set<string>();
  const mismatches = new Set<string>();
  let refused: string | null = null;
  let maxDepth = 0;
  const stack: Array<{ node: AnyNode; depth: number }> = [{ node: root as AnyNode, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: AnyNode; depth: number };
    if (depth > maxDepth) maxDepth = depth;
    nodeTypes[node.type] = (nodeTypes[node.type] ?? 0) + 1;
    const problem = checkNode(node, names, operators, functions, mismatches);
    if (problem !== null && refused === null) refused = problem;
    node.forEach((child: MathNode, path: string) => {
      // A call's name is checked with the call, not as a free symbol.
      if (node.type === "FunctionNode" && path === "fn" && child.type === "SymbolNode") return;
      stack.push({ node: child as AnyNode, depth: depth + 1 });
    });
  }
  return {
    nodeTypes,
    operators: [...operators].sort(),
    functions: [...functions].sort(),
    refused,
    mismatches: [...mismatches].sort(),
    maxDepth,
  };
}

function checkNode(
  node: AnyNode,
  names: ReadonlySet<string>,
  operators: Set<string>,
  functions: Set<string>,
  mismatches: Set<string>,
): string | null {
  switch (node.type) {
    case "ParenthesisNode":
      return null;
    case "ConstantNode": {
      // `#` starts a comment in mathjs: `#REF!` parses to a constant `undefined`.
      const value = (node as { value?: unknown }).value;
      if (typeof value === "number") return Number.isFinite(value) ? null : `constant ${value}`;
      return typeof value === "string" || typeof value === "boolean" ? null : `constant ${String(value)}`;
    }
    case "SymbolNode": {
      const name = node.name ?? "";
      if (name === "TRUE" || name === "FALSE") {
        mismatches.add("TRUE/FALSE read as symbols, not booleans");
        return null;
      }
      return names.has(name) ? null : `symbol ${name}`;
    }
    case "OperatorNode": {
      const fn = String(node.fn);
      operators.add(node.implicit ? `${fn} (implicit)` : fn);
      const args = node.args ?? [];
      if (fn === "pow" && args[1]?.type === "OperatorNode" && (args[1] as AnyNode).fn === "pow") {
        mismatches.add("^ is right-associative in mathjs (Excel: left)");
      }
      if ((fn === "unaryMinus" || fn === "unaryPlus") && args[0]?.type === "OperatorNode" && (args[0] as AnyNode).fn === "pow") {
        mismatches.add("unary sign binds looser than ^ in mathjs (Excel: tighter)");
      }
      if (node.implicit) {
        mismatches.add("implicit multiplication");
        return "implicit multiplication";
      }
      if (fn === "bitAnd") mismatches.add("& read as bitwise and (Excel: text join)");
      if (fn === "mod") mismatches.add("% read as modulo (Excel: percent)");
      // mathjs desugars a postfix % to `x / 100`; only this flag tells it from a division.
      if (node.isPercentage) return "operator % (percentage)";
      return ALLOWED_OPERATORS.has(fn) ? null : `operator ${fn}`;
    }
    case "FunctionNode": {
      const callee = node.fn as AnyNode;
      if (callee?.type !== "SymbolNode") return "call on a non-name";
      const name = callee.name ?? "";
      functions.add(name);
      return FUNCTIONS.has(name.toUpperCase()) ? null : `function ${name}`;
    }
    case "RelationalNode":
      mismatches.add("chained comparison a<b<c is a and-chain in mathjs (Excel: (a<b)<c)");
      return "chained comparison";
    case "AssignmentNode":
      mismatches.add("= read as assignment (Excel: equality)");
      return "assignment";
    default:
      return `node ${node.type}`;
  }
}

/** mathjs syntax outside AskBoard's grammar, none of it in the fixtures: what a walk must refuse. */
export const GRAMMAR_EXTRAS: readonly string[] = [
  "r0;r1",
  "1+2 # comment",
  "2 r0",
  "3!",
  "r0'",
  "r0 ? 1 : 2",
  "[1,2]",
  '{a: 1}',
  "r0.b",
  "1:3",
  "f(x) = x",
  "5 cm",
  "2 to cm",
  "r0 and r1",
  "not r0",
  "7 mod 2",
  "r0 xor r1",
  "0x1F",
  "sum(r0)",
];
