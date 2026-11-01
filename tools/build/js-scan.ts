// A JavaScript scanner for the build's checks on generated code (the mod build's top-level bindings,
// mod-bindings.ts): the tokens of a module with their bracket depth, so that a check can tell the
// module's top level from the code nested in it. It reads what Bun's bundler writes: comments,
// strings, template literals with their substitutions, regular expressions told from division by
// the token before them, numbers, names and punctuators. It is no parser: what a check needs beyond
// tokens and depth, it works out from them.

export type TokenKind = "name" | "punct" | "string" | "template" | "regex" | "number";

export type Token = {
  readonly kind: TokenKind;
  readonly text: string;
  /** Offsets into the source: `text` is `source.slice(start, end)`. */
  readonly start: number;
  readonly end: number;
  /** The brackets and template substitutions open around it; a closer's is its opener's. */
  readonly depth: number;
  /** The index of the opener the token sits in, or -1 at the top level. */
  readonly parent: number;
};

/** A module's tokens, and each bracket's partner. */
export type Scanned = {
  readonly tokens: readonly Token[];
  /** For each opener or closer, the index of its partner. */
  readonly partner: ReadonlyMap<number, number>;
};

const PUNCTUATORS = [
  ">>>=",
  "...",
  "===",
  "!==",
  "**=",
  "<<=",
  ">>=",
  ">>>",
  "&&=",
  "||=",
  "??=",
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "?.",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "**",
  "<<",
  ">>",
  ..."{}()[];,<>+-*/%&|^!~?:=.@",
];

/** Names after which a `/` opens a regular expression, as after an operator. */
const EXPRESSION_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
  "extends",
]);

/** A name, or a private one: `\u200c` and `\u200d` may continue it (ZWNJ, ZWJ). */
const NAME = /#?[$_\p{ID_Start}](?:[$_\p{ID_Continue}]|\u200c|\u200d)*/uy;
const NUMBER =
  /(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?)n?/y;
const SPACE = /(?:\s|\/\/[^\n\r\u2028\u2029]*|\/\*[\s\S]*?\*\/)+/y;

const sticky = (pattern: RegExp, source: string, at: number): string | undefined => {
  pattern.lastIndex = at;
  return pattern.exec(source)?.[0];
};

/** Whether a `/` after `last` opens a regular expression rather than dividing. */
const regexMayFollow = (last: Token | undefined): boolean => {
  if (last === undefined) return true;
  if (last.kind === "name") return EXPRESSION_KEYWORDS.has(last.text);
  if (last.kind === "template") return last.text.endsWith("${");
  if (last.kind !== "punct") return false;
  return ![")", "]", "}", "++", "--"].includes(last.text);
};

// The end of a quoted string that opens at `at`.
const stringEnd = (source: string, at: number): number => {
  const quote = source[at];
  for (let index = at + 1; index < source.length; index += 1) {
    if (source[index] === "\\") index += 1;
    else if (source[index] === quote) return index + 1;
  }
  throw new Error(`an unterminated string at offset ${at}`);
};

// The end of a regular expression literal that opens at `at`, its flags included.
const regexEnd = (source: string, at: number): number => {
  let inClass = false;
  for (let index = at + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") index += 1;
    else if (char === "\n") break;
    else if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass)
      return index + 1 + (sticky(/[a-z]*/y, source, index + 1)?.length ?? 0);
  }
  throw new Error(`an unterminated regular expression at offset ${at}`);
};

// The end of a template's part from `at`, just past its closing backquote or its `${`.
const templatePartEnd = (source: string, at: number): number => {
  for (let index = at; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") index += 1;
    else if (char === "`") return index + 1;
    else if (char === "$" && source[index + 1] === "{") return index + 2;
  }
  throw new Error(`an unterminated template literal at offset ${at}`);
};

type Open = { readonly index: number; readonly template: boolean };

const CLOSERS: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

/** The tokens of `source`, with the depth each sits at; throws on what it cannot scan. */
export const scan = (source: string): Scanned => {
  const tokens: Token[] = [];
  const partner = new Map<number, number>();
  const open: Open[] = [];
  let at = sticky(/#![^\n]*/y, source, 0)?.length ?? 0;
  const push = (kind: TokenKind, end: number, depth = open.length): Token => {
    const token = {
      kind,
      text: source.slice(at, end),
      start: at,
      end,
      depth,
      parent: open.at(-1)?.index ?? -1,
    };
    tokens.push(token);
    at = end;
    return token;
  };
  const template = (end: number) => {
    const token = push("template", end);
    if (token.text.endsWith("${")) open.push({ index: tokens.length - 1, template: true });
  };
  while (at < source.length) {
    at += sticky(SPACE, source, at)?.length ?? 0;
    if (at >= source.length) break;
    const char = source[at] ?? "";
    if (char === "}" && open.at(-1)?.template === true) {
      open.pop();
      template(templatePartEnd(source, at + 1));
      continue;
    }
    if (char === "`") {
      template(templatePartEnd(source, at + 1));
      continue;
    }
    if (char === '"' || char === "'") {
      push("string", stringEnd(source, at));
      continue;
    }
    if (char === "/" && regexMayFollow(tokens.at(-1))) {
      push("regex", regexEnd(source, at));
      continue;
    }
    const name = sticky(NAME, source, at);
    if (name !== undefined) {
      push("name", at + name.length);
      continue;
    }
    const number = sticky(NUMBER, source, at);
    if (number !== undefined && /\d/.test(number)) {
      push("number", at + number.length);
      continue;
    }
    const punct = PUNCTUATORS.find(
      (each) => source.startsWith(each, at) && !(each === "?." && /\d/.test(source[at + 2] ?? "")),
    );
    if (punct === undefined) throw new Error(`an unexpected character at offset ${at}`);
    if ("([{".includes(punct)) {
      push("punct", at + 1);
      open.push({ index: tokens.length - 1, template: false });
    } else if (")]}".includes(punct)) {
      const opener = open.pop();
      const opened = opener === undefined ? undefined : tokens[opener.index]?.text;
      if (opener === undefined || opener.template || CLOSERS[opened ?? ""] !== punct) {
        throw new Error(`an unmatched ${punct} at offset ${at}`);
      }
      push("punct", at + 1, open.length);
      partner.set(opener.index, tokens.length - 1);
      partner.set(tokens.length - 1, opener.index);
    } else {
      push("punct", at + punct.length);
    }
  }
  if (open.length > 0) throw new Error("a bracket or a template literal is left open");
  return { tokens, partner };
};
