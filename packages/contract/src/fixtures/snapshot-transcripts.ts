// E7's recorded exchange (snapshot design decision 2, E3's decision 8 step 4), on the lifecycle
// ask, kept in its own record beside E1's `transcripts` and E3's `lifecycleTranscripts`. A board
// takes four Snapshots on one socket: the first is saved; the second, sent with unsent work, fails
// to be written in the Snapshot folder; the third finds no project root; the fourth finds the ask
// discarded. Each request gets one reply naming its ID, and nothing else follows, since a Snapshot
// changes nothing on the ask. A replay makes each outcome happen through ask-core's Snapshot
// writer, and the last by discarding the ask meanwhile; the rest of replaying is as
// `lifecycle-transcripts.ts` says.

import {
  BOARD_PROTOCOL_VERSION,
  type SnapshotCommand,
  type SnapshotReply,
} from "../schemas/board-protocol/index.ts";
import { LIFECYCLE } from "./lifecycle.ts";
import { lifecycleBoard, lifecycleWaiting } from "./lifecycle-messages.ts";
import type { LifecycleTranscriptStep } from "./lifecycle-transcripts.ts";
import { lifecycleSnapshotResult } from "./snapshot.ts";

const version = BOARD_PROTOCOL_VERSION;

/** The request IDs of the exchange: 22 base64url characters each, as action IDs are. */
const SNAPSHOT_REQUEST_IDS = {
  saved: "dQ7rU2nVx5LpS8wKa3fYgC",
  writeFailed: "eR4sV9oWy6MqT1xLb5gZhD",
  noProjectRoot: "fS8tW3pXz2NrU7yMc6hAjE",
  discarded: "gT2uX7qYa9OsV4zNd1iBkF",
} as const;

/** A step of E7's transcript: E3's kinds of step, and the Snapshot messages. */
export type SnapshotTranscriptStep =
  | LifecycleTranscriptStep
  | { readonly socket: number; readonly from: "page"; readonly message: SnapshotCommand }
  | { readonly socket: number; readonly from: "host"; readonly message: SnapshotReply };

export type SnapshotTranscript = {
  readonly askId: string;
  readonly token: string;
  readonly steps: readonly SnapshotTranscriptStep[];
};

const request = (requestId: string, unsentWork = false): SnapshotCommand => ({
  version,
  type: "snapshot",
  requestId,
  ...(unsentWork ? { unsentWork: true } : {}),
});

const snapshotSaved: SnapshotReply = {
  version,
  type: "snapshot-saved",
  requestId: SNAPSHOT_REQUEST_IDS.saved,
  path: lifecycleSnapshotResult.path,
};

const writeFailed: SnapshotReply = {
  version,
  type: "snapshot-failed",
  requestId: SNAPSHOT_REQUEST_IDS.writeFailed,
  reason: "write-failed",
  folder: "/home/sara/shop/.askboard/snapshots",
};

const noProjectRoot: SnapshotReply = {
  version,
  type: "snapshot-failed",
  requestId: SNAPSHOT_REQUEST_IDS.noProjectRoot,
  reason: "no-project-root",
};

const discarded: SnapshotReply = {
  version,
  type: "snapshot-failed",
  requestId: SNAPSHOT_REQUEST_IDS.discarded,
  reason: "discarded",
};

/** One valid message of each type protocol 1.2 adds, in each direction. */
export const snapshotProtocolExamples: {
  readonly toHost: readonly SnapshotCommand[];
  readonly toPage: readonly SnapshotReply[];
} = {
  toHost: [request(SNAPSHOT_REQUEST_IDS.writeFailed, true)],
  toPage: [snapshotSaved, writeFailed, noProjectRoot, discarded],
};

/** A board's Snapshot saved, then failed with write-failed, no-project-root and discarded. */
export const snapshotTranscript: SnapshotTranscript = {
  askId: LIFECYCLE.askId,
  token: LIFECYCLE.token,
  steps: [
    { socket: 1, from: "page", message: { version, type: "connect", token: LIFECYCLE.token } },
    { socket: 1, from: "host", message: lifecycleBoard },
    { socket: 1, from: "host", message: lifecycleWaiting },
    { socket: 1, from: "page", message: request(SNAPSHOT_REQUEST_IDS.saved) },
    { socket: 1, from: "host", message: snapshotSaved },
    { socket: 1, from: "page", message: request(SNAPSHOT_REQUEST_IDS.writeFailed, true) },
    { socket: 1, from: "host", message: writeFailed },
    { socket: 1, from: "page", message: request(SNAPSHOT_REQUEST_IDS.noProjectRoot) },
    { socket: 1, from: "host", message: noProjectRoot },
    { socket: 1, from: "page", message: request(SNAPSHOT_REQUEST_IDS.discarded) },
    { socket: 1, from: "host", message: discarded },
  ],
};

/** E7's transcripts, by name. */
export const snapshotTranscripts: Readonly<Record<string, SnapshotTranscript>> = {
  snapshot: snapshotTranscript,
};
