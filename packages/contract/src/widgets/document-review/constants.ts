// The Document review's constants and types (document-review, design decision 1): the limits of
// its props, the schemas' IDs and the shapes of an item. Each frozen constant is marked pure, so
// that a view chunk drops those it does not use.

import { TEXT_MAX_CHARS } from "../text/constants.ts";

/** A document holds 1 to this many code points: the Markdown renderer's own bound. */
export const DOCUMENT_REVIEW_MAX_CHARS = TEXT_MAX_CHARS;

/** A title holds 1 to this many code points, as a Chart's does. */
export const DOCUMENT_REVIEW_TITLE_MAX_CHARS = 120;

export const DOCUMENT_REVIEW_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:document-review-props",
} as const);

export type DocumentReviewProps = {
  /** The document: Markdown, with no control or bidirectional character but line feeds and tabs. */
  readonly markdown: string;
  readonly title?: string;
};

export type DocumentReviewItem = {
  readonly type: "document-review";
  readonly id: string;
  readonly props: DocumentReviewProps;
};
