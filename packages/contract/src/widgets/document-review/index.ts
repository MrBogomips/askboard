// The Document review (FR-11, document-review): a Markdown document the user comments on and
// suggests edits to. Its schemas are standalone: they belong to no schema set until the entry is
// registered (design decision 11), and nothing compiles them when this module loads.

export {
  type AnnotationPlace,
  type PlaceRefusal,
  placeAnnotations,
  placeQuote,
  type QuotePlace,
  type QuoteRefusal,
  type QuoteResult,
  quotePassage,
} from "./anchors.ts";
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
  QUOTE_CONTEXT_CHARS,
  QUOTE_CONTEXT_MAX_CHARS,
  QUOTE_CONTEXT_STEPS,
  QUOTE_EXACT_MAX_CHARS,
} from "./constants.ts";
export { documentReviewResultProblems, documentReviewResultShape } from "./result-checks.ts";
export { DOCUMENT_REVIEW_WIDGET } from "./widget.ts";
