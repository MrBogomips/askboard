// The Document review's registry entry (document-review, design decisions 1 and 11): its props
// schema, checks, wording and example. Its result and teaching text come with tasks 1.3 and 1.5.
// It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module (the registry's
// import rule). It edits nothing and derives nothing.

import type { WidgetType } from "../registry.ts";
import { documentReviewPropsProblems } from "./checks.ts";
import documentReviewProps from "./document-review-props.json" with { type: "json" };
import { DOCUMENT_REVIEW_EXPECTED, DOCUMENT_REVIEW_FIELDS } from "./wording.ts";

export const DOCUMENT_REVIEW_WIDGET: WidgetType = {
  type: "document-review",
  noun: "a Document review",
  props: documentReviewProps,
  propsProblems: documentReviewPropsProblems,
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
