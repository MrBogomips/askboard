// The reference lexer shared by both adapters (design decision 2). It tokenises a formula
// in AskBoard's syntax, finds `[item-id(.child-id)*.field]` references, `[item-id.A1]` cells
// and the proposed `[item-id.A1:B3]` range, and refuses what is outside the whitelist
// before any engine parses the formula. Linear and non-recursive, so hostile input is cheap.

import type { Address, FormulaError } from "./port.ts";
import { FUNCTIONS, LIMITS, REFUSED_OPERATORS } from "./whitelist.ts";

/** AD-7: agent-chosen and view-made IDs. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** A1 cell, upper case only: A..XFD, rows 1..1048576. */
const CELL_PATTERN = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const MAX_COLUMN = 16384;
const MAX_ROW = 1048576;
/** A range larger than this is refused rather than expanded. */
export const MAX_RANGE_CELLS = 65536;

export interface RefSyntax {
  /** Item ID, then child IDs or `*`, then the field or cell (or `A1:B3` for a range). */
  readonly segments: readonly string[];
  readonly wildcard: boolean;
  readonly range?: { readonly from: string; readonly to: string };
}

export type TokenKind = "number" | "string" | "bool" | "ref" | "ident" | "op" | "lparen" | "rparen" | "comma";

export interface Token {
  readonly kind: TokenKind;
  /** Source text; for a string, its value; for an identifier, upper case. */
  readonly text: string;
  /** Span in the formula, brackets and quotes included: [start, end). */
  readonly start: number;
  readonly end: number;
  readonly ref?: RefSyntax;
  /** For an identifier: whether `(` follows, i.e. it is a function call. */
  readonly call?: boolean;
}

export type LexResult =
  | { readonly ok: true; readonly tokens: readonly Token[]; readonly maxDepth: number }
  | { readonly ok: false; readonly detail: string; readonly at: number };

const TWO_CHAR_OPS = new Set(["<=", ">=", "<>"]);
const ONE_CHAR_OPS = new Set(["+", "-", "*", "/", "^", "=", "<", ">", "&", "%"]);

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isIdentStart(c: string): boolean {
  return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
}

function isIdentPart(c: string): boolean {
  return isIdentStart(c) || isDigit(c) || c === ".";
}

/** Parses the inside of `[...]`; returns the syntax or a reason. */
export function parseRefBody(body: string): RefSyntax | string {
  const segments = body.split(".");
  if (segments.length < 2) return `reference [${body}] needs an item and a field`;
  const item = segments[0] ?? "";
  if (!ID_PATTERN.test(item)) return `reference [${body}]: item ID "${item}" is not [A-Za-z0-9_-]{1,64}`;
  let wildcard = false;
  for (let i = 1; i < segments.length - 1; i++) {
    const seg = segments[i] ?? "";
    if (seg === "*") wildcard = true;
    else if (!ID_PATTERN.test(seg)) return `reference [${body}]: child ID "${seg}" is not [A-Za-z0-9_-]{1,64}`;
  }
  const last = segments[segments.length - 1] ?? "";
  const colon = last.indexOf(":");
  if (colon >= 0) {
    const from = last.slice(0, colon);
    const to = last.slice(colon + 1);
    if (segments.length !== 2 || !isCell(from) || !isCell(to)) return `reference [${body}]: a range is item.A1:B3`;
    return { segments, wildcard: false, range: { from, to } };
  }
  if (!FIELD_PATTERN.test(last)) return `reference [${body}]: field "${last}" is not a field name or a cell`;
  return { segments, wildcard };
}

export function isCell(text: string): boolean {
  const parsed = parseCell(text);
  return parsed !== null;
}

/** Column and row (1-based) of an A1 cell, or null. */
export function parseCell(text: string): { col: number; row: number } | null {
  const m = CELL_PATTERN.exec(text);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1] ?? "") col = col * 26 + (ch.charCodeAt(0) - 64);
  const row = Number(m[2]);
  if (col > MAX_COLUMN || row > MAX_ROW) return null;
  return { col, row };
}

export function cellName(col: number, row: number): string {
  let letters = "";
  let n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    letters = String.fromCharCode(65 + r) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row}`;
}

/** Tokenises a formula. Rejects characters outside the grammar and unbalanced brackets. */
export function lex(formula: string): LexResult {
  const tokens: Token[] = [];
  let depth = 0;
  let maxDepth = 0;
  let i = 0;
  const n = formula.length;
  while (i < n) {
    const c = formula[i] as string;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    const start = i;
    if (c === '"') {
      let value = "";
      i++;
      for (;;) {
        if (i >= n) return { ok: false, detail: "unterminated text", at: start };
        const d = formula[i] as string;
        if (d === '"') {
          if (formula[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += d;
        i++;
      }
      tokens.push({ kind: "string", text: value, start, end: i });
      continue;
    }
    if (c === "[") {
      const close = formula.indexOf("]", i + 1);
      if (close < 0) return { ok: false, detail: "unterminated reference", at: start };
      const body = formula.slice(i + 1, close);
      if (body.includes("[")) return { ok: false, detail: "nested [ in a reference", at: start };
      const ref = parseRefBody(body);
      if (typeof ref === "string") return { ok: false, detail: ref, at: start };
      i = close + 1;
      tokens.push({ kind: "ref", text: body, start, end: i, ref });
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(formula[i + 1] ?? ""))) {
      while (i < n && isDigit(formula[i] as string)) i++;
      if (formula[i] === ".") {
        i++;
        while (i < n && isDigit(formula[i] as string)) i++;
      }
      if (formula[i] === "e" || formula[i] === "E") {
        let j = i + 1;
        if (formula[j] === "+" || formula[j] === "-") j++;
        if (isDigit(formula[j] ?? "")) {
          i = j;
          while (i < n && isDigit(formula[i] as string)) i++;
        }
      }
      tokens.push({ kind: "number", text: formula.slice(start, i), start, end: i });
      continue;
    }
    if (isIdentStart(c)) {
      while (i < n && isIdentPart(formula[i] as string)) i++;
      const name = formula.slice(start, i).toUpperCase();
      let j = i;
      while (j < n && (formula[j] === " " || formula[j] === "\t")) j++;
      const call = formula[j] === "(";
      if (!call && (name === "TRUE" || name === "FALSE")) {
        tokens.push({ kind: "bool", text: name, start, end: i });
      } else {
        tokens.push({ kind: "ident", text: name, start, end: i, call });
      }
      continue;
    }
    const two = formula.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      i += 2;
      tokens.push({ kind: "op", text: two, start, end: i });
      continue;
    }
    if (ONE_CHAR_OPS.has(c)) {
      i++;
      tokens.push({ kind: "op", text: c, start, end: i });
      continue;
    }
    if (c === "(") {
      depth++;
      if (depth > maxDepth) maxDepth = depth;
      i++;
      tokens.push({ kind: "lparen", text: c, start, end: i });
      continue;
    }
    if (c === ")") {
      depth--;
      if (depth < 0) return { ok: false, detail: "unbalanced )", at: start };
      i++;
      tokens.push({ kind: "rparen", text: c, start, end: i });
      continue;
    }
    if (c === ",") {
      i++;
      tokens.push({ kind: "comma", text: c, start, end: i });
      continue;
    }
    return { ok: false, detail: `character "${c}" is outside the grammar`, at: start };
  }
  if (depth !== 0) return { ok: false, detail: "unbalanced (", at: n };
  return { ok: true, tokens, maxDepth };
}

/**
 * Checks a formula before any engine sees it: grammar, Excel's length and nesting limits,
 * functions and operators outside the whitelist, bare names. Returns the tokens or an error
 * naming the node's address (which starts with the item ID).
 */
export function checkFormula(formula: string, address: Address): { tokens: readonly Token[] } | FormulaError {
  if (formula.length > LIMITS.maxLength) {
    return { error: "syntax", address, detail: `formula longer than ${LIMITS.maxLength} characters (${formula.length})` };
  }
  const lexed = lex(formula);
  if (!lexed.ok) return { error: "syntax", address, detail: `${lexed.detail} at ${lexed.at}` };
  if (lexed.maxDepth > LIMITS.maxDepth) {
    return { error: "syntax", address, detail: `nesting deeper than ${LIMITS.maxDepth} (${lexed.maxDepth})` };
  }
  // A run of unary signs nests like parentheses: `---1` is three levels.
  let unaryRun = 0;
  let previous: Token | undefined;
  for (const t of lexed.tokens) {
    const unary = t.kind === "op" && (t.text === "-" || t.text === "+") && (!previous || previous.kind === "op" || previous.kind === "lparen" || previous.kind === "comma");
    unaryRun = unary ? unaryRun + 1 : 0;
    if (unaryRun + lexed.maxDepth > LIMITS.maxDepth) {
      return { error: "syntax", address, detail: `more than ${LIMITS.maxDepth} nested unary signs and parentheses` };
    }
    previous = t;
    if (t.kind === "ident") {
      if (!t.call) return { error: "syntax", address, detail: `unknown name ${t.text}` };
      if (!FUNCTIONS.has(t.text)) return { error: "not-whitelisted", address, detail: `function ${t.text}` };
    } else if (t.kind === "op" && REFUSED_OPERATORS.has(t.text)) {
      return { error: "not-whitelisted", address, detail: `operator ${t.text}` };
    }
  }
  return { tokens: lexed.tokens };
}

/** Every reference token of a formula, with its span (for adapters that rewrite references). */
export function findReferences(tokens: readonly Token[]): Token[] {
  return tokens.filter((t) => t.kind === "ref");
}

export type Resolution =
  | { readonly kind: "single"; readonly address: Address; readonly present: boolean }
  | { readonly kind: "list"; readonly addresses: readonly Address[]; readonly itemPresent: boolean }
  | { readonly kind: "too-large"; readonly cells: number };

/**
 * The graph's addresses in document order, indexed for reference resolution. Path semantics:
 * each segment is a child of the previous one, and `*` matches exactly one child level.
 */
export class AddressIndex {
  readonly #position = new Map<Address, number>();
  readonly #byShape = new Map<string, Address[]>();
  readonly #items = new Set<string>();

  constructor(addresses: readonly Address[]) {
    for (const address of addresses) {
      if (this.#position.has(address)) continue;
      this.#position.set(address, this.#position.size);
      const segs = address.split(".");
      this.#items.add(segs[0] ?? "");
      const key = shapeKey(segs.length, segs[0] ?? "", segs[segs.length - 1] ?? "");
      const list = this.#byShape.get(key);
      if (list) list.push(address);
      else this.#byShape.set(key, [address]);
    }
  }

  has(address: Address): boolean {
    return this.#position.has(address);
  }

  position(address: Address): number | undefined {
    return this.#position.get(address);
  }

  hasItem(item: string): boolean {
    return this.#items.has(item);
  }

  resolve(ref: RefSyntax): Resolution {
    const segs = ref.segments;
    const item = segs[0] ?? "";
    if (ref.range) return this.#resolveRange(item, ref.range.from, ref.range.to);
    if (!ref.wildcard) {
      const address = segs.join(".");
      return { kind: "single", address, present: this.has(address) };
    }
    const candidates = this.#byShape.get(shapeKey(segs.length, item, segs[segs.length - 1] ?? "")) ?? [];
    const addresses = candidates.filter((a) => matches(a.split("."), segs));
    return { kind: "list", addresses, itemPresent: this.hasItem(item) };
  }

  /** Row-major, every cell of the rectangle; cells with no node are empty, not missing. */
  #resolveRange(item: string, from: string, to: string): Resolution {
    const a = parseCell(from);
    const b = parseCell(to);
    if (!a || !b) return { kind: "list", addresses: [], itemPresent: false };
    const c0 = Math.min(a.col, b.col);
    const c1 = Math.max(a.col, b.col);
    const r0 = Math.min(a.row, b.row);
    const r1 = Math.max(a.row, b.row);
    const cells = (c1 - c0 + 1) * (r1 - r0 + 1);
    if (cells > MAX_RANGE_CELLS) return { kind: "too-large", cells };
    const addresses: Address[] = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) addresses.push(`${item}.${cellName(c, r)}`);
    return { kind: "list", addresses, itemPresent: this.hasItem(item) };
  }
}

function shapeKey(length: number, item: string, last: string): string {
  return `${length}\u0000${item}\u0000${last}`;
}

function matches(segs: readonly string[], pattern: readonly string[]): boolean {
  if (segs.length !== pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p !== "*" && p !== segs[i]) return false;
  }
  return true;
}
