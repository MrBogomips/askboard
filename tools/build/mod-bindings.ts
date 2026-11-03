// The mod module's top-level function bindings (push delivery, design decision 7, review fix of
// 2026-11-01). Claude Code's module check accepts `$` passed only to a function declared at the top
// of the file: a function declaration, or a `const` bound to a function. Bun's bundler writes the
// module's top-level bindings as `var`, so the build rewrites each top-level `var` bound to a
// function to `const`, unless the module assigns it again, and fails on any such `var` left. It then
// checks the rule itself on what it wrote: every call that passes `$` names a function declared at
// the top, which no nested binding of that name hides. Running Claude Code's own check,
// `claude plugin validate`, stays the PO's (group 11).
//
// "Bound to a function" is read from the initializer: a function or arrow function expression.

import { type Scanned, scan, type Token } from "./js-scan.ts";

const NAME = "the mod";

/** One top-level `var`, `let` or `const` statement and the names it binds. */
type Statement = {
  /** The index of its keyword token. */
  readonly keyword: number;
  readonly kind: string;
  readonly bindings: readonly { readonly name?: string; readonly isFunction: boolean }[];
};

type TopLevel = {
  /** The names of the top-level function declarations. */
  readonly declared: ReadonlySet<string>;
  readonly statements: readonly Statement[];
};

const DECLARATIONS = new Set(["var", "let", "const"]);

/** Names before a `(` that opens no call: statements and operators that take an expression. */
const NOT_CALLEES = new Set([
  "if",
  "while",
  "for",
  "switch",
  "catch",
  "with",
  "return",
  "typeof",
  "void",
  "delete",
  "await",
  "yield",
  "case",
  "throw",
  "in",
  "of",
  "instanceof",
  "else",
  "do",
  "new",
]);

/** Whether a token can end an expression, so that a `(` after it calls what it ends. */
const endsExpression = (token: Token): boolean =>
  token.kind === "string" ||
  token.kind === "regex" ||
  token.kind === "number" ||
  (token.kind === "template" && token.text.endsWith("`")) ||
  [")", "]", "}"].includes(token.text);

const lineOf = (code: string, offset: number): number => code.slice(0, offset).split("\n").length;

/** Whether a statement may start at token `index`: first, or after a `;`, a `}` or `export`. */
const startsStatement = (tokens: readonly Token[], index: number): boolean => {
  const before = tokens[index - 1];
  return before === undefined || [";", "}", "export"].includes(before.text);
};

/** Whether the initializer from `start` is a function or an arrow function expression. */
const isFunctionAt = ({ tokens, partner }: Scanned, start: number): boolean => {
  const arrowAfter = (opener: number) => tokens[(partner.get(opener) ?? -2) + 1]?.text === "=>";
  const first = tokens[start];
  const second = tokens[start + 1];
  if (first?.text === "function") return true;
  if (first?.text === "(") return arrowAfter(start);
  if (first?.kind !== "name") return false;
  if (second?.text === "=>") return true;
  if (first.text !== "async") return false;
  if (second?.text === "function") return true;
  if (second?.text === "(") return arrowAfter(start + 1);
  return second?.kind === "name" && tokens[start + 2]?.text === "=>";
};

// The end of an initializer from `start`: the `,` or `;` at its statement's depth that ends it.
const initializerEnd = (tokens: readonly Token[], start: number, depth: number): number => {
  let index = start;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token?.depth === depth && (token.text === "," || token.text === ";")) return index;
    index += 1;
  }
  return index;
};

/** The statement whose keyword is at `keyword`: each binding's name, and whether it is a function. */
const statementAt = (scanned: Scanned, keyword: number): Statement => {
  const { tokens, partner } = scanned;
  const depth = tokens[keyword]?.depth ?? 0;
  const bindings: Statement["bindings"][number][] = [];
  let index = keyword + 1;
  for (;;) {
    const target = tokens[index];
    if (target === undefined) break;
    const simple = target.kind === "name";
    index = simple ? index + 1 : (partner.get(index) ?? index) + 1;
    const assigned = tokens[index]?.text === "=";
    const isFunction = assigned && isFunctionAt(scanned, index + 1);
    bindings.push({ ...(simple ? { name: target.text } : {}), isFunction });
    if (assigned) index = initializerEnd(tokens, index + 1, depth);
    if (tokens[index]?.text !== ",") break;
    index += 1;
  }
  return { keyword, kind: tokens[keyword]?.text ?? "", bindings };
};

/** The module's top-level function declarations and binding statements. */
const topLevelOf = (scanned: Scanned): TopLevel => {
  const { tokens } = scanned;
  const declared = new Set<string>();
  const statements: Statement[] = [];
  tokens.forEach((token, index) => {
    if (token.depth !== 0 || token.kind !== "name") return;
    if (DECLARATIONS.has(token.text) && startsStatement(tokens, index)) {
      statements.push(statementAt(scanned, index));
      return;
    }
    if (token.text !== "function") return;
    const async = tokens[index - 1]?.text === "async";
    if (!startsStatement(tokens, async ? index - 1 : index)) return;
    const named = tokens[index + 1]?.text === "*" ? tokens[index + 2] : tokens[index + 1];
    if (named?.kind === "name") declared.add(named.text);
  });
  return { declared, statements };
};

/** The functions `$` may be passed to: declared at the top, or bound there by a `const`. */
const topFunctionsOf = ({ declared, statements }: TopLevel): Set<string> => {
  const functions = new Set(declared);
  for (const statement of statements.filter(({ kind }) => kind === "const")) {
    for (const { name, isFunction } of statement.bindings) {
      if (name !== undefined && isFunction) functions.add(name);
    }
  }
  return functions;
};

/** A top-level `var` statement that binds functions alone, by simple names, can become a `const`. */
const rewritable = (statement: Statement): boolean =>
  statement.kind === "var" &&
  statement.bindings.every(({ name, isFunction }) => name !== undefined && isFunction);

const namesOf = (statement: Statement): string[] =>
  statement.bindings.flatMap(({ name }) => (name === undefined ? [] : [name]));

/** The messages of what keeps `code` from parsing, Bun's own, each assignment to a const among them. */
const parseErrors = (code: string): string[] => {
  try {
    new Bun.Transpiler({ loader: "js" }).transformSync(code);
    return [];
  } catch (error) {
    const errors = (error as { errors?: unknown[] }).errors ?? [error];
    return errors.map((each) => (each instanceof Error ? each.message : String(each)));
  }
};

/** Bun's two messages for an assignment to a const: in its own scope, and in a nested one. */
const ASSIGNED_CONSTANT =
  /^(?:Cannot assign to "(.+)" because it is a constant|This assignment will throw because "(.+)" is a constant)$/;

const withConst = (code: string, tokens: readonly Token[], statements: readonly Statement[]) => {
  let rewritten = code;
  for (const { keyword } of [...statements].sort((a, b) => b.keyword - a.keyword)) {
    const token = tokens[keyword];
    if (token === undefined) continue;
    rewritten = `${rewritten.slice(0, token.start)}const${rewritten.slice(token.end)}`;
  }
  return rewritten;
};

export type Rewritten = { readonly code: string; readonly problems: readonly string[] };

/**
 * Rewrites each top-level `var` bound to a function to `const`, except one the module assigns
 * again, which Bun's own parser finds, scopes followed: that `var` stays, for the check to refuse.
 */
export const constFunctionBindings = (code: string): Rewritten => {
  const scanned = scan(code);
  const candidates = topLevelOf(scanned).statements.filter(rewritable);
  const kept = new Set<string>();
  for (;;) {
    const chosen = candidates.filter((statement) => !namesOf(statement).some((n) => kept.has(n)));
    const rewritten = withConst(code, scanned.tokens, chosen);
    const errors = parseErrors(rewritten);
    const assigned = errors.map((message) => {
      const found = ASSIGNED_CONSTANT.exec(message);
      return found?.[1] ?? found?.[2];
    });
    const chosenNames = new Set(chosen.flatMap(namesOf));
    const fresh = assigned.filter(
      (name): name is string => name !== undefined && chosenNames.has(name),
    );
    const other = errors.filter((_message, index) => !chosenNames.has(assigned[index] ?? ""));
    if (other.length > 0) {
      return {
        code: rewritten,
        problems: other.map((message) => `${NAME} does not parse: ${message}`),
      };
    }
    if (fresh.length === 0) return { code: rewritten, problems: [] };
    for (const name of fresh) kept.add(name);
  }
};

/** Whether the `(` at `opener` opens a function's parameters, an arrow's or a method's included. */
const opensParameters = ({ tokens, partner }: Scanned, opener: number): boolean => {
  const at = (offset: number) => tokens[opener + offset]?.text;
  const following = tokens[(partner.get(opener) ?? -2) + 1]?.text;
  if (following === "=>" || at(-1) === "function" || at(-2) === "function") return true;
  if (at(-1) === "catch") return true;
  if ((at(-1) === "*" || at(-2) === "*") && [at(-2), at(-3)].includes("function")) return true;
  const named = tokens[opener - 1];
  return following === "{" && named?.kind === "name" && !NOT_CALLEES.has(named.text);
};

/** The names a nested scope binds: declarations, function names and simple parameters. */
const nestedNamesOf = (scanned: Scanned): Set<string> => {
  const { tokens } = scanned;
  const names = new Set<string>();
  tokens.forEach((token, index) => {
    if (token.kind !== "name") return;
    const before = tokens[index - 1];
    const after = tokens[index + 1];
    const declares =
      before !== undefined && (DECLARATIONS.has(before.text) || before.text === "function");
    if (declares && before.depth > 0) names.add(token.text);
    if (after?.text === "=>" && before?.text !== ")") names.add(token.text);
    if (!["(", ",", "..."].includes(before?.text ?? "")) return;
    if (![",", ")", "="].includes(after?.text ?? "")) return;
    const opener = token.parent;
    if (tokens[opener]?.text === "(" && opensParameters(scanned, opener)) names.add(token.text);
  });
  return names;
};

/** The callee of the call whose arguments `$` at `index` is one of; undefined when no call. */
const calleeOf = ({ tokens, partner }: Scanned, index: number): Token | "unnamed" | undefined => {
  const before = tokens[index - 1]?.text;
  const after = tokens[index + 1]?.text;
  if (!(before === "(" || before === ",") || !(after === "," || after === ")")) return undefined;
  const opener = tokens[index]?.parent ?? -1;
  if (tokens[opener]?.text !== "(") return undefined;
  const following = tokens[(partner.get(opener) ?? -2) + 1]?.text;
  if (following === "=>" || following === "{") return undefined;
  const callee = tokens[opener - 1];
  if (callee === undefined) return undefined;
  if (callee.kind !== "name") return endsExpression(callee) ? "unnamed" : undefined;
  if (NOT_CALLEES.has(callee.text) || callee.text === "function") return undefined;
  const prior = tokens[opener - 2]?.text;
  if (prior === "function" || prior === "*") return undefined;
  return prior === "." || prior === "?." ? "unnamed" : callee;
};

/**
 * Why `code` cannot pass Claude Code's module check: a top-level `var` still bound to a function,
 * and each call passing `$` to anything but a function declared at the top.
 */
export const modBindingProblems = (code: string): string[] => {
  const scanned = scan(code);
  const topLevel = topLevelOf(scanned);
  const problems = topLevel.statements
    .filter(({ kind }) => kind === "var")
    .flatMap(({ keyword, bindings }) => {
      const line = lineOf(code, scanned.tokens[keyword]?.start ?? 0);
      return bindings
        .filter(({ isFunction }) => isFunction)
        .map(
          ({ name }) =>
            `${NAME} binds ${name ?? "a pattern"} to a function with a top-level var at line ${line}, not a const`,
        );
    });
  const functions = topFunctionsOf(topLevel);
  const nested = nestedNamesOf(scanned);
  scanned.tokens.forEach((token, index) => {
    if (token.kind !== "name" || token.text !== "$") return;
    const callee = calleeOf(scanned, index);
    if (callee === undefined) return;
    const line = lineOf(code, token.start);
    const named = callee === "unnamed" ? undefined : callee.text;
    if (named !== undefined && functions.has(named) && !nested.has(named)) return;
    const what = named === undefined ? "a callee that is not a name" : `"${named}"`;
    problems.push(
      `${NAME} passes $ at line ${line} to ${what}, which is not a function declared at the top of the module (a function declaration, or a const bound to one)`,
    );
  });
  return problems;
};
