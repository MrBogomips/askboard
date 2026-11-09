// The Document review's fixtures (document-review, design decisions 3 and 11): `DOCUMENT_REVIEW_TYPES`,
// the entries a test gives the shipped registry through `withWidgetTypes` while the type is not
// registered, an item, a result of each kind, one answer holding a comment and a suggested edit
// (the act that sends it and the event that logs it) and what `fetch` returns for the item. Each
// takes its version from its constant. Tests only; no shipped unit imports them.

import { type ActCommand, BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import { RESULT_VERSIONS } from "../schemas/tool-envelopes/index.ts";
import type { DocumentReviewItem, DocumentReviewResult } from "../widgets/document-review/index.ts";
import { DOCUMENT_REVIEW_WIDGET } from "../widgets/document-review/widget.ts";
import type { WidgetType } from "../widgets/registry.ts";
import { RESULT_WIDGETS_SESSION } from "./approval-scale-ranking.ts";

/**
 * The Document review's entry. A test passes it to `withWidgetTypes(...DOCUMENT_REVIEW_TYPES)`; the
 * same test passes before and after the type joins `WIDGET_TYPES`.
 */
export const DOCUMENT_REVIEW_TYPES: readonly WidgetType[] = [DOCUMENT_REVIEW_WIDGET];

/** A document of a heading and a sentence, in which "remembers" and "drafts" each occur once. */
export const DOCUMENT_REVIEW_FIXTURE_ITEM: DocumentReviewItem = {
  type: "document-review",
  id: "release-notes",
  props: {
    markdown: "## Release 0.2\n\nThe board **remembers** drafts.",
    title: "Release notes",
  },
};

/** A comment alone, a comment and a suggested edit, and a deletion, as the user makes them. */
export const DOCUMENT_REVIEW_RESULTS = {
  comment: {
    annotations: [
      {
        id: "u-1",
        target: { selector: { type: "quote", exact: "remembers", prefix: "The board " } },
        body: { text: "Say how long." },
      },
    ],
  },
  commentAndEdit: {
    annotations: [
      {
        id: "u-1",
        target: {
          selector: { type: "quote", exact: "remembers", prefix: "The board ", suffix: " drafts." },
        },
        body: { text: "Say how long." },
      },
      {
        id: "u-2",
        target: { selector: { type: "quote", exact: "drafts" } },
        body: { replacement: "unsent answers" },
      },
    ],
  },
  deletion: {
    annotations: [
      {
        id: "u-1",
        target: { selector: { type: "quote", exact: "The board ", suffix: "remembers" } },
        body: { replacement: "", text: "Start with the verb." },
      },
    ],
  },
} as const satisfies Record<string, DocumentReviewResult>;

const SESSION = RESULT_WIDGETS_SESSION;
const WHEN = "2026-11-08T09:30:00Z";

/** The act that sends a comment and a suggested edit. */
export const documentReviewAct: ActCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId: "tR3mB8vKq2NxD6wYe1aJcZ",
  acts: [
    {
      type: "answer",
      itemId: SESSION.question,
      rev: 1,
      results: { [DOCUMENT_REVIEW_FIXTURE_ITEM.id]: DOCUMENT_REVIEW_RESULTS.commentAndEdit },
      when: WHEN,
    },
  ],
};

/** The event that logs the comment and the suggested edit. */
export const documentReviewAnswerEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: "Sara Conti",
  when: WHEN,
  results: { [DOCUMENT_REVIEW_FIXTURE_ITEM.id]: DOCUMENT_REVIEW_RESULTS.commentAndEdit },
};

/** What `fetch` returns for the item alone: its props and its latest answer's annotations. */
export const documentReviewFetchItemResult: Readonly<Record<string, unknown>> = {
  versions: RESULT_VERSIONS,
  epoch: SESSION.epoch,
  askId: SESSION.askId,
  state: "answered",
  item: {
    ...DOCUMENT_REVIEW_FIXTURE_ITEM,
    questionId: SESSION.question,
    state: "answered",
    result: DOCUMENT_REVIEW_RESULTS.commentAndEdit,
  },
  unchecked: true,
};
