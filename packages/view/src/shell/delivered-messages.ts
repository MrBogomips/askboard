// The delivered count as a status message, at most once every 5 seconds (answering-flow-guidance,
// design decision 6; WCAG 2.2 SC 4.1.3): pure, with the clock passed in. The caller observes the
// counts of each state update (`completionOf`'s receipts only, NFR-10) and asks `due` when the
// window `dueAt` names has ended; a count that has not changed since the last message, or that is
// zero, says nothing.

import { deliveredMessageOf } from "./flow-messages.ts";
import type { StatusMessage } from "./status-messages.ts";

export const DELIVERED_WINDOW_MS = 5000;

export type DeliveredCounts = { readonly sent: number; readonly delivered: number };

export type DeliveredGate = {
  /** A state update's counts, at `now` (milliseconds). The first one is the baseline. */
  observe(counts: DeliveredCounts, now: number): void;
  /** When the open window ends; none while no window is open. */
  dueAt(): number | undefined;
  /** The message of a window that has ended by `now`, once; else none. */
  due(now: number): StatusMessage | undefined;
};

export const createDeliveredGate = (): DeliveredGate => {
  let said: number | undefined;
  let window: { readonly opened: number; latest: DeliveredCounts } | undefined;
  return {
    observe: (counts, now) => {
      if (said === undefined) {
        said = counts.delivered;
        return;
      }
      if (window !== undefined) window.latest = counts;
      else if (counts.delivered !== said) window = { opened: now, latest: counts };
    },
    dueAt: () => (window === undefined ? undefined : window.opened + DELIVERED_WINDOW_MS),
    due: (now) => {
      if (window === undefined || now < window.opened + DELIVERED_WINDOW_MS) return undefined;
      const { latest } = window;
      window = undefined;
      if (latest.delivered === said || latest.delivered === 0) return undefined;
      said = latest.delivered;
      return deliveredMessageOf(latest);
    },
  };
};
