// The Snapshot between the view and the board page (snapshot design decision 8): the view's
// request, the board page's reply to it, and the feedback the board page tells the view in its
// updates once the request ended. Plain ECMAScript, as `view-protocol.ts`, which joins them to its
// messages and its update.

import { ACTION_ID_PATTERN, type SnapshotFailedMessage } from "@askboard/contract";

/** The user pressed "Snapshot": the board page takes it, the whole board (FR-26). */
export type ViewSnapshot = { readonly type: "snapshot" };

/**
 * The board page's reply to the view's request: sent under this request ID, saying whether the
 * board held unsent work, which the Snapshot leaves out; or refused, saying why.
 */
export type SnapshotRequestReply =
  | { readonly outcome: "sent"; readonly requestId: string; readonly unsentWork?: true }
  | { readonly outcome: "refused"; readonly detail: string };

/**
 * Why a request ended with no Snapshot to show: `board-host`'s reason, or the board page's own
 * `unconfirmed`, when the connection dropped or no reply came in time and the file may exist.
 */
export type SnapshotFailure = SnapshotFailedMessage["reason"] | "unconfirmed";

/**
 * How a Snapshot request ended, by its ID: saved at this absolute path, or failed, with the folder
 * only for `write-failed`; `unsentWork` when the board held work the Snapshot leaves out.
 */
export type SnapshotFeedback = { readonly requestId: string; readonly unsentWork?: true } & (
  | { readonly outcome: "saved"; readonly path: string }
  | { readonly outcome: "failed"; readonly reason: "write-failed"; readonly folder: string }
  | { readonly outcome: "failed"; readonly reason: Exclude<SnapshotFailure, "write-failed"> }
);

const ACTION_ID = new RegExp(ACTION_ID_PATTERN);

const FAILURES: readonly unknown[] = [
  "no-project-root",
  "internal-error",
  "discarded",
  "unconfirmed",
] satisfies Exclude<SnapshotFailure, "write-failed">[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string" && value !== "";

// The fields after the outcome: the path, the folder, or neither.
const endedWell = (value: Record<string, unknown>): boolean => {
  if (value.outcome === "saved") return isText(value.path) && value.folder === undefined;
  if (value.outcome !== "failed") return false;
  if (value.reason === "write-failed") return isText(value.folder) && value.path === undefined;
  return FAILURES.includes(value.reason) && value.folder === undefined && value.path === undefined;
};

/** Whether the view can show this as a Snapshot request's end. */
export const isSnapshotFeedback = (value: unknown): value is SnapshotFeedback =>
  isRecord(value) &&
  typeof value.requestId === "string" &&
  ACTION_ID.test(value.requestId) &&
  (value.unsentWork === undefined || value.unsentWork === true) &&
  endedWell(value);
