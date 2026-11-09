// The ask lifecycle's limits (ask-lifecycle, design decision 2), beside E1's in `limits.ts`.

// Input format 1.1: text the agent sends beside an option.

/** The longest preview an option shows, plain text (FR-3; proposal, open question 9). */
export const PREVIEW_MAX_CHARS = 10_000;

/** The longest note the agent writes on an option (FR-3). */
export const ANNOTATION_MAX_CHARS = 2_000;

/**
 * The longest replacement of a suggested edit, in code points (document-review, design decision 2):
 * beside the comment's bound, since an edit may rewrite a passage of up to 2,000 characters longer.
 */
export const ANNOTATION_REPLACEMENT_MAX_CHARS = 4_000;

// Text the user writes on the board and the agent's replies.

/** The longest note: the open prompt's text, sent with an answer, a decline or alone (FR-7). */
export const NOTE_MAX_CHARS = 10_000;

/** The longest "Other…" text (FR-3). */
export const OTHER_MAX_CHARS = 10_000;

/** The longest follow-up the user writes on a question (FR-10). */
export const FOLLOW_UP_MAX_CHARS = 10_000;

/** The longest reply the agent writes to a follow-up (FR-10). */
export const REPLY_MAX_CHARS = 10_000;

/** The longest note the user writes on one option (FR-3). */
export const OPTION_NOTE_MAX_CHARS = 2_000;

/**
 * The longest draft record, in characters of its JSON text (JavaScript string length, as the
 * result limit counts): above anything the per-field limits admit for a board (ask-lifecycle,
 * design decision 2). A longer record is refused.
 */
export const DRAFT_RECORD_MAX_CHARS = 2_000_000;

/**
 * The deepest nesting a result or a derived value may have, in levels of objects and arrays:
 * `ask-core` refuses a deeper one and the draft record refuses a record that holds one, never
 * walking it, since `JSON.stringify` throws on one nested far enough (widget-registry, design
 * decision 6; AD-10, NFR-10). The one bound: no other module states its own.
 */
export const JSON_MAX_DEPTH = 64;

/** The levels a draft record has of its own above a result: the record, `questions`, a question, `results`. */
export const DRAFT_RECORD_OWN_LEVELS = 4;

/**
 * The deepest nesting a draft record may have: a result at the JSON bound under the record's own
 * levels, so a result `ask-core` accepts is one the draft mirror carries.
 */
export const DRAFT_RECORD_MAX_DEPTH = JSON_MAX_DEPTH + DRAFT_RECORD_OWN_LEVELS;

/**
 * The most characters of an item's RFC 8785 JSON text one `fetch` page holds, so that a page with
 * its envelope stays under the result limit (proposal, open question 5).
 */
export const FETCH_PAGE_MAX_CHARS = 24_000;
