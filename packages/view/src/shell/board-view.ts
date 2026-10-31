// What the board shows around its question cards, as pure functions of the board document, the
// state and the lifecycle draft (ask-lifecycle, design decision 6; EXPERIENCE.md, Presentations
// and Counting; FR-2, FR-24): the presentation and its groups, each question's own mark, the open
// count and the tabs' counts, the ask pill, the postponed warning and the next-open jump's order.
// Strings are EXPERIENCE.md's (Voice and Tone).

import type { LifecycleBoardState } from "@askboard/contract";
import {
  questionsOf,
  type ViewArea,
  type ViewDocument,
  type ViewQuestion,
} from "../view-document.ts";
import type { ViewLock } from "../view-protocol.ts";
import type { QuestionWork } from "./board-draft.ts";

/**
 * How the board lays its questions out: the single-question board for one question, whatever the
 * ask requests (F-100); sections by default; tabs only for areas, since tabs without areas show as
 * one group with no tab strip; one question per view.
 */
export type Presentation = "single" | "sections" | "tabs" | "one-per-view";

export const presentationOf = (document: ViewDocument): Presentation => {
  if (questionsOf(document).length <= 1) return "single";
  const requested = document.presentation ?? "sections";
  const hasAreas = document.items.some((item) => item.type === "area");
  return requested === "tabs" && !hasAreas ? "sections" : requested;
};

/** A group of questions: an area, titled, or the board's questions when it has no areas. */
export type Group = {
  readonly id?: string;
  readonly title?: string;
  readonly questions: readonly ViewQuestion[];
};

/** The board's groups, in board order; an area the agent has emptied is hidden (F-101). */
export const groupsOf = (document: ViewDocument): readonly Group[] => {
  const areas = document.items.filter((item): item is ViewArea => item.type === "area");
  if (areas.length === 0) return [{ questions: questionsOf(document) }];
  return areas
    .filter((area) => area.props.items.length > 0)
    .map((area) => ({ id: area.id, title: area.props.title, questions: area.props.items }));
};

/** A question's own state, as its marker shows it (EXPERIENCE.md, Counting). */
export type Mark = "unanswered" | "ready" | "answered" | "postponed" | "declined";

export const MARK_LABELS: Readonly<Record<Mark, string>> = {
  unanswered: "Unanswered",
  ready: "Ready",
  answered: "Answered",
  postponed: "Postponed",
  declined: "Declined",
};

type Work = ReadonlyMap<string, QuestionWork>;

/**
 * The question's mark, as Submit will leave it: an answer held for Submit is ready, a revision's
 * included; a held decline is declined and a held postpone postponed; a held undo of a sent
 * postpone or decline is unanswered; a note held alone leaves the question as it is. Otherwise
 * what the state says, open being unanswered.
 */
export const markOf = (questionId: string, state: LifecycleBoardState, work: Work): Mark => {
  const held = work.get(questionId)?.held?.act;
  const status = state.questions.find((question) => question.itemId === questionId)?.state;
  if (held === "answer") return "ready";
  if (held === "decline") return "declined";
  if (held === "postpone") return "postponed";
  if (held === "reopen") return "unanswered";
  if (status === "answered" || status === "declined" || status === "postponed") return status;
  return "unanswered";
};

/** Whether a question is open on the board: unanswered or postponed (EXPERIENCE.md, Counting). */
export const isOpen = (questionId: string, state: LifecycleBoardState, work: Work): boolean => {
  const mark = markOf(questionId, state, work);
  return mark === "unanswered" || mark === "postponed";
};

/** The header's open count: the board's open questions, those the agent added included. */
export const openCountOf = (document: ViewDocument, state: LifecycleBoardState, work: Work) =>
  questionsOf(document).filter((question) => isOpen(question.id, state, work)).length;

/** A tab's open count: its area's. */
export const tabOpenCount = (area: ViewArea, state: LifecycleBoardState, work: Work): number =>
  area.props.items.filter((question) => isOpen(question.id, state, work)).length;

export type AskPill = {
  readonly kind: "waiting" | "partial" | "answered" | "closed" | "discarded";
  readonly label: string;
};

const counted = (state: LifecycleBoardState, which: string): number =>
  state.questions.filter((question) => question.state === which).length;

/**
 * The ask pill: only what the agent has received (AD-10), so ready answers and held acts do not
 * move it. "Partly answered n/m" counts the answered and declined questions out of all; an
 * answered ask adds its postponed and declined counts ("answered, 1 postponed"). A closed or
 * discarded ask says so.
 */
export const askPillOf = (state: LifecycleBoardState, lock: ViewLock | undefined): AskPill => {
  if (lock === "discarded") return { kind: "discarded", label: "Discarded" };
  if (lock === "closed" || state.ask === "closed") return { kind: "closed", label: "Closed" };
  if (state.ask === "waiting") return { kind: "waiting", label: "Waiting" };
  const answered = counted(state, "answered");
  const declined = counted(state, "declined");
  if (state.ask === "partly-answered") {
    const total = state.questions.length;
    return { kind: "partial", label: `Partly answered ${answered + declined}/${total}` };
  }
  const postponed = counted(state, "postponed");
  const parts = [
    ...(postponed === 0 ? [] : [`${postponed} postponed`]),
    ...(declined === 0 ? [] : [`${declined} declined`]),
  ];
  return {
    kind: "answered",
    label: parts.length === 0 ? "Answered" : `answered, ${parts.join(", ")}`,
  };
};

/**
 * The bottom action bar's fixed line while postponed questions are still open, held postpones
 * included: closing the tab would lose the ask (L172, L190).
 */
export const postponedWarningOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
): string | undefined => {
  const count = questionsOf(document).filter(
    (question) => markOf(question.id, state, work) === "postponed",
  ).length;
  if (count === 0) return undefined;
  const questions = count === 1 ? "1 postponed question" : `${count} postponed questions`;
  return `You have ${questions}: closing loses this ask`;
};

/**
 * The questions the next-open jump reaches, in its order: the questions the agent added that the
 * user has not seen, then the other open ones, in board order (F-55).
 */
export const nextOpenOrder = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
  unseen: ReadonlySet<string>,
): readonly string[] => {
  const open = questionsOf(document)
    .map((question) => question.id)
    .filter((id) => isOpen(id, state, work));
  return [...open.filter((id) => unseen.has(id)), ...open.filter((id) => !unseen.has(id))];
};

/**
 * Where the next-open jump goes from the question in view: an unseen question the agent added
 * first, else the next open question after it in board order, wrapping to the start (EXPERIENCE.md,
 * Next-open jump and Question navigator); nowhere when no other question is open.
 */
export const nextOpenFrom = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
  unseen: ReadonlySet<string>,
  current: string | undefined,
): string | undefined => {
  const ids = questionsOf(document).map((question) => question.id);
  const open = ids.filter((id) => id !== current && isOpen(id, state, work));
  const fresh = open.find((id) => unseen.has(id));
  if (fresh !== undefined) return fresh;
  const at = current === undefined ? -1 : ids.indexOf(current);
  return open.find((id) => ids.indexOf(id) > at) ?? open[0];
};

/**
 * Where one question per view goes when the agent deletes the question in view: the next question
 * after it in the board's earlier order that is still on the board, else the last one before it
 * (EXPERIENCE.md, Question navigator; F-55).
 */
export const nextAfterRemoval = (
  before: readonly string[],
  after: readonly string[],
  removed: string,
): string | undefined => {
  const at = before.indexOf(removed);
  const kept = new Set(after);
  return (
    before.slice(at + 1).find((id) => kept.has(id)) ??
    before
      .slice(0, Math.max(at, 0))
      .reverse()
      .find((id) => kept.has(id))
  );
};
