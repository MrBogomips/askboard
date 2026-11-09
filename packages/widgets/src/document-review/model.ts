// The Document review's model (document-review, design decisions 3, 4, 8 and 9): the annotations as
// the user makes them, in the order they were made; the refusals of a passage as codes the strings
// word; the places of the annotations, memoized so that typing in a card places nothing again; and
// the check that detached annotations block the answer. Pure functions with no DOM and no state of
// their own beyond the memo. No regular expression over any text, and no object keyed by agent or
// user text: a quote or a comment may be any name, `__proto__` included.

import {
  ANNOTATION_MAX_CHARS,
  ANNOTATION_REPLACEMENT_MAX_CHARS,
  type AnnotationPlace,
  DOCUMENT_REVIEW_ANNOTATIONS_MAX,
  type DocumentReviewAnnotation,
  type DocumentReviewQuote,
  type DocumentReviewResult,
  type FieldCheckFailure,
  placeAnnotations,
  placeQuote,
  quotePassage,
  VIEW_ID_PREFIX,
} from "@askboard/contract";
import { markSpecs } from "./marks.ts";

/** Why a passage is not anchored, as a code the view's strings word. */
export type Refusal =
  | { readonly code: "blank" | "too-long" | "repeated" | "limit" }
  | { readonly code: "outside" | "several-ranges" }
  /** The passage overlaps the annotation whose pin reads `pin`. */
  | { readonly code: "overlaps"; readonly pin: number };

export type Anchored =
  | {
      readonly ok: true;
      readonly quote: DocumentReviewQuote;
      readonly start: number;
      readonly end: number;
    }
  | { readonly ok: false; readonly refusal: Refusal };

/**
 * The quote of the passage `[start, end)` of `text`, or why it is refused: the result is full, the
 * passage is blank, longer than 2,000 characters, repeated in the document with 200 characters of
 * context, or overlaps an annotation placed in `places` (`placeAnnotations`' over `annotations`).
 */
export const anchorPassage = (
  text: string,
  annotations: readonly DocumentReviewAnnotation[],
  places: readonly AnnotationPlace[],
  start: number,
  end: number,
): Anchored => {
  if (annotations.length >= DOCUMENT_REVIEW_ANNOTATIONS_MAX) {
    return { ok: false, refusal: { code: "limit" } };
  }
  const made = quotePassage(text, start, end);
  if (!made.ok) return { ok: false, refusal: { code: made.reason } };
  const place = placeQuote(text, made.quote);
  if (!place.ok) return { ok: false, refusal: { code: "repeated" } };
  const crossed = markSpecs(places, annotations).find(
    (spec) => place.start < spec.end && spec.start < place.end,
  );
  if (crossed !== undefined)
    return { ok: false, refusal: { code: "overlaps", pin: crossed.number } };
  return { ok: true, quote: made.quote, start: place.start, end: place.end };
};

// The digits of `text` as a number, or none when it holds anything else or none at all.
const numberOf = (digits: string): number | undefined => {
  if (digits === "" || digits.length > 9) return undefined;
  for (const character of digits) if (character < "0" || character > "9") return undefined;
  const value = Number(digits);
  return String(value) === digits ? value : undefined;
};

/** The ID of the next annotation the view makes: `u-` and the lowest number no annotation holds. */
export const nextId = (annotations: readonly DocumentReviewAnnotation[]): string => {
  const taken = new Set<number>();
  for (const { id } of annotations) {
    if (!id.startsWith(VIEW_ID_PREFIX)) continue;
    const value = numberOf(id.slice(VIEW_ID_PREFIX.length));
    if (value !== undefined) taken.add(value);
  }
  let next = 1;
  while (taken.has(next)) next += 1;
  return `${VIEW_ID_PREFIX}${next}`;
};

/**
 * What a card holds while it is open (decision 9): the annotation's ID, its quote, and the text
 * the user has written, and for a suggested edit the replacement. The card keeps the passage as
 * view state, so it stays open when its annotation is not held.
 */
export type Card =
  | {
      readonly id: string;
      readonly quote: DocumentReviewQuote;
      readonly kind: "comment";
      readonly text: string;
    }
  | {
      readonly id: string;
      readonly quote: DocumentReviewQuote;
      readonly kind: "suggestion";
      readonly text: string;
      readonly replacement: string;
    };

// `text` cut to `max` code points.
const cut = (text: string, max: number): string => {
  let count = 0;
  let at = 0;
  for (const character of text) {
    if (count === max) return text.slice(0, at);
    count += 1;
    at += character.length;
  }
  return text;
};

// The annotation a card holds, or none: a comment from its first non-blank character, a suggestion
// while its replacement differs from the passage; with the replacement left as the passage, a
// written note is held as a comment (the contract refuses a replacement equal to its `exact`).
const annotationOf = (card: Card): DocumentReviewAnnotation | undefined => {
  const target = { selector: card.quote };
  const noted = card.text.trim() !== "";
  if (card.kind === "comment") {
    return noted
      ? { id: card.id, target, body: { text: cut(card.text, ANNOTATION_MAX_CHARS) } }
      : undefined;
  }
  const text = noted ? { text: cut(card.text, ANNOTATION_MAX_CHARS) } : {};
  // The contract refuses a replacement equal to its passage: a note beside it is a comment's.
  if (card.replacement === card.quote.exact) {
    return noted ? { id: card.id, target, body: text } : undefined;
  }
  return {
    id: card.id,
    target,
    body: {
      replacement: cut(card.replacement, ANNOTATION_REPLACEMENT_MAX_CHARS),
      ...text,
    },
  };
};

/** Whether the card holds an annotation now: what its text and replacement make of it (decision 9). */
export const cardHolds = (card: Card): boolean => annotationOf(card) !== undefined;

/**
 * Whether the card still stands for what the item holds: the annotation it holds is the held one
 * with its ID, or it holds none and none is held. A result changed behind the card's back (a
 * revision that dropped it) fails this, and the card is closed, so that text the draft lacks
 * never shows in an open card.
 */
export const cardMatches = (
  card: Card,
  annotations: readonly DocumentReviewAnnotation[],
): boolean => {
  const held = annotations.find((each) => each.id === card.id);
  const wanted = annotationOf(card);
  if (wanted === undefined || held === undefined) return wanted === held;
  return JSON.stringify(wanted) === JSON.stringify(held);
};

/**
 * The annotations once the card's text is written: its annotation changed in place, appended when
 * it is new, or removed when the card holds nothing (the user's order stands).
 */
export const withCard = (
  annotations: readonly DocumentReviewAnnotation[],
  card: Card,
): readonly DocumentReviewAnnotation[] => {
  const held = annotationOf(card);
  const index = annotations.findIndex((each) => each.id === card.id);
  if (held === undefined) {
    return index < 0 ? annotations : annotations.filter((each) => each.id !== card.id);
  }
  if (index >= 0) return annotations.map((each, at) => (at === index ? held : each));
  return annotations.length >= DOCUMENT_REVIEW_ANNOTATIONS_MAX
    ? annotations
    : [...annotations, held];
};

/** The card an annotation reopens as: a suggestion when it holds a replacement. */
export const cardOf = (annotation: DocumentReviewAnnotation): Card => {
  const { body, target, id } = annotation;
  const quote = target.selector;
  return body.replacement === undefined
    ? { id, quote, kind: "comment", text: body.text ?? "" }
    : { id, quote, kind: "suggestion", text: body.text ?? "", replacement: body.replacement };
};

/** The annotations without the one with `id` (the same list when none has it). */
export const removeAnnotation = (
  annotations: readonly DocumentReviewAnnotation[],
  id: string,
): readonly DocumentReviewAnnotation[] =>
  annotations.some((each) => each.id === id)
    ? annotations.filter((each) => each.id !== id)
    : annotations;

/** The result the item holds: its annotations in the user's order, none while it holds none. */
export const resultOf = (
  annotations: readonly DocumentReviewAnnotation[],
): DocumentReviewResult | undefined => (annotations.length === 0 ? undefined : { annotations });

/** What the places are made in: a text, or a reading, which stands for its text (kept per object). */
export type PlaceSource = string | { readonly text: string };

type Place = (source: PlaceSource, annotations: readonly unknown[]) => readonly AnnotationPlace[];

const MEMO_SIZE = 16;

// The memo's key: each annotation's ID and selector, never its body, so that typing in a card does
// not change it, after `prefix` (a text, or nothing for a reading, which is the memo's own key). A
// list that cannot be written as JSON has no key and no memo.
const keyOf = (prefix: string, annotations: readonly unknown[]): string | undefined => {
  try {
    return `${prefix}\u0000${JSON.stringify(
      annotations.map((each) => {
        const record =
          typeof each === "object" && each !== null ? (each as Record<string, unknown>) : {};
        const target = record.target;
        return [
          record.id,
          typeof target === "object" && target !== null
            ? (target as { selector?: unknown }).selector
            : null,
        ];
      }),
    )}`;
  } catch {
    return undefined;
  }
};

/**
 * A memoized `placeAnnotations` (review verdict 3), given the function it memoizes: the places are
 * made once while the text and every annotation's ID and selector stay, whatever the bodies say, so
 * that typing in a card places nothing again. Given a reading object, the last selectors' key and
 * its places are kept in a `WeakMap` keyed by that object, with no capacity to outgrow and gone with
 * the reading (review X-1 and U-1 of 5.6); given a bare text, a bounded memo keeps the entries,
 * the least recently used going first.
 */
export const createPlaces = (
  place: (
    text: string,
    annotations: readonly unknown[],
  ) => readonly AnnotationPlace[] = placeAnnotations,
): Place => {
  const memo = new Map<string, readonly AnnotationPlace[]>();
  const perReading = new WeakMap<
    object,
    { readonly key: string; readonly places: readonly AnnotationPlace[] }
  >();
  return (source, annotations) => {
    const text = typeof source === "string" ? source : source.text;
    if (typeof source !== "string") {
      const key = keyOf("", annotations);
      if (key === undefined) return place(text, annotations);
      const known = perReading.get(source);
      if (known !== undefined && known.key === key) return known.places;
      const made = place(text, annotations);
      perReading.set(source, { key, places: made });
      return made;
    }
    const key = keyOf(source, annotations);
    if (key === undefined) return place(text, annotations);
    const known = memo.get(key);
    if (known !== undefined) {
      memo.delete(key);
      memo.set(key, known);
      return known;
    }
    const made = place(text, annotations);
    memo.set(key, made);
    if (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value as string);
    return made;
  };
};

/** The one memo the component and the chunk's `check` share, so that both place once. */
export const placesOf: Place = createPlaces();

/**
 * The Document review's field check (decision 8): `{code: "detached", count}` while a held
 * annotation has no place in the reading `readingFor(props)` (the item's own, kept per props
 * object, and placed through the memo the component shares: a quote the text lacks, holds twice,
 * or one that overlaps an earlier annotation's), none while every one is placed, with no result,
 * or for a value that is not a review's result or props, which `fits` drops.
 */
export const check = (
  result: unknown,
  props: unknown,
  readingFor: (props: object) => { readonly text: string },
  places: Place = placesOf,
): Extract<FieldCheckFailure, { readonly code: "detached" }> | undefined => {
  if (typeof result !== "object" || result === null) return undefined;
  const annotations = (result as { annotations?: unknown }).annotations;
  const markdown =
    typeof props === "object" && props !== null
      ? (props as { markdown?: unknown }).markdown
      : undefined;
  if (!Array.isArray(annotations) || typeof markdown !== "string") return undefined;
  const count = places(readingFor(props as object), annotations).filter(
    (place) => place.status === "detached",
  ).length;
  return count === 0 ? undefined : { code: "detached", count };
};
