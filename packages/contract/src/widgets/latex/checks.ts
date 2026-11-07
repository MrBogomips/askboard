// The LaTeX's one check (latex-kanban-timeline, design decision 3): its props' limits, restated
// plain for the component, which throws on a problem. The contract never parses an expression: a
// parse is KaTeX's, the board's.
//
// Plain ECMAScript with no JSON and no Ajv: the latex chunk bundles it. Nothing here throws on a
// value it cannot read; it gives a problem for it.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import {
  LATEX_DEFINING_COMMANDS,
  LATEX_EXPRESSION_MAX_CHARS,
  LATEX_NESTING_MAX_DEPTH,
} from "./constants.ts";
import { scanLatex } from "./scan.ts";

/**
 * What is wrong with a LaTeX's props, the schema's rules restated: an object holding `expression`,
 * a text of at most `LATEX_EXPRESSION_MAX_CHARS` code points holding no macro definition, no
 * KaTeX internal command and no nest deeper than `LATEX_NESTING_MAX_DEPTH`, and no other key. The registry runs it after the schema, so it gives
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
      const { refused, depth } = scanLatex(expression);
      if (refused !== undefined) {
        problems.push({ path: "/expression", message: refusedMessage(refused) });
      } else if (depth > LATEX_NESTING_MAX_DEPTH) {
        problems.push({
          path: "/expression",
          message: `the expression nests ${depth} levels deep, more than the limit of ${LATEX_NESTING_MAX_DEPTH}`,
        });
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

// A definition names itself, `\show` and a character code given by a backquote are named as they
// are written, and any other refused word holds `@`, KaTeX's internal namespace.
const refusedMessage = (word: string): string => {
  if (LATEX_DEFINING_COMMANDS.includes(word)) {
    return `the expression defines a macro with \`${word}\`, which a LaTeX item does not allow`;
  }
  if (word === "\\show") {
    return `the expression uses \`${word}\`, which a LaTeX item does not allow`;
  }
  if (word === "\\char`") {
    return `the expression uses \`\`${word} \`\`, which a LaTeX item does not allow`;
  }
  return `the expression names \`${word}\`, one of KaTeX's internal commands, which a LaTeX item does not allow`;
};
