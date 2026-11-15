// What the board shows around its question cards, as pure functions of the board document, the
// state and the lifecycle draft (ask-lifecycle, design decision 6; EXPERIENCE.md, Presentations
// and Counting; FR-2, FR-24): the presentation and its groups, each question's own mark, the open
// count and the tabs' counts, the ask pill, the postponed warning and the next-open jump's order.
// Strings are EXPERIENCE.md's (Voice and Tone).

import type { LifecycleBoardState, Locale } from "@askboard/contract";
import { type StringKey, t } from "../strings/index.ts";
import {
  questionsOf,
  type ViewArea,
  type ViewDocument,
  type ViewQuestion,
} from "../view-document.ts";
import type { ViewLock } from "../view-protocol.ts";
import { type AnswerState, answerStateOf, type FlightOf } from "./answer-state.ts";
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

/**
 * The question the board shows: the question in view, and in one question per view the first
 * question while none (or one the board no longer holds) is in view, since the draft's question in
 * view stays unset until the user navigates (answering-flow-fixes, decision 3).
 */
export const shownQuestionOf = (
  document: ViewDocument,
  inView: string | undefined,
): string | undefined => {
  if (presentationOf(document) !== "one-per-view") return inView;
  const questions = questionsOf(document);
  return questions.some((question) => question.id === inView) ? inView : questions[0]?.id;
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

/**
 * A question's own state, as every surface shows it: the answer state ladder (answering-flow-guidance,
 * decision 1; EXPERIENCE.md, Counting).
 */
export type Mark = AnswerState;

const MARK_KEYS = {
  todo: "mark.unanswered",
  draft: "mark.draft",
  ready: "mark.ready",
  "not-sent-yet": "receipt.notSentYet",
  sent: "receipt.sent",
  delivered: "receipt.delivered",
  postponed: "mark.postponed",
  declined: "mark.declined",
} as const satisfies Record<Mark, StringKey>;

/** A marker's label in the ask's language. */
export const markLabel = (mark: Mark, language: Locale = "en-US"): string =>
  t(language, MARK_KEYS[mark]);

type Work = ReadonlyMap<string, QuestionWork>;

/**
 * What the ladder reads beyond the board state and the held acts, the board's own and the same on
 * every surface: the card's command that has not settled, and whether the question holds answer
 * work (`questionRevising`, from the board's `RevisingSnapshot` set), never derived again here.
 */
export type Ladder = {
  readonly flightOf: (questionId: string) => FlightOf | undefined;
  readonly revisingOf: (questionId: string) => boolean;
};

const statusOf = (state: LifecycleBoardState, questionId: string) =>
  state.questions.find((question) => question.itemId === questionId);

/**
 * The question's mark, as Submit will leave it: `answerStateOf`, over the held act, a held undo, the
 * card's flight, the logged status and the work the board holds. A held answer is ready, a
 * revision's included; a held decline is declined and a held postpone postponed; a held undo
 * starts again from open; a note held alone leaves the question as it is. A logged answer reads
 * Sent or Delivered from its receipt only while it holds no answer work.
 */
export const markOf = (
  questionId: string,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
): Mark =>
  answerStateOf({
    status: statusOf(state, questionId),
    held: work.get(questionId)?.held?.act,
    undone: work.get(questionId)?.undo !== undefined,
    flight: ladder.flightOf(questionId),
    revising: ladder.revisingOf(questionId),
  });

/**
 * Whether a question counts as to do on the board: to do, a first draft, or postponed (EXPERIENCE.md,
 * Counting). A revision (a draft over a logged answer or decline) reads Draft but is not counted:
 * the agent holds an answer, as `ladderCountsOf` counts it.
 */
export const isOpen = (
  questionId: string,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
): boolean => {
  const mark = markOf(questionId, state, work, ladder);
  if (mark === "draft") {
    const logged = statusOf(state, questionId)?.state;
    return logged !== "answered" && logged !== "declined";
  }
  return mark === "todo" || mark === "postponed";
};

/** The header's open count: the board's open questions, those the agent added included. */
export const openCountOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
) => questionsOf(document).filter((question) => isOpen(question.id, state, work, ladder)).length;

/** A tab's open count: its area's. */
export const tabOpenCount = (
  area: ViewArea,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
): number => area.props.items.filter((question) => isOpen(question.id, state, work, ladder)).length;

export type AskPill = {
  readonly kind: "waiting" | "partial" | "answered" | "closed" | "discarded";
  readonly label: string;
};

/**
 * Whether the ask has ended, closed by the agent or discarded: its header drops the open count, the
 * next-open jump and the agent pill, and its options and link-buttons look disabled (review F-18).
 * A board moved to another tab is locked but not ended.
 */
export const endedOf = (lock: ViewLock | undefined): boolean =>
  lock === "closed" || lock === "discarded";

const counted = (state: LifecycleBoardState, which: string): number =>
  state.questions.filter((question) => question.state === which).length;

/**
 * The ask pill: only what the agent has received (AD-10), so ready answers and held acts do not
 * move it. "Partly answered n/m" counts the answered and declined questions out of all; an
 * answered ask adds its postponed and declined counts ("answered, 1 postponed"). A closed or
 * discarded ask says so.
 */
export const askPillOf = (
  state: LifecycleBoardState,
  lock: ViewLock | undefined,
  language: Locale = "en-US",
): AskPill => {
  if (lock === "discarded") return { kind: "discarded", label: t(language, "state.discarded") };
  if (lock === "closed" || state.ask === "closed") {
    return { kind: "closed", label: t(language, "state.closed") };
  }
  if (state.ask === "waiting") return { kind: "waiting", label: t(language, "state.waiting") };
  const answered = counted(state, "answered");
  const declined = counted(state, "declined");
  if (state.ask === "partly-answered") {
    const slots = { answered: answered + declined, total: state.questions.length };
    return { kind: "partial", label: t(language, "state.partly", slots) };
  }
  const postponed = counted(state, "postponed");
  const parts = [
    ...(postponed === 0 ? [] : [t(language, "state.postponedPart", { count: postponed })]),
    ...(declined === 0 ? [] : [t(language, "state.declinedPart", { count: declined })]),
  ];
  return {
    kind: "answered",
    label:
      parts.length === 0
        ? t(language, "state.answered")
        : t(language, "state.answeredWith", { parts: parts.join(", ") }),
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
  ladder: Ladder,
  language: Locale = "en-US",
): string | undefined => {
  const count = questionsOf(document).filter(
    (question) => markOf(question.id, state, work, ladder) === "postponed",
  ).length;
  return count === 0 ? undefined : t(language, "bar.postponedWarning", { count });
};

/**
 * The questions the next-open jump reaches, in its order: the questions the agent added that the
 * user has not seen, then the other open ones, in board order (F-55).
 */
export const nextOpenOrder = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
  unseen: ReadonlySet<string>,
): readonly string[] => {
  const open = questionsOf(document)
    .map((question) => question.id)
    .filter((id) => isOpen(id, state, work, ladder));
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
  ladder: Ladder,
  unseen: ReadonlySet<string>,
  current: string | undefined,
): string | undefined => {
  const ids = questionsOf(document).map((question) => question.id);
  const open = ids.filter((id) => id !== current && isOpen(id, state, work, ladder));
  const fresh = open.find((id) => unseen.has(id));
  if (fresh !== undefined) return fresh;
  const at = current === undefined ? -1 : ids.indexOf(current);
  return open.find((id) => ids.indexOf(id) > at) ?? open[0];
};

/**
 * Where the previous-open key goes from the question in view: the open question before it in board
 * order, else the last open one (wrapping); never the question in view, nowhere when no other is
 * open, the last open one when none is in view. Unseen questions get no priority: going back
 * returns to a question the user skipped (board-keys, design decision 3).
 */
export const previousOpenFrom = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
  current: string | undefined,
): string | undefined => {
  const ids = questionsOf(document).map((question) => question.id);
  const open = ids.filter((id) => id !== current && isOpen(id, state, work, ladder));
  const found = current === undefined ? -1 : ids.indexOf(current);
  const at = found < 0 ? ids.length : found;
  return open.filter((id) => ids.indexOf(id) < at).at(-1) ?? open.at(-1);
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
