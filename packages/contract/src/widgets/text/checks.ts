// The Text's check (atoms, design decision 1): its props' limits, restated plain for the
// component. Plain ECMAScript with no JSON and no Ajv: the text chunk bundles it. Nothing here
// throws on a value it cannot read; it gives a problem for it.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { codePointCount } from "../shared/atoms.ts";
import { TEXT_FORMATS, TEXT_MAX_CHARS } from "./constants.ts";

/**
 * What is wrong with a Text's props, the schema's rules restated: an object holding `text` of 1 to
 * `TEXT_MAX_CHARS` code points, an optional `format` that is `plain` or `markdown`, and no other
 * key.
 */
export const textPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Text's props are an object {text, format?}" }];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => key !== "text" && key !== "format")
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const { text, format } = props;
  if (typeof text !== "string") {
    problems.push({ path: "/text", message: "the text is a text of 1 or more characters" });
  } else {
    const count = codePointCount(text);
    if (count < 1 || count > TEXT_MAX_CHARS) {
      problems.push({
        path: "/text",
        message: `the text has ${count} characters, and a Text holds 1 to ${TEXT_MAX_CHARS}`,
      });
    }
  }
  if (format !== undefined && !(TEXT_FORMATS as readonly unknown[]).includes(format)) {
    problems.push({ path: "/format", message: `the format is "plain" or "markdown"` });
  }
  return problems;
};
