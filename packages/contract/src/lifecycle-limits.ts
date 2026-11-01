// The ask lifecycle's limits (ask-lifecycle, design decision 2), beside E1's in `limits.ts`.

// Input format 1.1: text the agent sends beside an option.

/** The longest preview an option shows, plain text (FR-3; proposal, open question 9). */
export const PREVIEW_MAX_CHARS = 10_000;

/** The longest note the agent writes on an option (FR-3). */
export const ANNOTATION_MAX_CHARS = 2_000;

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
 * The most characters of an item's RFC 8785 JSON text one `fetch` page holds, so that a page with
 * its envelope stays under the result limit (proposal, open question 5).
 */
export const FETCH_PAGE_MAX_CHARS = 24_000;
