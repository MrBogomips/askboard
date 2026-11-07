// The LaTeX's one check (latex-kanban-timeline, design decision 3): its props' limits, restated
// plain for the component, which throws on a problem. The contract never parses an expression: a
// parse is KaTeX's, the board's.
//
// Plain ECMAScript with no JSON and no Ajv: the latex chunk bundles it. Nothing here throws on a
// value it cannot read; it gives a problem for it.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { LATEX_DEFINING_COMMANDS, LATEX_EXPRESSION_MAX_CHARS } from "./constants.ts";

/**
 * What is wrong with a LaTeX's props, the schema's rules restated: an object holding `expression`,
 * a text of at most `LATEX_EXPRESSION_MAX_CHARS` code points holding no macro definition and no
 * KaTeX internal command, and no other key. The registry runs it after the schema, so it gives
 * nothing for a value the schema passed that has neither.
 */
export const latexPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a LaTeX's props are an object {expression}" }];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => key !== "expression")
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const { expression } = props;
  if (typeof expression !== "string") {
    problems.push({ path: "/expression", message: "the expression is a text" });
  } else {
    const count = codePointCount(expression);
    if (count > LATEX_EXPRESSION_MAX_CHARS) {
      problems.push({
        path: "/expression",
        message: `the expression has ${count} characters, more than the limit of ${LATEX_EXPRESSION_MAX_CHARS}`,
      });
    } else {
      // Only within the limit, so that the scan reads a bounded text.
      const { refused } = scanLatex(expression);
      if (refused !== undefined) {
        problems.push({ path: "/expression", message: refusedMessage(refused) });
      }
    }
  }
  return problems;
};

/** The length in code points; UTF-16 units are never fewer, so a text within the limit skips the walk. */
const codePointCount = (text: string): number =>
  text.length <= LATEX_EXPRESSION_MAX_CHARS ? text.length : [...text].length;

/**
 * The text cut to its first `LATEX_EXPRESSION_MAX_CHARS` code points, never inside a surrogate
 * pair: the board's source field keeps this much of a paste.
 */
export const cutLatexExpression = (text: string): string =>
  text.length <= LATEX_EXPRESSION_MAX_CHARS
    ? text
    : [...text].slice(0, LATEX_EXPRESSION_MAX_CHARS).join("");

const DEFINING: ReadonlySet<string> = new Set(LATEX_DEFINING_COMMANDS);

/** What the scan found in an expression. */
export type LatexScan = {
  /** The first control word that defines a macro or holds `@`, else nothing. */
  readonly refused: string | undefined;
};

// A definition names itself; any other refused word holds `@`, KaTeX's internal namespace.
const refusedMessage = (word: string): string =>
  DEFINING.has(word)
    ? `the expression defines a macro with \`${word}\`, which a LaTeX item does not allow`
    : `the expression names \`${word}\`, one of KaTeX's internal commands, which a LaTeX item does not allow`;

// A letter of a control word in KaTeX's lexer: `[A-Za-z@]`.
const isControlLetter = (code: number): boolean =>
  (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x40;

/**
 * What `text` holds that a LaTeX item may not (design decisions 3 and 7). Control words are read
 * as KaTeX 0.19.1's lexer reads them: a backslash then `[A-Za-z@]+` is a control word (`\default`
 * is a word of its own, `\left` is not `\let`); any other backslash and the one character after it
 * is a control symbol (`\\`, the line break, is one symbol, so `\\def` is a line break and the text
 * `def`). `refused` is the first control word that defines a macro (one of
 * `LATEX_DEFINING_COMMANDS`) or holds `@`: KaTeX also defines macros by side effect (`\tag` defines
 * `\df@tag`, `\color` defines `\current@color`) and its lexer lets the source call them, so every
 * word of its internal namespace is refused. One pass, each character read once, with no nested
 * quantifier. A comment or a `\verb` is not skipped: a command named in one is refused as well,
 * which only refuses more.
 */
export const scanLatex = (text: string): LatexScan => {
  let refused: string | undefined;
  let at = text.indexOf("\\");
  while (at !== -1 && refused === undefined) {
    let end = at + 1;
    while (end < text.length && isControlLetter(text.charCodeAt(end))) end += 1;
    if (end === at + 1) {
      at = text.indexOf("\\", at + 2);
    } else {
      const word = text.slice(at, end);
      if (DEFINING.has(word) || word.includes("@")) refused = word;
      at = text.indexOf("\\", end);
    }
  }
  return { refused };
};
