// Values that more than one unit reads (contract spec, Shared constants). No unit defines its own.

/** `collect`'s longest wait before it returns the outcome `open` (AD-4). */
export const COLLECT_MAX_WAIT_MS = 20 * 60 * 1000;

/** How often a waiting `collect` sends progress when the request carries a progress token. */
export const COLLECT_PROGRESS_INTERVAL_MS = 60 * 1000;

/** The longest text a tool result holds; a longer `collect` result is paged (AD-6). */
export const RESULT_MAX_CHARS = 30_000;

/** The longest `isError` text of a tool result (AD-6). */
export const ERROR_TEXT_MAX_CHARS = 4_000;

/** Where a derived title is cut (FR-1); provisional, EXPERIENCE's open item 9 (design decision 2). */
export const TITLE_MAX_CHARS = 80;

/**
 * The longest title a board document holds, and so the longest an agent may write; the input
 * format's `title` takes the same limit. E1's choice: no spec records the cap lengths (EXPERIENCE's
 * open item 9), and the board shows a long title capped with an ellipsis anyway.
 */
export const ASK_TITLE_MAX_CHARS = 256;

/** The board listener's default ports, tried in order (design decision 2). */
export const BOARD_PORT_RANGE = { first: 47200, last: 47299 } as const;

/** The only interface the board listener binds, and the host of every board link (AD-11). */
export const BOARD_HOST = "127.0.0.1";

/** A board token's least strength (AD-11, NFR-4). */
export const BOARD_TOKEN_MIN_BITS = 128;

/** The random bytes of a token, written as 22 base64url characters (design decision 5). */
export const BOARD_TOKEN_BYTES = 16;

/** What a token looks like on the wire: base64url, at least 128 bits. */
export const BOARD_TOKEN_PATTERN = "^[A-Za-z0-9_-]{22,}$";

/** The longest token a `connect` message may carry, so a receiver never reads an unbounded one. */
export const BOARD_TOKEN_MAX_CHARS = 256;

/**
 * The WebSocket close codes `board-host` sends, each right after the message it is named for: 4000
 * plus the HTTP status that says the same. After any of them the board page does not reconnect on
 * its own; after any other close (a drop, the process ending) it reconnects with backoff, showing
 * "Connection lost, retrying" (design decision 5, AD-21).
 */
export const BOARD_CLOSE_CODES = {
  /** After `refused` on a socket whose `connect` was not accepted: the page shows the ask as discarded. */
  refused: 4403,
  /** After `moved`: another tab holds the board; only "Continue here" reconnects, taking it back. */
  moved: 4409,
  /** After `discarded`: the board stays readable and accepts no answer. */
  discarded: 4410,
} as const;

export type BoardCloseCode = (typeof BOARD_CLOSE_CODES)[keyof typeof BOARD_CLOSE_CODES];

/** The longest `detail` of a board-protocol refusal; `board-host` cuts a longer one. E1's choice. */
export const REFUSAL_DETAIL_MAX_CHARS = 1_000;

/**
 * A time as the board stamps it (FR-19): RFC 3339 in UTC, `Z` and `T` in capitals, each field
 * within its range, with an optional fraction of a second. A pattern cannot see an impossible day
 * such as February 30: `ask-core` refuses one (Track A, 4.2).
 */
export const UTC_TIME_PATTERN =
  "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,9})?Z$";

/** Ask, item and child IDs the agent chooses (AD-7). */
export const ID_PATTERN = "^[A-Za-z0-9_-]{1,64}$";

/** The prefix of IDs the view makes; no agent-chosen ID may start with it (finding F10). */
export const VIEW_ID_PREFIX = "u-";

/** The view build's folder beside the session process's bundle (design decision 7). */
export const VIEW_DIRECTORY = "view";

/** The view manifest's file in that folder; its paths are relative to the folder. */
export const VIEW_MANIFEST_FILE = "manifest.json";

// The ask lifecycle (ask-lifecycle, design decision 2).

/** An act command's action ID: 22 base64url characters, 128 bits the board page draws (AD-20). */
export const ACTION_ID_PATTERN = "^[A-Za-z0-9_-]{22}$";

/**
 * How long ask-core waits, after the last live board of an ask closes, for a board to connect
 * before it discards the ask (AD-21; proposal, open question 4): over the 90 s floor of any board
 * liveness timeout, since a hidden Chrome tab runs its timers once a minute.
 */
export const GRACE_PERIOD_MS = 120_000;

/** How long board-host takes a moved tab's last draft record after a takeover (design decision 5). */
export const TAKEOVER_FLUSH_WAIT_MS = 1_000;
