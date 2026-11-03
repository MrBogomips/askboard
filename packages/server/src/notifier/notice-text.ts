// The text of a new ask's system notification (design decision 9; FR-23, EXPERIENCE Notices): the
// ask's title, and a body naming who asked, where it works and how many questions it holds. Agent
// text reaches the notifier only as plain arguments (AD-8): each piece is the contract's
// `agentTextPiece`, cut to the notice limit, its controls and bidirectional controls shown as
// visible escapes, as in the board's header (EXPERIENCE, Agent-written labels).

import { agentTextPiece } from "@askboard/contract";
import type { Notice } from "@askboard/core";

/** The notification as the notifier shows it. */
export type NoticeText = { readonly title: string; readonly body: string };

const SEPARATOR = " · ";

const questions = (count: number): string => `${count} question${count === 1 ? "" : "s"}`;

/**
 * The title and body of a new ask's notification: "<label>[ · <agentName>] · <project> ·
 * <branch>[ · <worktree>] · <n> question(s)", leaving out the pieces the notice lacks. `project`
 * is the session project root's folder name.
 */
export const noticeText = (notice: Notice, project: string): NoticeText => {
  const { origin } = notice;
  const label =
    origin === undefined
      ? undefined
      : origin.ordinal === undefined
        ? origin.label
        : `${origin.label} #${origin.ordinal}`;
  const pieces = [label, notice.agentName, project, origin?.branch, origin?.worktree]
    .filter((piece): piece is string => piece !== undefined && piece !== "")
    .map((piece) => agentTextPiece(piece));
  return {
    title: agentTextPiece(notice.title),
    body: [...pieces, questions(notice.questions)].join(SEPARATOR),
  };
};
