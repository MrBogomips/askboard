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
