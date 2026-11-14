// AskBoard's expression grammar as a recogniser over the shared lexer's tokens. IronCalc's
// parser accepts input the grammar refuses and silently drops the rest ("1 2" becomes =1,
// "(1)(2)" becomes =1, "SUM(1,,2)" is 3), so the adapter checks the grammar before the
// engine sees the formula. One pass, an explicit stack, no recursion.

import type { Token } from "../refs.ts";

const BINARY = new Set(["+", "-", "*", "/", "^", "=", "<>", "<", "<=", ">", ">="]);

/** Null when the tokens form one expression; otherwise the reason. */
export function grammarError(tokens: readonly Token[]): string | null {
  const stack: ("paren" | "call")[] = [];
  let operand = true;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as Token;
    if (operand) {
      if (t.kind === "op" && (t.text === "+" || t.text === "-")) continue;
      if (t.kind === "number" || t.kind === "string" || t.kind === "bool" || t.kind === "ref") {
        operand = false;
      } else if (t.kind === "ident") {
        if (tokens[i + 1]?.kind !== "lparen") return `${t.text} is not followed by (`;
        i++;
        stack.push("call");
        // A call may close at once, "F()"; any other token starts its first argument.
        if (tokens[i + 1]?.kind === "rparen") {
          i++;
          stack.pop();
          operand = false;
        }
      } else if (t.kind === "lparen") {
        stack.push("paren");
      } else {
        return `unexpected "${t.text}" where a value is expected (at ${t.start})`;
      }
      continue;
    }
    if (t.kind === "op" && BINARY.has(t.text)) {
      operand = true;
    } else if (t.kind === "rparen") {
      if (stack.pop() === undefined) return `unbalanced ) at ${t.start}`;
    } else if (t.kind === "comma") {
      if (stack[stack.length - 1] !== "call") return `"," outside a function's arguments (at ${t.start})`;
      operand = true;
    } else {
      return `"${t.text}" follows a value with no operator (at ${t.start})`;
    }
  }
  if (operand) return tokens.length === 0 ? "empty formula" : "the formula ends where a value is expected";
  if (stack.length > 0) return "unbalanced (";
  return null;
}
