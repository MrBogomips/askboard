// The bottom action bar's Snapshot (snapshot design decision 9; EXPERIENCE.md, Snapshot control):
// one request at a time, sent to the board page as the view's `snapshot` message, which answers
// with the request's ID, or refuses it; the request then ends when an update's `snapshot` field
// names that ID. The bar shows the unsent-work note first when the board page said the board held
// some, then how the request went (`snapshot-line.ts`).

import {
  feedbackLineOf,
  refusedLineOf,
  type SnapshotLine,
  takingLineOf,
} from "../snapshot-line.ts";
import type { SnapshotFeedback, ViewLock } from "../view-protocol.ts";
import type { ViewChannel } from "./channel.ts";
import { createStore, type Store } from "./store.ts";

/** Where the bar's Snapshot stands: none asked, one on its way, one ended, or one refused. */
export type SnapshotControlState =
  | { readonly phase: "idle" }
  | { readonly phase: "taking"; readonly requestId: string; readonly unsentWork: boolean }
  | { readonly phase: "ended"; readonly feedback: SnapshotFeedback }
  | { readonly phase: "refused"; readonly detail: string };

/** The bar's Snapshot: its state, and the press that takes one. */
export type SnapshotControl = Pick<Store<SnapshotControlState>, "get" | "subscribe"> & {
  /** Asks the board page for a Snapshot, unless one is already on its way. */
  take(): void;
};

/** Whether the board offers the Snapshot now. */
export type SnapshotOffer = "enabled" | "disabled" | "hidden";

/**
 * Absent once the ask is discarded, disabled while the connection is lost or the board moved to
 * another tab, offered otherwise, a closed ask included (FR-26, EXPERIENCE.md, Snapshot control).
 */
export const snapshotOfferOf = (
  lock: ViewLock | undefined,
  connection: "lost" | undefined,
): SnapshotOffer => {
  if (lock === "discarded") return "hidden";
  return lock === "moved" || connection === "lost" ? "disabled" : "enabled";
};

/** The bar's line for the state; none while no Snapshot was asked. */
export const snapshotLineOf = (state: SnapshotControlState): SnapshotLine | undefined => {
  switch (state.phase) {
    case "idle":
      return undefined;
    case "taking":
      return takingLineOf(state.unsentWork);
    case "refused":
      return refusedLineOf(state.detail);
    default:
      return feedbackLineOf(state.feedback);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The board page's answer to the request: sent under an ID, refused, or not readable.
const readReply = (
  reply: Record<string, unknown> | undefined,
): { readonly requestId: string; readonly unsentWork: boolean } | { readonly detail: string } => {
  if (isRecord(reply) && reply.outcome === "sent" && typeof reply.requestId === "string") {
    return { requestId: reply.requestId, unsentWork: reply.unsentWork === true };
  }
  if (isRecord(reply) && reply.outcome === "refused" && typeof reply.detail === "string") {
    return { detail: reply.detail };
  }
  return { detail: "the board page did not take the request" };
};

/** The bar's Snapshot over the view's channel. */
export const createSnapshotControl = (channel: ViewChannel): SnapshotControl => {
  const state = createStore<SnapshotControlState>({ phase: "idle" });
  // The latest feedback heard, in case it comes before the reply that names its request.
  let heard: SnapshotFeedback | undefined;
  const settle = (requestId: string, unsentWork: boolean) => {
    if (heard?.requestId === requestId) state.set({ phase: "ended", feedback: heard });
    else state.set({ phase: "taking", requestId, unsentWork });
  };
  channel.onUpdate((update) => {
    if (update.snapshot === undefined) return;
    heard = update.snapshot;
    const now = state.get();
    if (now.phase === "taking" && now.requestId === heard.requestId) {
      state.set({ phase: "ended", feedback: heard });
    }
  });
  let asking = false;
  return {
    get: state.get,
    subscribe: state.subscribe,
    take: () => {
      if (asking || state.get().phase === "taking") return;
      asking = true;
      channel.send({ type: "snapshot" }).then(
        (reply) => {
          asking = false;
          const read = readReply(reply);
          if ("detail" in read) state.set({ phase: "refused", detail: read.detail });
          else settle(read.requestId, read.unsentWork);
        },
        (error: unknown) => {
          asking = false;
          const detail = error instanceof Error ? error.message : String(error);
          state.set({ phase: "refused", detail });
        },
      );
    },
  };
};
