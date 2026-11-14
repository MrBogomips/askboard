// Test-only board documents and asks holding a Document review (document-review, task 6.1): the
// fixture Tree's question `plan` with the review as its item, as the agent sends it, for the widget
// host, and the same question as an ask for the session process.

import type { Locale } from "@askboard/contract";
import type { ViewDocument } from "../../../src/view-document.ts";
import { atomAsk, atomDocument } from "./atom-documents.ts";

export const REVIEW_ID = "review";
export const QUESTION_ID = "plan";

/** A short release note: a heading, two paragraphs (one with a link), a list. */
export const NOTES =
  "## Release 0.2\n\nThe board **remembers** drafts and keeps unsent answers.\n\nSee the [docs](https://example.com/docs) for more.\n\n- First item\n- Second item";

export const reviewItem = (markdown: string, title?: string, id = REVIEW_ID) => ({
  type: "document-review",
  id,
  props: { markdown, ...(title === undefined ? {} : { title }) },
});

/** The question `plan` holding one Document review, in `language` (en-US by default). */
export const reviewDocument = (
  markdown: string = NOTES,
  title?: string,
  language?: Locale,
): ViewDocument => atomDocument([reviewItem(markdown, title)], language);

/** The ask for the session process: the question `plan` holding the review. */
export const reviewAsk = (markdown: string = NOTES, title?: string) =>
  atomAsk([reviewItem(markdown, title)]);

/** One hundred distinct words, `w001` to `w100`: each is its own quote, with no context needed. */
export const HUNDRED_WORDS = Array.from(
  { length: 100 },
  (_, at) => `w${String(at + 1).padStart(3, "0")}`,
);
