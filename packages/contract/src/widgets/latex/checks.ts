// The LaTeX's one check (latex-kanban-timeline, design decision 3): its props' limits, restated
// plain for the component, which throws on a problem. The contract never parses an expression: a
// parse is KaTeX's, the board's.
//
// Plain ECMAScript with no JSON and no Ajv: the latex chunk bundles it. Nothing here throws on a
// value it cannot read; it gives a problem for it.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { LATEX_DEFINING_COMMANDS, LATEX_EXPRESSION_MAX_CHARS } from "./constants.ts";
import { scanLatex } from "./scan.ts";

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

// A definition names itself; any other refused word holds `@`, KaTeX's internal namespace.
const refusedMessage = (word: string): string =>
  LATEX_DEFINING_COMMANDS.includes(word)
    ? `the expression defines a macro with \`${word}\`, which a LaTeX item does not allow`
    : `the expression names \`${word}\`, one of KaTeX's internal commands, which a LaTeX item does not allow`;
