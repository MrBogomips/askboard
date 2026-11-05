// A board's Snapshot (snapshot design decision 8; board-host spec, A Snapshot requested by the
// board, A board's Snapshot that fails, A board's Snapshot AskBoard fails to take): the reply each
// of ask-core's outcomes gets, naming the request. An owner refusal, which only an agent's request
// gets, is an error to report, answered `internal-error` as a rejection is.

import { BOARD_PROTOCOL_VERSION, type SnapshotReply } from "@askboard/contract";
import type { SnapshotOutcome } from "@askboard/core";

const version = BOARD_PROTOCOL_VERSION;

/** The reply to the board's request `requestId`, or the error to report for an outcome it never gets. */
export const snapshotReply = (
  askId: string,
  requestId: string,
  outcome: SnapshotOutcome,
): SnapshotReply | Error => {
  switch (outcome.outcome) {
    case "saved":
      return { version, type: "snapshot-saved", requestId, path: outcome.path };
    case "write-failed":
      return {
        version,
        type: "snapshot-failed",
        requestId,
        reason: "write-failed",
        folder: outcome.folder,
      };
    case "no-project-root":
    case "discarded":
      return failedWithoutFolder(outcome.outcome, requestId);
    case "refused":
      return new Error(
        `ask-core refused the board's Snapshot of the ask "${askId}" (${outcome.why}); a board's request carries no owner check`,
      );
  }
};

/** `snapshot-failed` for a reason that names no folder. */
const failedWithoutFolder = (
  reason: "no-project-root" | "internal-error" | "discarded",
  requestId: string,
): SnapshotReply => ({ version, type: "snapshot-failed", requestId, reason });

/** What a request still waiting for ask-core hears when the ask is discarded meanwhile (AD-21). */
export const snapshotDiscarded = (requestId: string): SnapshotReply =>
  failedWithoutFolder("discarded", requestId);

/** What a request hears when ask-core fails to take its Snapshot, or answers it out of turn. */
export const snapshotFailedInside = (requestId: string): SnapshotReply =>
  failedWithoutFolder("internal-error", requestId);
