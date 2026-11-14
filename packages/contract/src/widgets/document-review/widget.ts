// The Document review's registry entry (document-review, design decisions 1, 3 and 11): its props
// and result schemas, checks, wording, example and teaching text.
// It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module (the registry's
// import rule). It edits nothing and derives nothing.

import type { WidgetType } from "../registry.ts";
import { documentReviewPropsProblems } from "./checks.ts";
import documentReviewProps from "./document-review-props.json" with { type: "json" };
import documentReviewResult from "./document-review-result.json" with { type: "json" };
import { documentReviewResultProblems, documentReviewResultShape } from "./result-checks.ts";
import { DOCUMENT_REVIEW_EXPECTED, DOCUMENT_REVIEW_FIELDS } from "./wording.ts";

export const DOCUMENT_REVIEW_WIDGET: WidgetType = {
  type: "document-review",
  noun: "a Document review",
  props: documentReviewProps,
  propsProblems: documentReviewPropsProblems,
  result: {
    schema: documentReviewResult,
    shape: documentReviewResultShape,
    problems: documentReviewResultProblems,
  },
  wording: { expected: DOCUMENT_REVIEW_EXPECTED, fields: DOCUMENT_REVIEW_FIELDS },
  example: {
    item: {
      type: "document-review",
      id: "release-notes",
      props: {
        markdown: "## Release 0.2\n\nThe board **remembers** drafts.",
        title: "Release notes",
      },
    },
  },
  help: {
    mouse:
      "Select a passage of the document and press Comment or Suggest edit; click a pin to read, edit or delete its note.",
    answer: "The agent receives each comment and suggested edit with the passage it is about.",
  },
  skill: {
    use: "a Markdown document the user comments on and suggests edits to",
    notes: [
      "`markdown` is the document, at most 10,000 characters with no control or bidirectional formatting character (such as U+200E, U+200F, U+061C) but line feeds and tabs; send a longer one as one item per section. `title` is optional.",
      "The result is `annotations`, each a `quote` selector (`exact`, `prefix`, `suffix`) and a body with `text` (a comment), `replacement` (a suggested edit) or both. A quote is the text as the board shows it, Markdown marks removed.",
      "`replacement` replaces `exact`, and an empty one deletes it. If you cannot find a quote in your Markdown, ask the user; never guess.",
      "An untouched item gives no result, so give the question options or another widget that answers.",
    ],
  },
};
