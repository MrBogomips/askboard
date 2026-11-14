// Round-trip probes in place of the fixed quiet wait (e2e-cadence, decision 7). A test that
// watched `QUIET_MS` for something to have arrived, or not to have, waits instead for what it
// reads: each probe returns once everything sent through its channel before the call has been
// recorded. A probe catches what was sent before it, not what a timer the test does not know sends
// later: so each timer the product uses on these paths is named and waited for (`timerSettled`,
// `draftSettled`), and a site no probe fits says why through `quiet`. `probes.browser.ts` checks
// each probe in every engine with an action that does send; `quiet-guard.ts` keeps the fixed wait
// out of the browser files.

import { DRAFT_DEBOUNCE_MS } from "../../../src/board-page/draft-mirror.ts";
import { RECONNECT_DELAYS_MS } from "../../../src/board-page/reconnect.ts";

/** How long a test watches for something that must not happen, where no probe fits (`quiet`). */
export const QUIET_MS = 1_500;

/** The first wait before the board page reconnects: a socket it would open does so by then. */
export const NO_RECONNECT_WAIT_MS: number = RECONNECT_DELAYS_MS[0] ?? 0;

type Evaluates = { evaluate(run: () => unknown): Promise<unknown> };

/** What the probes need of a board: its page, and the view's frame inside it (`Board` has both). */
export type Settleable = {
  readonly page: Evaluates;
  viewFrame(): Promise<Evaluates>;
};

// Runs in the view's frame: two animation frames and a macrotask, so that a React render and the
// effects after it have run and the message they post is on its way. A hidden page runs no
// animation frames, so a long timer ends the wait there instead of hanging the test.
const flushViewFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    const hidden = setTimeout(resolve, 1_000);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(hidden);
        setTimeout(resolve, 0);
      }),
    );
  });

// Runs in the board page: one macrotask, after every message event already queued.
const flushBoardPage = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * View to board page. Flushes the view's frame, then the board page: a message the view posted
 * before the call has been handled by the board page when this returns (probe P3, 200 of 200 in
 * Chromium, Firefox and WebKit).
 */
export const viewSettled = async (board: Settleable): Promise<void> => {
  await (await board.viewFrame()).evaluate(flushViewFrame);
  await board.page.evaluate(flushBoardPage);
};

/**
 * Board page to board-host. `viewSettled`, then a board-page macrotask in an `evaluate` of its
 * own: Chromium and WebKit record a frame the page sent by the time the `evaluate` that sent it
 * resolves, Firefox only after one more round trip. Every frame the page sent before the call is
 * in `run.browser.sockets` when this returns.
 */
export const hostSettled = async (board: Settleable): Promise<void> => {
  await viewSettled(board);
  await board.page.evaluate(flushBoardPage);
};

/**
 * The draft mirror: a draft the view posted before the call has reached `board-host`, and the
 * widget host's `drafts`. The board page sends a draft `DRAFT_DEBOUNCE_MS` after it receives it,
 * so the view's message is taken first (`viewSettled`), the debounce then runs out, and the host
 * is settled after it.
 */
export const draftSettled = async (board: Settleable): Promise<void> => {
  await viewSettled(board);
  await Bun.sleep(DRAFT_DEBOUNCE_MS);
  await hostSettled(board);
};

/**
 * A product timer under test: waits `ms`, the timer's own constant imported from the product (the
 * reconnect backoff, `NO_RECONNECT_WAIT_MS`), then settles the view.
 */
export const timerSettled = async (ms: number, board: Settleable): Promise<void> => {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error(`timerSettled needs a finite, non-negative time in ms, got ${ms}`);
  }
  await Bun.sleep(ms);
  await viewSettled(board);
};

/**
 * The remaining fixed wait, for a site no probe fits, with the reason it does. The reason is a
 * string literal, which the guard of `quiet-guard.ts` checks.
 */
export const quiet = async (reason: string): Promise<void> => {
  if (reason.trim() === "") throw new Error("quiet() needs a reason for the wait");
  // The one place the quiet wait is written; the guard refuses it anywhere else.
  await new Promise<void>((resolve) => setTimeout(resolve, QUIET_MS));
};
