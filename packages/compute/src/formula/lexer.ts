// The formula lexer: one linear pass, no recursion and no regular expression over the whole
// formula, so hostile input stays cheap. It reads AskBoard's flat references (AD-13): the item
// ID, at most one child ID, a `*` for each further child level, then the field; or an item's
// cell or range. A character outside the grammar or a malformed reference is a syntax error.

import { ID_PATTERN, isFieldName, parseCell, REFERENCE_WILDCARD } from "@askboard/contract";

export type Cell = { readonly column: number; readonly row: number };

export type ReferenceSyntax =
  | {
      readonly form: "field";
      readonly item: string;
      /** The one child ID; absent for the item's own fields and for `[item.*.field]`. */
      readonly child?: string;
      /** How many `*` follow: each replaces the nodes so far by their children. */
      readonly levels: number;
      readonly field: string;
    }
  | { readonly form: "cell"; readonly item: string; readonly cell: string }
  | {
      readonly form: "range";
      readonly item: string;
      readonly from: Cell;
      readonly to: Cell;
      readonly cells: number;
    };

export type Token =
  | { readonly kind: "number"; readonly value: number; readonly text: string; readonly at: number }
  | { readonly kind: "text"; readonly value: string; readonly at: number }
  | { readonly kind: "boolean"; readonly value: boolean; readonly at: number }
  /** A name in upper case; `call` when `(` follows. */
  | { readonly kind: "name"; readonly name: string; readonly call: boolean; readonly at: number }
  | { readonly kind: "operator"; readonly symbol: string; readonly at: number }
  | {
      readonly kind: "reference";
      readonly reference: ReferenceSyntax;
      /** The text between the brackets. */
      readonly source: string;
      /** The reference's position among the formula's references. */
      readonly index: number;
      readonly at: number;
    }
  | { readonly kind: "open" | "close" | "comma"; readonly at: number };

export type Lexed =
  | { readonly ok: true; readonly tokens: readonly Token[] }
  | { readonly ok: false; readonly reason: string };

const ID = new RegExp(ID_PATTERN);
const TWO_CHAR_OPERATORS = new Set(["<=", ">=", "<>"]);
const ONE_CHAR_OPERATORS = new Set(["+", "-", "*", "/", "^", "=", "<", ">", "&", "%"]);
const SPACE = new Set([" ", "\t", "\n", "\r"]);

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9";
const isNameStart = (c: string | undefined): boolean =>
  c !== undefined && ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_");
const isNamePart = (c: string | undefined): boolean => isNameStart(c) || isDigit(c) || c === ".";

/** The last segment of a reference: a field, a cell or a range; `middle` are the segments between. */
const lastSegment = (
  body: string,
  item: string,
  middle: readonly string[],
  last: string,
): ReferenceSyntax | string => {
  const colon = last.indexOf(":");
  if (colon >= 0) {
    const from = parseCell(last.slice(0, colon));
    const to = parseCell(last.slice(colon + 1));
    if (middle.length > 0 || from === undefined || to === undefined) {
      return `reference [${body}]: a range is item.A1:B3`;
    }
    const cells = (Math.abs(from.column - to.column) + 1) * (Math.abs(from.row - to.row) + 1);
    return { form: "range", item, from, to, cells };
  }
  if (parseCell(last) !== undefined) {
    if (middle.length > 0) return `reference [${body}]: a cell belongs to an item, not to a child`;
    return { form: "cell", item, cell: last };
  }
  if (!isFieldName(last)) return `reference [${body}]: field "${last}" is not a field name`;
  return { form: "field", item, levels: 0, field: last };
};

/** Reads the inside of `[...]`: the reference, or why it is not one. */
export const parseReference = (body: string): ReferenceSyntax | string => {
  const segments = body.split(".");
  if (segments.length < 2) return `reference [${body}] needs an item and a field`;
  const item = segments[0] ?? "";
  if (!ID.test(item)) return `reference [${body}]: item ID "${item}" is not ${ID_PATTERN}`;
  const middle = segments.slice(1, -1);
  const [first, ...rest] = middle;
  if (first !== undefined && first !== REFERENCE_WILDCARD && !ID.test(first)) {
    return `reference [${body}]: child ID "${first}" is not ${ID_PATTERN}`;
  }
  if (rest.some((segment) => segment !== REFERENCE_WILDCARD)) {
    return `reference [${body}]: a reference holds at most one child ID, then only ${REFERENCE_WILDCARD}`;
  }
  const last = lastSegment(body, item, middle, segments[segments.length - 1] ?? "");
  if (typeof last === "string" || last.form !== "field") return last;
  const child = first !== undefined && first !== REFERENCE_WILDCARD ? first : undefined;
  const levels = middle.filter((segment) => segment === REFERENCE_WILDCARD).length;
  return child === undefined ? { ...last, levels } : { ...last, child, levels };
};

type Step = { readonly token: Token; readonly next: number } | { readonly reason: string };

const readText = (formula: string, at: number): Step => {
  let value = "";
  let i = at + 1;
  for (;;) {
    if (i >= formula.length) return { reason: `unterminated text at ${at}` };
    const c = formula[i++] as string;
    if (c !== '"') {
      value += c;
    } else if (formula[i] === '"') {
      value += '"';
      i++;
    } else {
      return { token: { kind: "text", value, at }, next: i };
    }
  }
};

const readReference = (formula: string, at: number, index: number): Step => {
  const close = formula.indexOf("]", at + 1);
  if (close < 0) return { reason: `unterminated reference at ${at}` };
  const source = formula.slice(at + 1, close);
  if (source.includes("[")) return { reason: `nested [ in a reference at ${at}` };
  const reference = parseReference(source);
  if (typeof reference === "string") return { reason: reference };
  return { token: { kind: "reference", reference, source, index, at }, next: close + 1 };
};

const readNumber = (formula: string, at: number): Step => {
  let i = at;
  while (isDigit(formula[i])) i++;
  if (formula[i] === ".") {
    i++;
    while (isDigit(formula[i])) i++;
  }
  if (formula[i] === "e" || formula[i] === "E") {
    let j = i + 1;
    if (formula[j] === "+" || formula[j] === "-") j++;
    if (isDigit(formula[j])) {
      i = j;
      while (isDigit(formula[i])) i++;
    }
  }
  const text = formula.slice(at, i);
  return { token: { kind: "number", value: Number(text), text, at }, next: i };
};

const readName = (formula: string, at: number): Step => {
  let i = at;
  while (isNamePart(formula[i])) i++;
  const name = formula.slice(at, i).toUpperCase();
  let j = i;
  while (j < formula.length && SPACE.has(formula[j] as string)) j++;
  const call = formula[j] === "(";
  if (!call && (name === "TRUE" || name === "FALSE")) {
    return { token: { kind: "boolean", value: name === "TRUE", at }, next: i };
  }
  return { token: { kind: "name", name, call, at }, next: i };
};

const PUNCTUATION: Readonly<Record<string, "open" | "close" | "comma">> = {
  "(": "open",
  ")": "close",
  ",": "comma",
};

const readSymbol = (formula: string, at: number): Step => {
  const two = formula.slice(at, at + 2);
  if (TWO_CHAR_OPERATORS.has(two))
    return { token: { kind: "operator", symbol: two, at }, next: at + 2 };
  const c = formula[at] as string;
  if (ONE_CHAR_OPERATORS.has(c))
    return { token: { kind: "operator", symbol: c, at }, next: at + 1 };
  const kind = Object.hasOwn(PUNCTUATION, c) ? PUNCTUATION[c] : undefined;
  if (kind !== undefined) return { token: { kind, at }, next: at + 1 };
  return { reason: `character "${c}" at ${at} is outside the grammar` };
};

const readToken = (formula: string, at: number, references: number): Step => {
  const c = formula[at];
  if (c === '"') return readText(formula, at);
  if (c === "[") return readReference(formula, at, references);
  if (isDigit(c) || (c === "." && isDigit(formula[at + 1]))) return readNumber(formula, at);
  if (isNameStart(c)) return readName(formula, at);
  return readSymbol(formula, at);
};

/** Tokenises a formula; refuses characters outside the grammar and unbalanced parentheses. */
export const lex = (formula: string): Lexed => {
  const tokens: Token[] = [];
  let depth = 0;
  let references = 0;
  let i = 0;
  while (i < formula.length) {
    if (SPACE.has(formula[i] as string)) {
      i++;
      continue;
    }
    const step = readToken(formula, i, references);
    if ("reason" in step) return { ok: false, reason: step.reason };
    const { token } = step;
    if (token.kind === "reference") references++;
    if (token.kind === "open") depth++;
    if (token.kind === "close" && --depth < 0) {
      return { ok: false, reason: `unbalanced ) at ${token.at}` };
    }
    tokens.push(token);
    i = step.next;
  }
  if (depth !== 0) return { ok: false, reason: "unbalanced (" };
  return { ok: true, tokens };
};
