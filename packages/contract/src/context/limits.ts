// The context limits (excerpts, design decision 2; proposal B4): what a pointer, an excerpt, an
// image and the source view may hold, and how long one send's pointers may take to resolve.
// `excerpts`, `ask-core`, `board-host` and the view read these; none defines its own. They sit
// apart from E1's `limits.ts`, so neither change edits the other's list.

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
