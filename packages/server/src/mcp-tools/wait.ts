// A waiting `collect` (AD-4, design decision 4): a waiter on ask-core's subscription, raced against
// the longest wait and the request's abort signal, with progress at the contract's interval when
// the request carries a progress token.

import {
  COLLECT_MAX_WAIT_MS,
  COLLECT_PROGRESS_INTERVAL_MS,
  type CollectRequest,
} from "@askboard/contract";
import { failure } from "./diagnostics.ts";
import type { CallContext, ToolDeps } from "./ports.ts";

export type WaitEnd = "event" | "timeout" | "aborted";

type Wait = NonNullable<CollectRequest["wait"]>;

const PROGRESS_MESSAGE = "waiting for the user on the board";

/**
 * Waits until the log gains an event for the item or an event that changes its ask's state, until
 * the longest wait passes, or until the request is aborted. Whatever ends it, it leaves no
 * subscription and no timer behind.
 */
export const waitForItem = (
  { core, timers, diagnostics }: ToolDeps,
  wait: Wait,
  context: CallContext,
): Promise<WaitEnd> =>
  new Promise((resolve) => {
    const startState = core.board(wait.askId)?.state;
    const cancels: (() => void)[] = [];
    let ended = false;
    const end = (how: WaitEnd) => {
      if (ended) return;
      ended = true;
      for (const cancel of cancels) cancel();
      context.signal.removeEventListener("abort", aborted);
      resolve(how);
    };
    const aborted = () => end("aborted");
    if (context.signal.aborted) {
      end("aborted");
      return;
    }
    context.signal.addEventListener("abort", aborted, { once: true });
    cancels.push(
      core.subscribe((event) => {
        if (event.type !== "appended" || event.askId !== wait.askId) return;
        const forItem = "itemId" in event.event && event.event.itemId === wait.itemId;
        if (forItem || core.board(wait.askId)?.state !== startState) end("event");
      }),
    );
    cancels.push(timers.after(COLLECT_MAX_WAIT_MS, () => end("timeout")));
    const { progress } = context;
    if (progress === undefined) return;
    let sent = 0;
    const tick = () => {
      sent += 1;
      progress(sent, PROGRESS_MESSAGE).catch((error: unknown) => {
        diagnostics.write(failure("progress failed", error));
      });
      cancels.push(timers.after(COLLECT_PROGRESS_INTERVAL_MS, tick));
    };
    cancels.push(timers.after(COLLECT_PROGRESS_INTERVAL_MS, tick));
  });
