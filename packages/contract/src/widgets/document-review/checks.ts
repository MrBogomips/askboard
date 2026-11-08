// The Document review's rules (document-review, design decision 1): its props' limits restated
// plain for the component, and the characters its document refuses. Plain ECMAScript with no JSON
// and no Ajv: the chunk bundles it. Nothing here throws on a value it cannot read; it gives a
// problem for it, and no character is looked up by a name an object inherits.

import { isRecord } from "../../problems.ts";
import { agentTextRuns, isEscapedCodePoint } from "../../push/notice-text.ts";
import type { Problem } from "../../validate.ts";
import { codePointCount } from "../shared/atoms.ts";
import { DOCUMENT_REVIEW_MAX_CHARS, DOCUMENT_REVIEW_TITLE_MAX_CHARS } from "./constants.ts";

const LINE_FEED = 0x0a;
const TAB = 0x09;

// The first character the renderer would show as an escape, as its escape, or none; a quote's text
// is held to the same rule as the document. A line feed and
// a tab are the document's own layout; every other one would show as six characters that a quote
// would then hold and the agent's source would not (design decision 1).
export const refusedCharacter = (markdown: string): string | undefined => {
  for (const point of markdown) {
    const code = point.codePointAt(0) ?? 0;
    if (code !== LINE_FEED && code !== TAB && isEscapedCodePoint(code)) {
      return agentTextRuns(point)[0]?.text;
    }
  }
  return undefined;
};

const markdownProblems = (markdown: unknown): readonly Problem[] => {
  if (typeof markdown !== "string") {
    return [{ path: "/markdown", message: "the markdown is a text of 1 or more characters" }];
  }
  const count = codePointCount(markdown);
  if (count < 1 || count > DOCUMENT_REVIEW_MAX_CHARS) {
    return [
      {
        path: "/markdown",
        message: `the markdown has ${count} characters, and a Document review holds 1 to ${DOCUMENT_REVIEW_MAX_CHARS}`,
      },
    ];
  }
  const refused = refusedCharacter(markdown);
  return refused === undefined
    ? []
    : [
        {
          path: "/markdown",
          message: `the markdown holds the control character ${refused}, which the board cannot show as it stands: only line feeds and tabs are allowed`,
        },
      ];
};

const titleProblems = (title: unknown): readonly Problem[] => {
  if (title === undefined) return [];
  if (typeof title !== "string") {
    return [{ path: "/title", message: "the title is a text of 1 or more characters" }];
  }
  const count = codePointCount(title);
  return count < 1 || count > DOCUMENT_REVIEW_TITLE_MAX_CHARS
    ? [
        {
          path: "/title",
          message: `the title has ${count} characters, and a title holds 1 to ${DOCUMENT_REVIEW_TITLE_MAX_CHARS}`,
        },
      ]
    : [];
};

/**
 * What is wrong with a Document review's props, the schema's rules restated and what the schema
 * cannot say: an object holding `markdown` of 1 to `DOCUMENT_REVIEW_MAX_CHARS` code points with no
 * control or bidirectional character but line feeds and tabs, an optional `title` of 1 to
 * `DOCUMENT_REVIEW_TITLE_MAX_CHARS`, and no other key.
 */
export const documentReviewPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Document review's props are an object {markdown, title?}" }];
  }
  const unknown: Problem[] = Object.keys(props)
    .filter((key) => key !== "markdown" && key !== "title")
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  return [...unknown, ...markdownProblems(props.markdown), ...titleProblems(props.title)];
};
