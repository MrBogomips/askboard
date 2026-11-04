// Test-only board documents holding context items (excerpts, task 6.2; view spec, "Excerpts show
// as source text", "References open in one click", "Images by pointer"), shown on the widget host:
// an excerpt read from lines 40 to 52, a long one, a Markdown and a code excerpt with a line
// wider than the card, markup in every agent string, a bidirectional control in an excerpt's text,
// and a question holding one image. Each item's props are as ask-core resolves them.

import { contextBoardDocument, ONE_PIXEL_PNG } from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../../../src/view-document.ts";
import { MARKUP_LABEL } from "./markup-document.ts";

/** A context board document holding `questions`, each open at rev 1 unless it says otherwise. */
const boardOf = (...questions: readonly [ViewQuestion, ...ViewQuestion[]]): ViewDocument => ({
  version: contextBoardDocument.version,
  askId: contextBoardDocument.askId,
  title: contextBoardDocument.title,
  items: questions,
});

const questionOf = (id: string, text: string, items: readonly WidgetItem[]): ViewQuestion => ({
  type: "question",
  id,
  rev: 1,
  props: { text, items },
});

/** A resolved excerpt read from `start` on, its lines `lines`. */
const excerptOf = (
  id: string,
  pointer: string,
  mediaType: "text/markdown" | "text/plain",
  start: number,
  lines: readonly string[],
  title?: string,
): WidgetItem => ({
  type: "excerpt",
  id,
  props: {
    pointer,
    ...(title === undefined ? {} : { title }),
    status: "resolved",
    text: lines.join("\n"),
    mediaType,
    lines: { start, end: start + lines.length - 1 },
  },
});

/** The thirteen lines of UJ-4's sample excerpt, lines 40 to 52 of the checkout spec. */
export const CHECKOUT_LINES: readonly string[] = [
  "### 3.2 Order creation",
  "",
  "An order is created only after the payment gateway",
  "authorizes the payment.",
  "",
  "1. The client posts the cart to `/orders`.",
  "2. The service asks the gateway for an authorization.",
  "3. On `authorized`, the order is stored as `pending`.",
  "4. On `declined`, no order is stored.",
  "",
  "A timeout counts as `declined`, and the client may",
  "retry with the same idempotency key.",
  "",
];

export const CHECKOUT_POINTER = "docs/specs/checkout.md#L40-L52";
export const CHECKOUT_TITLE = "Checkout spec · Order creation";

/** UJ-4's excerpt: its caption and its body numbered from 40 to 52. */
export const checkoutDocument = boardOf(
  questionOf("checkout", "Is the checkout flow correct as drawn?", [
    excerptOf("order-spec", CHECKOUT_POINTER, "text/markdown", 40, CHECKOUT_LINES, CHECKOUT_TITLE),
  ]),
);

/** A 200-line excerpt, past `{spacing.excerpt-max-height}`. */
export const longDocument = boardOf(
  questionOf("long", "Is this retry loop right?", [
    excerptOf(
      "long-source",
      "src/retry.ts#L1-L200",
      "text/plain",
      1,
      Array.from({ length: 200 }, (_, at) => `retry(${at + 1});`),
    ),
  ]),
);

// A line far wider than the card at the code type's size.
const WIDE = Array.from({ length: 60 }, (_, at) => `word${at}`).join(" ");

/** A Markdown and a code excerpt, each with one short line, one wide line, then a short line. */
export const wrapDocument = boardOf(
  questionOf("wrap", "Do these read well?", [
    excerptOf("prose", "docs/notes.md#L1-L3", "text/markdown", 1, ["Short.", WIDE, "End."]),
    excerptOf("code", "src/wide.ts#L1-L3", "text/plain", 1, ["short();", WIDE, "end();"]),
  ]),
);

/** Markup in an excerpt's text, title and pointer, a reference's, and two images' alt texts. */
export const markupContextDocument = boardOf(
  questionOf("markup", "Is this safe?", [
    excerptOf(
      "markup-excerpt",
      `docs/${MARKUP_LABEL}.md#L1-L2`,
      "text/markdown",
      1,
      [MARKUP_LABEL, "<b>bold</b><script>document.title='owned'</script>"],
      MARKUP_LABEL,
    ),
    {
      type: "reference",
      id: "markup-file",
      props: { pointer: `src/${MARKUP_LABEL}.ts`, kind: "file", status: "resolved" },
    },
    {
      type: "reference",
      id: "markup-web",
      props: { url: "https://example.com/a", title: MARKUP_LABEL, kind: "web" },
    },
    {
      type: "image",
      id: "markup-shown",
      props: {
        pointer: ".askboard/media/shot.png",
        alt: MARKUP_LABEL,
        status: "resolved",
        mediaType: "image/png",
        bytes: ONE_PIXEL_PNG,
      },
    },
    {
      type: "image",
      id: "markup-missing",
      props: {
        pointer: `.askboard/${MARKUP_LABEL}.png`,
        alt: MARKUP_LABEL,
        status: "unresolved",
        reason: "not-found",
      },
    },
  ]),
);

/** A line holding U+202E, which would show `admin` reversed as `nimda` and hide the comment. */
export const BIDI_LINE = 'const role = "user\u202E // admin";';

export const bidiDocument = boardOf(
  questionOf("bidi", "Is this access check right?", [
    excerptOf("bidi-source", "src/access.ts#L7-L7", "text/plain", 7, [BIDI_LINE]),
  ]),
);

/** The image item `screenshot` alone in its question. */
export const screenshot: WidgetItem = {
  type: "image",
  id: "screenshot",
  props: {
    pointer: ".askboard/media/shot.png",
    alt: "The retry log",
    status: "resolved",
    mediaType: "image/png",
    bytes: ONE_PIXEL_PNG,
  },
};

export const imageDocument = boardOf(
  questionOf("shot", "Does the log show the retries?", [screenshot]),
);

/** The image's question at rev 2, a written excerpt in the image's place: the agent removed it. */
export const imageRemovedDocument = boardOf({
  ...questionOf("shot", "Does the log show the retries?", [
    { type: "excerpt", id: "log-note", props: { text: "retried 3 times", title: "Log" } },
  ]),
  rev: 2,
});
