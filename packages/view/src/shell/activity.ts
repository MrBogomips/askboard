// The view's activity message (design decision 10): a key or pointer input inside the sandboxed
// view does not reach the board page, so the view tells it, at the first input and then at most
// once every `VIEW_ACTIVITY_INTERVAL_MS` while the user acts, which keeps the board's working
// signal within its window.

import { VIEW_ACTIVITY_INTERVAL_MS } from "../view-protocol.ts";

/** One input's handler: it calls `send` unless it did so within the interval. */
export const createActivityReporter = (
  send: () => void,
  now: () => number,
  intervalMs: number = VIEW_ACTIVITY_INTERVAL_MS,
): (() => void) => {
  let last: number | undefined;
  return () => {
    const at = now();
    if (last !== undefined && at - last < intervalMs) return;
    last = at;
    send();
  };
};
