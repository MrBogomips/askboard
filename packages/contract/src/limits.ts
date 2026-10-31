// Limits of the agent-side sets that more than one unit reads (contract spec, Shared constants);
// the shared constants of Track 0 are in `constants.ts`.

/**
 * The longest agent name and expected user the input format accepts, and the longest `who` an
 * answer carries: a longer git user or login name is cut to it. E1's choice.
 */
export const NAME_MAX_CHARS = 256;

/**
 * The most room a question's option labels may take, written as a JSON array. A Choice answer
 * names its options by label (finding F5), so this keeps every answer event, with its envelope,
 * under the result limit, and `collect` never meets an event it cannot return. E1's choice.
 */
export const CHOICE_LABELS_MAX_CHARS = 20_000;

/** An epoch: the session process's random scope of ask IDs and cursors (AD-2, AD-3). */
export const EPOCH_PATTERN = "^[a-z0-9]{4,16}$";

/** A cursor, exactly `<epoch>.<seq>` (AD-3). */
export const CURSOR_PATTERN = "^[a-z0-9]{4,16}\\.(0|[1-9][0-9]{0,15})$";

/**
 * The most asks one `collect` takes. With at most this many entries, the largest an entry can be
 * and the largest answer event, a result stays under the result limit, so the first event always
 * fits. E1's choice.
 */
export const COLLECT_ASKS_MAX = 40;

// Input format 1.1 (ask-lifecycle, design decision 2): text the agent sends beside an option.

/** The longest preview an option shows, plain text (FR-3; proposal, open question 9). */
export const PREVIEW_MAX_CHARS = 10_000;

/** The longest note the agent writes on an option (FR-3). */
export const ANNOTATION_MAX_CHARS = 2_000;

// Text the user writes on the board and the agent's replies (ask-lifecycle, design decision 2).

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
