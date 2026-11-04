// The board page's Snapshot requests (snapshot design decision 8): each one tracked by its request
// ID from the moment it is sent until it ends, once, by `board-host`'s reply, by a drop of its
// socket, or by the backstop bound for a reply lost while the connection stays up. A request is
// never queued and never sent again; a drop or the bound ends it `unconfirmed`, since the file may
// exist (NFR-10). Its feedback goes where the request came from: the view's bar or the Closed
// banner.

import type { SnapshotReply } from "@askboard/contract";
import type { SnapshotFeedback } from "../view-protocol.ts";

/** Where a request came from, and so where its feedback goes. */
export type SnapshotSource = "view" | "banner";

/**
 * How long a request waits for its reply before it ends unconfirmed. Every outcome `board-host`
 * reaches has its reply, so this only ends a request whose reply was lost.
 */
export const SNAPSHOT_REPLY_WAIT_MS = 60_000;

export type SnapshotRequestsDeps = {
  /** Runs `run` after `ms`; returns what cancels it. */
  readonly schedule: (ms: number, run: () => void) => () => void;
  /** A request ended: its feedback, for where it came from. */
  readonly end: (source: SnapshotSource, feedback: SnapshotFeedback) => void;
};

export type SnapshotRequests = {
  /** A request just sent on the socket. */
  track(requestId: string, source: SnapshotSource, unsentWork: boolean): void;
  /** Ends the request the reply names; false when no such request is tracked. */
  reply(message: SnapshotReply): boolean;
  /** The socket dropped: every request still tracked ends unconfirmed. */
  drop(): void;
};

type Tracked = {
  readonly source: SnapshotSource;
  readonly unsentWork: boolean;
  readonly cancel: () => void;
};

// The reply as the view hears it, with the request's unsent-work flag.
const feedbackOf = (reply: SnapshotReply, unsentWork: boolean): SnapshotFeedback => {
  const flag = unsentWork ? { unsentWork: true as const } : {};
  if (reply.type === "snapshot-saved") {
    return { requestId: reply.requestId, ...flag, outcome: "saved", path: reply.path };
  }
  if (reply.reason === "write-failed") {
    const { folder } = reply;
    return { requestId: reply.requestId, ...flag, outcome: "failed", reason: reply.reason, folder };
  }
  return { requestId: reply.requestId, ...flag, outcome: "failed", reason: reply.reason };
};

const unconfirmed = (requestId: string, unsentWork: boolean): SnapshotFeedback => ({
  requestId,
  ...(unsentWork ? { unsentWork: true as const } : {}),
  outcome: "failed",
  reason: "unconfirmed",
});

/** The board page's tracked Snapshot requests, none at first. */
export const createSnapshotRequests = (deps: SnapshotRequestsDeps): SnapshotRequests => {
  const tracked = new Map<string, Tracked>();
  // Ends a tracked request with what `feedback` makes of it; false when it is not tracked.
  const end = (requestId: string, feedback: (request: Tracked) => SnapshotFeedback): boolean => {
    const request = tracked.get(requestId);
    if (request === undefined) return false;
    tracked.delete(requestId);
    request.cancel();
    deps.end(request.source, feedback(request));
    return true;
  };
  const lapse = (requestId: string) => (request: Tracked) =>
    unconfirmed(requestId, request.unsentWork);
  return {
    track: (requestId, source, unsentWork) => {
      const cancel = deps.schedule(SNAPSHOT_REPLY_WAIT_MS, () => end(requestId, lapse(requestId)));
      tracked.set(requestId, { source, unsentWork, cancel });
    },
    reply: (message) =>
      end(message.requestId, (request) => feedbackOf(message, request.unsentWork)),
    drop: () => {
      for (const requestId of [...tracked.keys()]) end(requestId, lapse(requestId));
    },
  };
};
