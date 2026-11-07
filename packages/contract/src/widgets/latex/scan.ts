// The LaTeX scan (latex-kanban-timeline, design decisions 3 and 7, Bounded work): one linear pass
// over an expression that finds the first control word it may not hold and counts how deep KaTeX
// nests it. The contract never parses LaTeX; this reads only what the lexer's own rules say, and
// where it differs from KaTeX it errs towards refusing more, and a form it cannot read it refuses
// by name. It is the one bound on nesting, for the agent and the board alike (latex-public-api).
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

// A combining mark: a code point of U+0300 to U+036F, the block KaTeX's lexer joins to the character
// before it, each mark an accent around what comes before (latex-public-api, design decision 3).
// The whole block is counted, not the marks KaTeX knows today.
const isMark = (code: number): boolean => code >= 0x300 && code <= 0x36f;

// The end of the run of marks that starts at `from`, which `text` holds up to `to`.
const markRunEnd = (text: string, from: number, to: number): number => {
  let end = from;
  while (end < to && isMark(text.charCodeAt(end))) end += 1;
  return end;
};

// A run of `count` marks reaches `count + 1` levels below the level that holds it: one per accent,
// and one for the script that the marked character may be the argument of. The run is a token.
const reach = (state: State, count: number): void => {
  if (count + 1 > (state.inners[top(state)] ?? 0)) state.inners[top(state)] = count + 1;
};

const takeMarks = (state: State, count: number): void => {
  take(state, "other");
  reach(state, count);
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
    } else if (isMark(text.charCodeAt(at))) {
      // Reached, not taken: a comment is no token, so a script that waits keeps waiting.
      const end = markRunEnd(text, at, to);
      reach(state, end - at);
      at = end;
    } else {
      if (char === "{") take(state, "open");
      else if (char === "^" || char === "_") take(state, "script");
      at += 1;
    }
  }
};

// The first control word the check refuses, wherever it stands, a comment included: one that
// defines a macro, holds `@`, or reads the token after it raw (`\show`).
const noteRefused = (state: State, word: string): void => {
  if (state.refused !== undefined) return;
  if (DEFINING.has(word) || word.includes("@") || LATEX_RAW_TOKEN_COMMANDS[word] === "refused") {
    state.refused = word;
  }
};

// `\char` and a backquote, after blanks and comments, which KaTeX's lexer does not read: refused as
// the word and its backquote.
const noteCharCode = (text: string, end: number, state: State): void => {
  if (state.refused === undefined && text[skipBlanksAndComments(text, end)] === "`") {
    state.refused = "\\char`";
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
  if (LATEX_RAW_TOKEN_COMMANDS[word] === "refusedWithBackquote") noteCharCode(text, end, state);
  return end;
};

/**
 * What `text` holds that a LaTeX item may not (design decisions 3 and 7). Control words are read
 * as KaTeX's lexer reads them: a backslash then `[A-Za-z@]+` is a control word (`\default`
 * is a word of its own, `\left` is not `\let`); any other backslash and the one character after it
 * is a control symbol (`\\`, the line break, is one symbol, so `\\def` is a line break and the text
 * `def`; `\{` is no level). `refused` is the first control word that defines a macro (one of
 * `LATEX_DEFINING_COMMANDS`), holds `@`, or is `\show` or `\char` before a backquote (below): KaTeX
 * also defines macros by side effect (`\tag` defines `\df@tag`, `\color` defines `\current@color`)
 * and its lexer lets the source call them, so every word of its internal namespace is refused.
 * `depth` is the most levels open at once, as KaTeX nests them: a level opens at `{` and at the
 * control words of `LATEX_LEVEL_OPENERS`, closes at `}` and at those of `LATEX_LEVEL_CLOSERS`, and
 * `^` and `_` open one for their argument, which closes with the group that opens next, else after
 * the next token. An infix command (one of `LATEX_INFIX_COMMANDS`) makes a fraction of its group, so
 * it adds a level to the group that holds it, the expression included. A run of n stacked combining
 * marks (U+0300 to U+036F) reaches n + 1 levels below the level that holds it, in a comment and in a
 * `\verb` body too (latex-public-api). A brace KaTeX reads as text closes nothing: in a comment and
 * in a `\verb` body. `\show` and `\char` with a backquote take the next token whole, a `\verb|}|` token
 * included, which this reading does not follow, so they are `refused` by name (4.19 re-review X-1).
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
    } else if (isMark(text.charCodeAt(at))) {
      const end = markRunEnd(text, at, text.length);
      takeMarks(state, end - at);
      at = end;
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
