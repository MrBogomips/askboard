// The Document review (FR-11, document-review): a Markdown document the user comments on and
// suggests edits to. Its schemas are standalone: they belong to no schema set until the entry is
// registered (design decision 11), and nothing compiles them when this module loads.

export { documentReviewPropsProblems } from "./checks.ts";
export {
  DOCUMENT_REVIEW_ANNOTATIONS_MAX,
  DOCUMENT_REVIEW_MAX_CHARS,
  DOCUMENT_REVIEW_SCHEMA_IDS,
  DOCUMENT_REVIEW_TITLE_MAX_CHARS,
  type DocumentReviewAnnotation,
  type DocumentReviewItem,
  type DocumentReviewProps,
  type DocumentReviewQuote,
  type DocumentReviewResult,
} from "./constants.ts";
export { documentReviewResultProblems, documentReviewResultShape } from "./result-checks.ts";
export { DOCUMENT_REVIEW_WIDGET } from "./widget.ts";
