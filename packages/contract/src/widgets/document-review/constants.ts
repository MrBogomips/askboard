// The Document review's constants and types (document-review, design decision 1): the limits of
// its props, the schemas' IDs and the shapes of an item. Each frozen constant is marked pure, so
// that a view chunk drops those it does not use.

import { TEXT_MAX_CHARS } from "../text/constants.ts";

/** A document holds 1 to this many code points: the Markdown renderer's own bound. */
export const DOCUMENT_REVIEW_MAX_CHARS = TEXT_MAX_CHARS;

/** A title holds 1 to this many code points, as a Chart's does. */
export const DOCUMENT_REVIEW_TITLE_MAX_CHARS = 120;

/** A result holds 1 to this many annotations (design decision 3). */
export const DOCUMENT_REVIEW_ANNOTATIONS_MAX = 100;

export const DOCUMENT_REVIEW_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:document-review-props",
  result: "urn:askboard:output:document-review-result",
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

/** The quote selector of a Document review's annotation: the passage and its context. */
export type DocumentReviewQuote = {
  readonly type: "quote";
  readonly exact: string;
  readonly prefix?: string;
  readonly suffix?: string;
};

/**
 * One annotation of a result: a comment (`text`), a suggested edit (`replacement`, empty to delete
 * the passage) or both, on a quoted passage; its ID is the view's (`u-` and a number).
 */
export type DocumentReviewAnnotation = {
  readonly id: string;
  readonly target: { readonly selector: DocumentReviewQuote };
  readonly body: { readonly text?: string; readonly replacement?: string };
};

/** A Document review's result: the user's annotations, in the order the user made them. */
export type DocumentReviewResult = {
  readonly annotations: readonly DocumentReviewAnnotation[];
};
