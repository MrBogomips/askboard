// How a request's wording reads a Document review's props (document-review, design decision 1): the
// expected shape and the field list of its one object, keyed `document-review.props…`. Nothing here
// validates.

import { text } from "../wording-parts.ts";
import { DOCUMENT_REVIEW_MAX_CHARS, DOCUMENT_REVIEW_TITLE_MAX_CHARS } from "./constants.ts";

export const DOCUMENT_REVIEW_EXPECTED: Readonly<Record<string, string>> = {
  "document-review.props": "a Document review's props {markdown, title?}",
  "document-review.props.markdown": `${text(DOCUMENT_REVIEW_MAX_CHARS)} of Markdown, with no control or bidirectional character but line feeds and tabs`,
  "document-review.props.title": text(DOCUMENT_REVIEW_TITLE_MAX_CHARS),
};

export const DOCUMENT_REVIEW_FIELDS: Readonly<Record<string, string>> = {
  "document-review.props": "a Document review's props hold only markdown and title",
};
