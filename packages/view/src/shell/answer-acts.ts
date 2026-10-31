// The acts the user gave from the view that the board page has not settled yet (design decision 8,
// M3 of the 8.1 to 8.5 review; since the ask lifecycle, any act command, ask-lifecycle design
// decision 6): a command starts when the user acts and holds its questions' cards until the board
// page's reply, which names the action ID it drew, and after it until an update shows the board
// page no longer holds it. That update either settles it as done, and the caller clears the work it
// carried, or says it was refused or dropped (refused by `board-host`, or no longer allowed after a
// reconnect), and the work stays in the draft: a card is never stuck at a receipt the board page
// has given up (AD-10). The board page sends its update before its reply, but the view does not
// rely on the order: a command settles only on an update that comes after the reply.

import type { ActReply, PendingAct, SettledAct, ViewAct } from "../view-protocol.ts";

/** One command the view sent, until it settles. */
export type Flight = {
  readonly key: number;
  readonly acts: readonly ViewAct[];
  /** Set once the board page has replied, with the outcome it gave. */
  readonly actionId?: string;
  readonly outcome?: "sent" | "queued";
};

export type AnswerActs = {
  /**
   * The latest unsettled command holding an act on the question; with `types`, an act of one of
   * those types.
   */
  of(questionId: string, types?: readonly ViewAct["type"][]): Flight | undefined;
  /** The user acted: the command holds its questions' cards until it settles; returns its key. */
  start(acts: readonly ViewAct[]): number;
  /** The board page's reply: sent or queued under an action ID, or refused, or none. */
  replied(key: number, reply: ActReply | undefined): void;
  /** The command did not reach the board page: its questions are open again. */
  drop(key: number): void;
  /** An update came: each replied command it no longer holds settles; returns those done. */
  reconcile(pending: readonly PendingAct[], settled: readonly SettledAct[]): readonly Flight[];
  /** Moves on each change: what a view of every command follows. */
  version(): number;
  subscribe(listener: () => void): () => void;
};

export const createAnswerActs = (): AnswerActs => {
  // By key, in the order the user acted; each change makes a new flight.
  const flights = new Map<number, Flight>();
  const listeners = new Set<() => void>();
  let next = 0;
  let version = 0;
  const changed = () => {
    version += 1;
    for (const listener of listeners) listener();
  };
  return {
    of: (questionId, types) =>
      [...flights.values()]
        .reverse()
        .find((flight) =>
          flight.acts.some(
            (act) => act.itemId === questionId && (types === undefined || types.includes(act.type)),
          ),
        ),
    start: (acts) => {
      next += 1;
      flights.set(next, Object.freeze({ key: next, acts: [...acts] }));
      changed();
      return next;
    },
    replied: (key, reply) => {
      const flight = flights.get(key);
      if (flight === undefined) return;
      if (reply === undefined || reply.outcome === "refused") flights.delete(key);
      else flights.set(key, Object.freeze({ ...flight, ...reply }));
      changed();
    },
    drop: (key) => {
      if (flights.delete(key)) changed();
    },
    reconcile: (pending, settled) => {
      const done: Flight[] = [];
      let moved = false;
      for (const [key, flight] of flights) {
        if (flight.actionId === undefined) continue;
        const held = pending.find((entry) => entry.actionId === flight.actionId);
        if (held !== undefined) {
          if (held.outcome !== flight.outcome) {
            flights.set(key, Object.freeze({ ...flight, outcome: held.outcome }));
            moved = true;
          }
          continue;
        }
        const end = settled.find((entry) => entry.actionId === flight.actionId);
        if (end?.outcome === "done") done.push(flight);
        flights.delete(key);
        moved = true;
      }
      if (moved) changed();
      return done;
    },
    version: () => version,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
