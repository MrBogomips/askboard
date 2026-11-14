// What the board page opens for a link in Markdown (atoms, design decision 6; AD-8): the URL is agent
// content the user chose to open, as a web reference's is, so the page opens it only when it is an
// `http:` or `https:` URL with no user name or password, of at most `LINK_URL_MAX_CHARS`
// characters with no space or control character, and the item the message names holds Markdown in the board document the page holds: a
// Text whose `format` is `markdown`, a Document review, or a question with an option whose preview is Markdown. The
// message's own claim about the item counts for nothing.

import { isLinkUrl, LINK_URL_MAX_CHARS } from "@askboard/contract";
import { questionsOf, type ViewDocument } from "../view-document.ts";
import { boardItemOf } from "./references.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// A Text with `format: "markdown"`, as the board document holds it.
const isMarkdownText = (document: ViewDocument, itemId: string): boolean => {
  const item = boardItemOf(document, itemId);
  return (
    item?.type === "text" &&
    isRecord(item.props) &&
    Object.hasOwn(item.props, "format") &&
    item.props.format === "markdown"
  );
};

// A Document review whose props hold a document, as the board document holds it (document-review,
// design decision 10): its Markdown is the item's own, found at any depth of the layouts.
const isReviewedDocument = (document: ViewDocument, itemId: string): boolean => {
  const item = boardItemOf(document, itemId);
  return (
    item?.type === "document-review" &&
    isRecord(item.props) &&
    Object.hasOwn(item.props, "markdown") &&
    typeof item.props.markdown === "string" &&
    item.props.markdown !== ""
  );
};

// A question whose option shows a Markdown preview: a `preview` with `previewFormat: "markdown"`.
const hasMarkdownPreview = (document: ViewDocument, itemId: string): boolean =>
  questionsOf(document)
    .filter((question) => question.id === itemId)
    .some((question) =>
      (question.props.options ?? []).some(
        (option) =>
          option.previewFormat === "markdown" &&
          typeof option.preview === "string" &&
          option.preview !== "",
      ),
    );

/**
 * Whether the item holds Markdown in the board document: a Text, a Document review, or a
 * question's option preview.
 */
export const holdsMarkdown = (document: ViewDocument | undefined, itemId: string): boolean =>
  document !== undefined &&
  (isMarkdownText(document, itemId) ||
    isReviewedDocument(document, itemId) ||
    hasMarkdownPreview(document, itemId));

/** Whether the page opens the URL: the contract's one link check, which the view applies too. */
export const isOpenableUrl = isLinkUrl;

/**
 * Why the page does not open this link, in words that carry no agent text, or `undefined` when it
 * does: the URL first, then the item.
 */
export const openLinkRefusal = (
  document: ViewDocument | undefined,
  itemId: string,
  url: string,
): string | undefined => {
  if (!isOpenableUrl(url)) {
    return `the URL is no http or https link of at most ${LINK_URL_MAX_CHARS} characters`;
  }
  return holdsMarkdown(document, itemId)
    ? undefined
    : "the item holds no Markdown in the board document";
};
