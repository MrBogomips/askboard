// The `snapshot` command's request and outcomes (snapshot design decision 3), and the hand-over of
// the gathered data to the writer, whose refusals become typed outcomes. The command itself is
// `AskCore.snapshot`, one appended block of `core.ts`.

import type { LifecycleBoardState, SnapshotData } from "@askboard/contract";
import type { Binding, OwnerRefusal } from "../push/ports.ts";
import type { SnapshotTaker } from "./gather.ts";
import { PROJECT_ROOT_VARIABLE, SnapshotWriteError, type SnapshotWriter } from "./writer.ts";

/**
 * Who asks for the Snapshot: the agent, its call bound to its agent record when it carried one, or
 * the board, whose token is its authority (AD-11), saying whether it holds unsent work.
 */
export type SnapshotRequester =
  | { readonly takenBy: "agent"; readonly caller?: Binding }
  | { readonly takenBy: "user"; readonly unsentWork: boolean };

/** What taking a Snapshot gave. */
export type SnapshotOutcome =
  | {
      readonly outcome: "saved";
      /** The file's absolute real path, as the writer gave it. */
      readonly path: string;
      /** The ask's state when the data was gathered. */
      readonly state: LifecycleBoardState["ask"];
      /** The ask has no owner (AD-5). */
      readonly unchecked: boolean;
    }
  /** A discarded ask, or one this epoch does not hold (AD-10, AD-21): nothing was written. */
  | { readonly outcome: "discarded" }
  /** The agent's call may not act on the owned ask (AD-5): nothing was written. */
  | { readonly outcome: "refused"; readonly why: OwnerRefusal }
  /** No session project root (XC-A1): nothing was written. */
  | { readonly outcome: "no-project-root"; readonly variable: typeof PROJECT_ROOT_VARIABLE }
  /** The Snapshot folder could not take the file, for the reason `code` names. */
  | { readonly outcome: "write-failed"; readonly folder: string; readonly code: string };

/** Who the data says took the Snapshot: the user by `who`, the ask's answerer (FR-19). */
export const takerOf = (request: SnapshotRequester, who: string): SnapshotTaker =>
  request.takenBy === "agent"
    ? { takenBy: "agent" }
    : { takenBy: "user", who, unsentWork: request.unsentWork };

const NO_PROJECT_ROOT: SnapshotOutcome = {
  outcome: "no-project-root",
  variable: PROJECT_ROOT_VARIABLE,
};

/**
 * Hands the data to the writer and gives the outcome. Without a writer no Snapshot can be written,
 * as without a session project root. A rejection that is not a `SnapshotWriteError` breaks the
 * port's contract: it rejects the command unchanged, for the adapter to report.
 */
export const saveSnapshot = async (
  writer: SnapshotWriter | undefined,
  data: SnapshotData,
  unchecked: boolean,
): Promise<SnapshotOutcome> => {
  if (writer === undefined) return NO_PROJECT_ROOT;
  try {
    const { path } = await writer.write(data);
    return { outcome: "saved", path, state: data.state.ask, unchecked };
  } catch (error) {
    if (!(error instanceof SnapshotWriteError)) throw error;
    // Only the refusal for want of a project root names no folder.
    const { folder, code } = error;
    return folder === undefined ? NO_PROJECT_ROOT : { outcome: "write-failed", folder, code };
  }
};
