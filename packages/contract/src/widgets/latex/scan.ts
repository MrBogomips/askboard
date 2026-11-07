// The LaTeX scan (latex-kanban-timeline, design decisions 3 and 7, Bounded work): one linear pass
// over an expression that finds the first control word it may not hold and counts how deep KaTeX
// nests it. The contract never parses LaTeX; this reads only what the lexer's own rules say, and
// where it differs from KaTeX it errs towards refusing more: a depth never less than KaTeX's.
//
// Plain ECMAScript with no JSON and no Ajv: the latex chunk bundles it.

import {
  LATEX_DEFINING_COMMANDS,
  LATEX_INFIX_COMMANDS,
  LATEX_LEVEL_CLOSERS,
  LATEX_LEVEL_OPENERS,
  LATEX_RAW_TOKEN_COMMANDS,
} from "./constants.ts";

/** What the scan found in an expression. */
export type LatexScan = {
  /** The first control word that defines a macro or holds `@`, else nothing. */
  readonly refused: string | undefined;
  /** The most levels open at once, as KaTeX nests them. */
  readonly depth: number;
};

const DEFINING: ReadonlySet<string> = new Set(LATEX_DEFINING_COMMANDS);
const OPENERS: ReadonlySet<string> = new Set(LATEX_LEVEL_OPENERS);
const CLOSERS: ReadonlySet<string> = new Set(LATEX_LEVEL_CLOSERS);
const INFIX: ReadonlySet<string> = new Set(LATEX_INFIX_COMMANDS);

// What a level on the stack is: a group (a brace, an environment, a pair of delimiters), a script
// still waiting for its argument, or a script whose argument is the group above it.
const GROUP = 0;
const AWAITING = 1;
const BOUND = 2;

type Kind = "open" | "close" | "script" | "other";

// The open levels, as three stacks that move together: what each level is, the deepest point
// reached inside it (in levels, 0 for an empty one) and whether it holds an infix. Index 0 is the
// expression itself, a group that never closes. A level that closes hands its parent that point
// plus its own level, and one more if it held an infix, which makes a fraction of the whole group.
type State = {
  readonly kinds: number[];
  readonly inners: number[];
  readonly infixes: boolean[];
  refused: string | undefined;
};

const newState = (): State => ({
  kinds: [GROUP],
  inners: [0],
  infixes: [false],
  refused: undefined,
});

const top = (state: State): number => state.kinds.length - 1;

const push = (state: State, kind: number): void => {
  state.kinds.push(kind);
  state.inners.push(0);
  state.infixes.push(false);
};

// Closes the innermost level, which is never the expression itself.
const pop = (state: State): void => {
  const at = top(state);
  const reached = 1 + (state.inners[at] ?? 0) + (state.infixes[at] ? 1 : 0);
  state.kinds.pop();
  state.inners.pop();
  state.infixes.pop();
  if (reached > (state.inners[at - 1] ?? 0)) state.inners[at - 1] = reached;
};

// The most levels open at once: every open level closed in turn, then the expression's own.
const deepestOf = (state: State): number => {
  while (top(state) > 0) pop(state);
  return (state.inners[0] ?? 0) + (state.infixes[0] ? 1 : 0);
};

// A letter of a control word in KaTeX's lexer: `[A-Za-z@]`.
const isControlLetter = (code: number): boolean =>
  (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x40;

const isBlank = (char: string | undefined): boolean =>
  char === " " || char === "\t" || char === "\r" || char === "\n";

// A character that ends a line for KaTeX's `\verb`: the regular expression's `.` stops at these.
// U+2028 and U+2029, written by code so that no invisible character stands in the source.
const LINE_SEPARATORS = String.fromCharCode(0x2028, 0x2029);

const isLineEnd = (char: string | undefined): boolean =>
  char === "\n" || char === "\r" || (char !== undefined && LINE_SEPARATORS.includes(char));

// One token of the expression, as it affects the levels. A script that is waiting for its argument
// takes the next token, or the group that opens next; a closer with no level open closes nothing.
const take = (state: State, kind: Kind): void => {
  if (state.kinds[top(state)] === AWAITING) {
    if (kind === "open") {
      state.kinds[top(state)] = BOUND;
    } else {
      pop(state);
      if (kind === "close") return;
    }
  }
  if (kind === "open") push(state, GROUP);
  else if (kind === "script") push(state, AWAITING);
  else if (kind === "close" && top(state) > 0) {
    pop(state);
    if (state.kinds[top(state)] === BOUND) pop(state);
  }
};

// An infix command, which stands as a token and makes a fraction of its group.
const takeInfix = (state: State): void => {
  take(state, "other");
  state.infixes[top(state)] = true;
};

// The end of the control sequence at `at` (a backslash): a word, or the backslash and one character.
const controlEnd = (text: string, at: number): number => {
  let end = at + 1;
  while (end < text.length && isControlLetter(text.charCodeAt(end))) end += 1;
  return end === at + 1 ? Math.min(at + 2, text.length) : end;
};

// The next position after blanks and comments, which are no token.
const skipBlanksAndComments = (text: string, from: number): number => {
  let at = from;
  while (at < text.length) {
    if (isBlank(text[at])) at += 1;
    else if (text[at] === "%") {
      const end = text.indexOf("\n", at);
      at = end === -1 ? text.length : end + 1;
    } else break;
  }
  return at;
};

// The end of one raw token at `at`: a control sequence, or one code point.
const rawTokenEnd = (text: string, at: number): number => {
  if (at >= text.length) return at;
  if (text[at] === "\\") return controlEnd(text, at);
  const code = text.charCodeAt(at);
  const pair = code >= 0xd800 && code <= 0xdbff && at + 1 < text.length;
  return at + (pair ? 2 : 1);
};

// Whether the token at `at` is one the scan must count rather than take: an opener of a level
// (4.12 re-review X-2), or an infix command, which would otherwise lose its level.
const isCounted = (token: string): boolean =>
  token === "{" || OPENERS.has(token) || INFIX.has(token);

// The token `\char` or `\show` reads raw, after blanks and comments: where it ends, and its text.
// KaTeX's lexer drops blanks only after a control word, so after a quote or a comment a blank is
// that token and what follows it is read as usual; the scan skips the blank instead, so it never
// takes a token it must count, and where it differs from KaTeX it counts more.
const rawToken = (text: string, from: number) => {
  const at = skipBlanksAndComments(text, from);
  const end = rawTokenEnd(text, at);
  return { end, token: text.slice(at, end) };
};

// `\char` and `\show` read the next token raw: it closes nothing, a brace included; `\char` reads
// another after a quote, a double quote or a backquote. A token the scan counts is left alone.
const consumeRaw = (text: string, from: number, command: string): number => {
  const first = rawToken(text, from);
  if (first.token === "" || isCounted(first.token)) return from;
  if (command !== "\\char" || !"'\"`".includes(first.token)) return first.end;
  const second = rawToken(text, first.end);
  return second.token === "" || isCounted(second.token) ? first.end : second.end;
};

// After `\begin` or `\end`, the environment's name in braces is no level.
const skipEnvironmentName = (text: string, from: number): number => {
  const open = skipBlanksAndComments(text, from);
  if (text[open] !== "{") return from;
  let end = open + 1;
  while (end < text.length && (isControlLetter(text.charCodeAt(end)) || text[end] === "*")) {
    end += 1;
  }
  const letters = text.slice(open + 1, end);
  return text[end] === "}" && letters.length > 0 && !letters.includes("@") ? end + 1 : from;
};

// A `\verb` at `end` (just after the word): its delimiter, then up to the delimiter or the end of
// the line is its body. Returns where the body starts and ends, and where the scan goes on.
const verbBody = (text: string, end: number) => {
  const star = text[end] === "*" ? 1 : 0;
  const delimiterAt = end + star;
  if (delimiterAt >= text.length) return { from: end, to: end, next: end };
  const delimiter = text[delimiterAt];
  let to = delimiterAt + 1;
  while (to < text.length && text[to] !== delimiter && !isLineEnd(text[to])) to += 1;
  return {
    from: delimiterAt + 1,
    to,
    next: text[to] === delimiter && to < text.length ? to + 1 : to,
  };
};

// The levels a region opens, with closers ignored: a comment or a `\verb` body, where an opener
// still counts, so a reading that differs from KaTeX's only counts more.
const scanQuiet = (text: string, from: number, to: number, state: State): void => {
  let at = from;
  while (at < to) {
    const char = text[at];
    if (char === "\\") {
      const end = Math.min(controlEnd(text, at), to);
      const word = text.slice(at, end);
      noteRefused(state, word);
      if (OPENERS.has(word)) take(state, "open");
      at = end;
    } else {
      if (char === "{") take(state, "open");
      else if (char === "^" || char === "_") take(state, "script");
      at += 1;
    }
  }
};

// The first control word that defines a macro or holds `@`, wherever it stands, a comment included.
const noteRefused = (state: State, word: string): void => {
  if (state.refused === undefined && (DEFINING.has(word) || word.includes("@"))) {
    state.refused = word;
  }
};

// One control sequence at `at`; the position after what it reads.
const scanControl = (text: string, at: number, state: State): number => {
  const end = controlEnd(text, at);
  if (end === at + 1) return end; // a lone backslash at the end
  const word = text.slice(at, end);
  if (end - at === 2 && !isControlLetter(text.charCodeAt(at + 1))) {
    take(state, "other");
    return end;
  }
  noteRefused(state, word);
  if (word === "\\verb") {
    take(state, "other");
    const { from, to, next } = verbBody(text, end);
    scanQuiet(text, from, to, state);
    return next;
  }
  if (INFIX.has(word)) {
    takeInfix(state);
    return end;
  }
  if (OPENERS.has(word)) {
    take(state, "open");
    return word === "\\begin" ? skipEnvironmentName(text, end) : end;
  }
  if (CLOSERS.has(word)) {
    take(state, "close");
    return word === "\\end" ? skipEnvironmentName(text, end) : end;
  }
  take(state, "other");
  return LATEX_RAW_TOKEN_COMMANDS[word] === "consumes" ? consumeRaw(text, end, word) : end;
};

/**
 * What `text` holds that a LaTeX item may not (design decisions 3 and 7). Control words are read
 * as KaTeX 0.19.1's lexer reads them: a backslash then `[A-Za-z@]+` is a control word (`\default`
 * is a word of its own, `\left` is not `\let`); any other backslash and the one character after it
 * is a control symbol (`\\`, the line break, is one symbol, so `\\def` is a line break and the text
 * `def`; `\{` is no level). `refused` is the first control word that defines a macro (one of
 * `LATEX_DEFINING_COMMANDS`) or holds `@`: KaTeX also defines macros by side effect (`\tag` defines
 * `\df@tag`, `\color` defines `\current@color`) and its lexer lets the source call them, so every
 * word of its internal namespace is refused. `depth` is the most levels open at once, as KaTeX
 * nests them: a level opens at `{` and at the control words of `LATEX_LEVEL_OPENERS`, closes at `}`
 * and at those of `LATEX_LEVEL_CLOSERS`, and `^` and `_` open one for their argument, which closes
 * with the group that opens next, else after the next token. An infix command (one of
 * `LATEX_INFIX_COMMANDS`) makes a fraction of its group, so it adds a level to the group that holds
 * it, the expression included. A brace KaTeX reads as text closes nothing: in a comment, in a
 * `\verb` body, after `\char`'s quote and after `\show`; but the scan never takes an opener or an
 * infix as such a token, since KaTeX's lexer reads a blank after a quote or a comment as the token.
 * One pass, each character read once, with no nested quantifier and no backtracking. A comment or
 * a `\verb` body is read as well as skipped (its openers count and a command named in it is
 * refused), which only refuses more.
 */
export const scanLatex = (text: string): LatexScan => {
  const state = newState();
  let at = 0;
  while (at < text.length) {
    const char = text[at];
    if (char === "\\") {
      at = scanControl(text, at, state);
    } else if (char === "%") {
      const end = text.indexOf("\n", at);
      const to = end === -1 ? text.length : end;
      scanQuiet(text, at + 1, to, state);
      at = to + 1;
    } else {
      if (char === "{") take(state, "open");
      else if (char === "}") take(state, "close");
      else if (char === "^" || char === "_") take(state, "script");
      else if (!isBlank(char)) take(state, "other");
      at += 1;
    }
  }
  return { refused: state.refused, depth: deepestOf(state) };
};
