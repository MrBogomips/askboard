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

// Context (excerpts, design decision 2; proposal B4): what a pointer, an excerpt, an image and the
// source view may hold, and how long one send's pointers may take to resolve. `excerpts`,
// `ask-core`, `board-host` and the view read these; none defines its own.

/** The longest pointer: `path#anchor`, in characters. */
export const POINTER_MAX_CHARS = 1_024;

/** The longest title of an excerpt or a reference. */
export const CONTEXT_TITLE_MAX_CHARS = 256;

/** The longest alt text of an image. */
export const IMAGE_ALT_MAX_CHARS = 1_000;

/** The longest URL of a web reference. */
export const URL_MAX_CHARS = 2_048;

/** The largest file read to find an anchor, in bytes: 4 MiB. */
export const ANCHOR_FILE_MAX_BYTES = 4 * 1024 * 1024;

/** The most lines an excerpt holds; a longer one is unresolved, `too-large`, so the agent narrows it. */
export const EXCERPT_MAX_LINES = 1_000;

/** The largest excerpt, in UTF-8 bytes: 64 KiB. */
export const EXCERPT_MAX_BYTES = 64 * 1024;

/** The largest image, in bytes: 4 MiB. */
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** The most image bytes one ask carries: 16 MiB. */
export const ASK_IMAGES_MAX_BYTES = 16 * 1024 * 1024;

/** The largest file the source view shows, in bytes: 2 MiB. */
export const SOURCE_VIEW_MAX_BYTES = 2 * 1024 * 1024;

/** The most lines the source view shows. */
export const SOURCE_VIEW_MAX_LINES = 20_000;

/** The most pointers read at once. */
export const CONTEXT_READS_MAX = 8;

/** How long one send's pointers may take to resolve; a pointer still being read is `timeout`. */
export const CONTEXT_RESOLVE_BUDGET_MS = 5_000;
