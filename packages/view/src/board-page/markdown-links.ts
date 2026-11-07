// What the board page opens for a link in Markdown (atoms, design decision 6; AD-8): the URL is agent
// content the user chose to open, as a web reference's is, so the page opens it only when it is an
// `http:` or `https:` URL with no user name or password, of at most `OPEN_LINK_URL_MAX_CHARS`
// characters with no space or control character, and the item the message names holds Markdown in the board document the page holds: a
// Text whose `format` is `markdown`, or a question with an option whose preview is Markdown. The
// message's own claim about the item counts for nothing.

import { questionsOf, type ViewDocument } from "../view-document.ts";
import { OPEN_LINK_URL_MAX_CHARS } from "../view-protocol.ts";
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

/** Whether the item holds Markdown in the board document: a Text, or a question's option preview. */
export const holdsMarkdown = (document: ViewDocument | undefined, itemId: string): boolean =>
  document !== undefined &&
  (isMarkdownText(document, itemId) || hasMarkdownPreview(document, itemId));

// A space or a control character: C0, DEL and C1. markdown-it's links hold none, since it
// percent-encodes them; a browser would strip some of them and read the rest as a URL.
const hasBlankOrControl = (text: string): boolean =>
  Array.from(text).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x20 || (code >= 0x7f && code <= 0x9f);
  });

/**
 * Whether the URL is `http:` or `https:` with no user name or password, short enough and clean, as
 * `new URL` reads it.
 */
export const isOpenableUrl = (url: string): boolean => {
  if (url.length > OPEN_LINK_URL_MAX_CHARS || hasBlankOrControl(url)) return false;
  try {
    const { protocol, username, password } = new URL(url);
    return (protocol === "https:" || protocol === "http:") && username === "" && password === "";
  } catch {
    return false;
  }
};

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
    return `the URL is no http or https link of at most ${OPEN_LINK_URL_MAX_CHARS} characters`;
  }
  return holdsMarkdown(document, itemId)
    ? undefined
    : "the item holds no Markdown in the board document";
};
