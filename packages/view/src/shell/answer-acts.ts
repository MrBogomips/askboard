// The answers the user gave from the view that the board page has not settled yet (design
// decision 8, M3 of the 8.1 to 8.5 review): an act starts when "Answer" is pressed and holds the
// card read-only until the board page's reply, and after it until an update shows the board page
// no longer holds the answer. That update either shows the question answered, so the card shows
// the logged answer, or it means the answer was dropped (refused by `board-host`, or no longer
// allowed after a reconnect), and the question is open again: a card is never stuck at a receipt
// the board page has given up (AD-10). The board page sends its update before its reply, but the
// view does not rely on the order: an act drops only on an update that comes after the reply.

import type { PendingAnswer } from "../view-protocol.ts";
import type { Act } from "./question-state.ts";

export type AnswerActs = {
  of(itemId: string): Act | undefined;
  /** "Answer" was pressed: the act shows until it settles. */
  start(itemId: string, choice: readonly string[], when: string): void;
  /** The board page replied that it sent or queued the act stamped `when`. */
  replied(itemId: string, when: string, outcome: "sent" | "queued"): void;
  /** The board page refused the act, or did not reply: the question is open again. */
  drop(itemId: string, when: string): void;
  /** An update came: each replied act it no longer holds is settled. */
  reconcile(pending: readonly PendingAnswer[]): void;
  subscribe(listener: () => void): () => void;
};

export const createAnswerActs = (): AnswerActs => {
  // By item ID in a `Map`, so that any ID is a plain key; each change makes a new act.
  const acts = new Map<string, Act>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  const current = (itemId: string, when: string): Act | undefined => {
    const act = acts.get(itemId);
    return act?.when === when ? act : undefined;
  };
  return {
    of: (itemId) => acts.get(itemId),
    start: (itemId, choice, when) => {
      acts.set(itemId, Object.freeze({ choice: [...choice], when }));
      changed();
    },
    replied: (itemId, when, outcome) => {
      const act = current(itemId, when);
      if (act === undefined) return;
      acts.set(itemId, Object.freeze({ ...act, outcome }));
      changed();
    },
    drop: (itemId, when) => {
      if (current(itemId, when) === undefined) return;
      acts.delete(itemId);
      changed();
    },
    reconcile: (pending) => {
      const settled = [...acts].filter(
        ([itemId, act]) =>
          act.outcome !== undefined &&
          !pending.some((held) => held.itemId === itemId && held.when === act.when),
      );
      if (settled.length === 0) return;
      for (const [itemId] of settled) acts.delete(itemId);
      changed();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
