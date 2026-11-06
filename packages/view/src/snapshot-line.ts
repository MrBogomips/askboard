// How a Snapshot request ended, in the words the board shows (snapshot design decision 9;
// EXPERIENCE.md, Voice and Tone: Snapshot): the unsent-work note first when the request said the
// board held some, then the saved file's path, or the failure, with the Snapshot folder only for a
// failed write. The bottom action bar and the Closed banner both show it. The words for
// `internal-error` and the board page's own `unconfirmed` are not in EXPERIENCE.md's Voice and
// Tone yet: they are to review.

import type { SnapshotFailure, SnapshotFeedback } from "./snapshot-feedback.ts";

/** A line of Snapshot feedback: the note, the words, and the path or folder in code type. */
export type SnapshotLine = {
  readonly note?: string;
  readonly text: string;
  readonly code?: string;
  /** A saved Snapshot's full path, which "Copy path" copies; `code` is then this path too. */
  readonly savedPath?: string;
  /** The request went wrong. */
  readonly failed: boolean;
};

/** EXPERIENCE.md, Voice and Tone: Snapshot. */
export const UNSENT_WORK_NOTE = "Your unsent work will not be in the Snapshot";

export const NOT_TAKEN = "No Snapshot was taken";

/** The line while a request waits for its reply. */
export const TAKING = "Taking the Snapshot…";

const FAILURE_TEXTS: Readonly<Record<SnapshotFailure, string>> = {
  "write-failed": `${NOT_TAKEN}: it could not be written in`,
  "no-project-root": `${NOT_TAKEN}: CLAUDE_PROJECT_DIR is not set in this session, and Snapshots are saved only under the project folder it names.`,
  // To review (EXPERIENCE.md has no words for it yet).
  "internal-error": `${NOT_TAKEN}: AskBoard failed to take it.`,
  discarded: `${NOT_TAKEN}: the ask was discarded.`,
  // To review: the file may exist, so it says neither saved nor not taken (NFR-10).
  unconfirmed:
    "The Snapshot was not confirmed: AskBoard did not answer. It may be in the Snapshot folder.",
};

/** The note, when the request said the board held unsent work. */
export const noteOf = (unsentWork: boolean | undefined): { readonly note?: string } =>
  unsentWork === true ? { note: UNSENT_WORK_NOTE } : {};

/** The line while a request waits for its reply. */
export const takingLineOf = (unsentWork: boolean): SnapshotLine => ({
  ...noteOf(unsentWork),
  text: TAKING,
  failed: false,
});

/** The line of a request the board page refused to send, saying why. */
export const refusedLineOf = (detail: string): SnapshotLine => ({
  text: `${NOT_TAKEN}: ${detail}.`,
  failed: true,
});

/** The line of a request that ended. */
export const feedbackLineOf = (feedback: SnapshotFeedback): SnapshotLine => {
  const note = noteOf(feedback.unsentWork);
  if (feedback.outcome === "saved") {
    const { path } = feedback;
    return { ...note, text: "Snapshot saved:", code: path, savedPath: path, failed: false };
  }
  const folder = feedback.reason === "write-failed" ? { code: feedback.folder } : {};
  return { ...note, text: FAILURE_TEXTS[feedback.reason], ...folder, failed: true };
};
