// The Document review's registry entry (document-review, design decisions 1, 3 and 11): its props
// and result schemas, checks, wording and example. Its teaching text comes with task 1.5.
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
};
