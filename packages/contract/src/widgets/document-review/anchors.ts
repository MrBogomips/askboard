// Placing and quoting (document-review, design decision 4; contract spec: A quote's place in a text,
// Quoting a passage): the one rule that places a quote in a text, and the quote a passage of a text
// gets, the two agreeing by construction. Positions are UTF-16 indices of the text, as the DOM
// gives them, and a boundary never splits a surrogate pair. Plain ECMAScript with no JSON, no Ajv
// and no regular expression: a quote's text is agent or user text, and every search is
// `indexOf`, which stops at the second occurrence. Nothing here throws on a value it cannot read.

import {
  type DocumentReviewQuote,
  QUOTE_CONTEXT_STEPS,
  QUOTE_EXACT_MAX_CHARS,
} from "./constants.ts";

/** Why a quote has no place: it occurs nowhere, or more than once. */
export type PlaceRefusal = "missing" | "ambiguous";

/** The place of a quote: where its `exact` stands, as UTF-16 indices `[start, end)`. */
export type QuotePlace =
  | { readonly ok: true; readonly start: number; readonly end: number }
  | { readonly ok: false; readonly reason: PlaceRefusal };

/** Why a passage cannot be quoted: it is blank, over the bound, or cannot be told apart. */
export type QuoteRefusal = "blank" | "too-long" | "repeated";

export type QuoteResult =
  | { readonly ok: true; readonly quote: DocumentReviewQuote }
  | { readonly ok: false; readonly reason: QuoteRefusal };

/** An annotation's place in a text, or why it is detached, in the order the annotations came. */
export type AnnotationPlace =
  | { readonly id: string; readonly status: "placed"; readonly start: number; readonly end: number }
  | {
      readonly id: string;
      readonly status: "detached";
      readonly reason: PlaceRefusal | "overlaps";
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isHigh = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;
const isLow = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

// The position of the code point `count` code points before `from`, or the text's start.
const backBy = (text: string, from: number, count: number): number => {
  let at = from;
  for (let taken = 0; taken < count && at > 0; taken += 1) {
    at -= isLow(text.charCodeAt(at - 1)) && at > 1 && isHigh(text.charCodeAt(at - 2)) ? 2 : 1;
  }
  return at;
};

// The position of the code point `count` code points after `from`, or the text's end.
const forwardBy = (text: string, from: number, count: number): number => {
  let at = from;
  for (let taken = 0; taken < count && at < text.length; taken += 1) {
    at +=
      isHigh(text.charCodeAt(at)) && at + 1 < text.length && isLow(text.charCodeAt(at + 1)) ? 2 : 1;
  }
  return at;
};

// Whether `text` holds more than `max` code points, counted up to `max` + 1.
const holdsMore = (text: string, max: number): boolean => {
  let count = 0;
  for (const _ of text) {
    count += 1;
    if (count > max) return true;
  }
  return false;
};

/**
 * The place of `quote` in `text`: its `prefix`, `exact` and `suffix`, joined, must occur exactly
 * once (overlapping occurrences counted), and the place is that occurrence's `exact`. A quote that
 * occurs nowhere is `missing`, one that occurs more than once `ambiguous`, and neither has a
 * place. A quote that is not a quote, or whose `exact` is empty, is `missing`.
 */
export const placeQuote = (text: string, quote: unknown): QuotePlace => {
  const missing: QuotePlace = { ok: false, reason: "missing" };
  if (!isRecord(quote) || typeof quote.exact !== "string" || quote.exact === "") return missing;
  const { exact, prefix, suffix } = quote;
  if (prefix !== undefined && typeof prefix !== "string") return missing;
  if (suffix !== undefined && typeof suffix !== "string") return missing;
  const before = prefix ?? "";
  const joined = `${before}${exact}${suffix ?? ""}`;
  const first = text.indexOf(joined);
  if (first < 0) return missing;
  if (text.indexOf(joined, first + 1) >= 0) return { ok: false, reason: "ambiguous" };
  const start = first + before.length;
  return { ok: true, start, end: start + exact.length };
};

// Whether the joined quote occurs exactly once in the text.
const occursOnce = (text: string, joined: string): boolean => {
  const first = text.indexOf(joined);
  return first >= 0 && text.indexOf(joined, first + 1) < 0;
};

/**
 * The quote of the passage `[start, end)` of `text`: its exact text with up to 32 code points of
 * context on each side, widened to 64, 128 and 200 until the joined quote occurs once, so that
 * `placeQuote` gives the passage back. Offsets are cut to the text and a boundary inside a
 * surrogate pair moves out to hold the whole character. A passage that is blank or longer than
 * 2,000 code points, or that occurs more than once with 200 code points of context, is refused.
 */
export const quotePassage = (text: string, start: number, end: number): QuoteResult => {
  if (Number.isNaN(start) || Number.isNaN(end)) return { ok: false, reason: "blank" };
  let from = Math.min(Math.max(Math.trunc(start), 0), text.length);
  let to = Math.min(Math.max(Math.trunc(end), 0), text.length);
  if (from > 0 && isLow(text.charCodeAt(from)) && isHigh(text.charCodeAt(from - 1))) from -= 1;
  if (to < text.length && isLow(text.charCodeAt(to)) && isHigh(text.charCodeAt(to - 1))) to += 1;
  const exact = to > from ? text.slice(from, to) : "";
  if (exact.trim() === "") return { ok: false, reason: "blank" };
  if (holdsMore(exact, QUOTE_EXACT_MAX_CHARS)) return { ok: false, reason: "too-long" };
  let known = -1;
  for (const size of QUOTE_CONTEXT_STEPS) {
    const before = backBy(text, from, size);
    const after = forwardBy(text, to, size);
    // The context stopped growing at both ends of the text: a wider one is the same quote.
    if (before === 0 && after === text.length && known === 0) break;
    known = before === 0 && after === text.length ? 0 : 1;
    const prefix = text.slice(before, from);
    const suffix = text.slice(to, after);
    if (occursOnce(text, `${prefix}${exact}${suffix}`)) {
      return {
        ok: true,
        quote: {
          type: "quote",
          exact,
          ...(prefix === "" ? {} : { prefix }),
          ...(suffix === "" ? {} : { suffix }),
        },
      };
    }
  }
  return { ok: false, reason: "repeated" };
};

/**
 * The place of each annotation in `text`, in the order given, or why it has none. Of two whose
 * places overlap, the later in the list is detached as `overlaps`; a detached annotation holds no
 * place, so a later one overlapping only it is placed. An annotation that is not one with a quote
 * is `missing`.
 */
export const placeAnnotations = (
  text: string,
  annotations: readonly unknown[],
): readonly AnnotationPlace[] => {
  const held: { readonly start: number; readonly end: number }[] = [];
  return annotations.map((annotation): AnnotationPlace => {
    const record = isRecord(annotation) ? annotation : {};
    const id = typeof record.id === "string" ? record.id : "";
    const selector = isRecord(record.target) ? record.target.selector : undefined;
    const place = placeQuote(text, selector);
    if (!place.ok) return { id, status: "detached", reason: place.reason };
    if (held.some((other) => place.start < other.end && other.start < place.end)) {
      return { id, status: "detached", reason: "overlaps" };
    }
    held.push({ start: place.start, end: place.end });
    return { id, status: "placed", start: place.start, end: place.end };
  });
};
