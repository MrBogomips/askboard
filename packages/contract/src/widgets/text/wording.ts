// How a request's wording reads a Text's props (atoms, design decision 1): the expected shape and
// the field list of its one object, keyed `text.props…`. Nothing here validates.

import { text } from "../wording-parts.ts";
import { TEXT_MAX_CHARS } from "./constants.ts";

export const TEXT_EXPECTED: Readonly<Record<string, string>> = {
  "text.props": "a Text's props {text, format?}",
  "text.props.text": text(TEXT_MAX_CHARS),
  "text.props.format": '"plain" (the default) or "markdown"',
};

export const TEXT_FIELDS: Readonly<Record<string, string>> = {
  "text.props": "a Text's props hold only text and format",
};
