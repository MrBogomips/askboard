// What resolving a pointer gives (excerpts, design decisions 2 and 3; proposal B5, B6 and B9):
// the reasons a pointer stays unresolved, which `excerpts` and `ask-core` give, the
// `unresolved-pointer` warning names and the board document records; the media types of a resolved
// excerpt and image; and a source's state in the reading panel.

/** Why a pointer stays unresolved; the warning and the board document name these. */
export const UNRESOLVED_REASONS = [
  "no-root",
  "invalid-pointer",
  "outside-root",
  "not-found",
  "not-a-file",
  "anchor-not-found",
  "not-text",
  "not-image",
  "too-large",
  "timeout",
] as const;

export type UnresolvedReason = (typeof UNRESOLVED_REASONS)[number];

/** A resolved excerpt's media type: it decides only how the text wraps (DESIGN, Excerpt). */
export const TEXT_MEDIA_TYPES = ["text/markdown", "text/plain"] as const;

export type TextMediaType = (typeof TEXT_MEDIA_TYPES)[number];

/** The images a pointer may name, recognised by their first bytes; SVG is none of them. */
export const IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

/** A source as the reading panel and the source view show it now (board-host spec, The source view). */
export const SOURCE_STATUSES = [
  "available",
  "missing",
  "outside-root",
  "not-text",
  "too-large",
] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** What "Open in editor" gave (proposal B17): the board page shows any but `opened`. */
export const EDITOR_OUTCOMES = ["opened", "no-editor", "unavailable", "failed", "busy"] as const;

export type EditorOutcome = (typeof EDITOR_OUTCOMES)[number];
