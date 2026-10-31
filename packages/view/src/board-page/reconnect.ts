// How the board page reads a closed socket and when it tries again (design decision 5, AD-21). The
// contract's three close codes end the board's connection for good, or until "Continue here";
// every other close, a drop (1006) and Track A's "try again later" (1013) included, is ordinary,
// and the page reconnects with backoff.

import { BOARD_CLOSE_CODES } from "@askboard/contract";

export type CloseKind = "refused" | "moved" | "discarded" | "drop";

export const closeKindOf = (code: number): CloseKind => {
  switch (code) {
    case BOARD_CLOSE_CODES.refused:
      return "refused";
    case BOARD_CLOSE_CODES.moved:
      return "moved";
    case BOARD_CLOSE_CODES.discarded:
      return "discarded";
    default:
      return "drop";
  }
};

/**
 * The waits before each reconnect, then the last one again for as long as the board retries.
 * Short at first, since a drop on the user's own machine is usually brief; capped well under the
 * 90 s a board heartbeat may take (SOLUTION-DESIGN §8), so a returning session is found quickly.
 */
export const RECONNECT_DELAYS_MS: readonly number[] = [250, 500, 1_000, 2_000, 4_000];

/** The wait before reconnect attempt `attempt`, counted from 0 since the last live socket. */
export const reconnectDelay = (attempt: number): number => {
  const last = RECONNECT_DELAYS_MS.length - 1;
  const at = Math.min(Math.max(Math.floor(attempt), 0), last);
  return RECONNECT_DELAYS_MS[at] ?? 0;
};
