// The answer state ladder (answering-flow-guidance, design decision 1; EXPERIENCE.md, Counting):
// one state per question, pure, from the act held for Submit, the command in flight, the status
// the board last heard and the work in the draft. The card, the outline, the navigator and the
// completion panel read it, so no two surfaces hold their own notion of a question's state.

import type { HeldAct, LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { Flight } from "./answer-acts.ts";
import type { QuestionWork } from "./board-draft.ts";

export const ANSWER_STATES = [
  "todo",
  "draft",
  "ready",
  "not-sent-yet",
  "sent",
  "delivered",
  "postponed",
  "declined",
] as const;

export type AnswerState = (typeof ANSWER_STATES)[number];

export type AnswerStateInputs = {
  /** The question's status in the board state, if the state holds it. */
  readonly status: LifecycleQuestionStatus | undefined;
  /** The act held for Submit on the question, if any. */
  readonly held?: HeldAct["act"] | undefined;
  /** A held undo sits on the question (`QuestionWork.undo`): it starts again from open. */
  readonly undone?: boolean;
  /** The latest command of the card's acts that has not settled. */
  readonly flight?: Pick<Flight, "outcome"> | undefined;
  /**
   * The question holds answer work: the caller's `questionRevising`, the base's one rule (an
   * item's value, result or typed entry, "Other…", an option note or the note). The ladder
   * derives nothing from the content itself.
   */
  readonly revising: boolean;
};

/** The question's state on the ladder. */
export const answerStateOf = ({
  status,
  held,
  undone = false,
  flight,
  revising,
}: AnswerStateInputs): AnswerState => {
  if (held === "answer") return "ready";
  if (held === "decline") return "declined";
  if (held === "postpone") return "postponed";
  const reopened = held === "reopen" || undone;
  if (!reopened) {
    if (flight?.outcome === "queued") return "not-sent-yet";
    if (status?.state === "answered") {
      return revising ? "draft" : status.answer.receipt;
    }
    if (status?.state === "declined") return revising ? "draft" : "declined";
    if (status?.state === "postponed") return "postponed";
  }
  return revising ? "draft" : "todo";
};

/** The count of the board's questions in each state. */
export type LadderCounts = Readonly<Record<AnswerState, number>> & {
  /** The `draft` questions whose status is answered or declined: revisions, not to do. */
  readonly revisions: number;
};

/**
 * Each state's count over the board: the completion panel reads it now, and a ledger later. The
 * work and the flights are the board's; `revisingOf` is the caller's `questionRevising` for a question.
 */
export const ladderCountsOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: ReadonlyMap<string, QuestionWork>,
  flightOf: (questionId: string) => Pick<Flight, "outcome"> | undefined,
  revisingOf: (question: ViewQuestion) => boolean,
): LadderCounts => {
  const counts = Object.fromEntries(ANSWER_STATES.map((each) => [each, 0])) as Record<
    AnswerState,
    number
  >;
  let revisions = 0;
  const statuses = new Map<string, LifecycleQuestionStatus>();
  for (const status of state.questions)
    if (!statuses.has(status.itemId)) statuses.set(status.itemId, status);
  for (const question of questionsOf(document)) {
    const own = work.get(question.id);
    const status = statuses.get(question.id);
    const ladder = answerStateOf({
      status,
      held: own?.held?.act,
      undone: own?.undo !== undefined,
      flight: flightOf(question.id),
      revising: revisingOf(question),
    });
    counts[ladder] += 1;
    if (ladder === "draft" && (status?.state === "answered" || status?.state === "declined"))
      revisions += 1;
  }
  return { ...counts, revisions };
};
