// The ask lifecycle's values that more than one unit reads (ask-lifecycle, design decision 2),
// beside E1's in `constants.ts`. No unit defines its own.

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

/**
 * The longest entry in a draft record, in code points (atoms, design decision 3): the text an
 * input atom holds that gives no value. An atom caps its field at this, so an entry always fits.
 */
export const ENTRY_MAX_CHARS = 200;
