// The answer state ladder (answering-flow-guidance, design decision 1; EXPERIENCE.md, Counting):
// one state per question, pure, from the act held for Submit, the command in flight, the status
// the board last heard and the work in the draft. The card, the outline, the navigator and the
// completion panel read it, so no two surfaces hold their own notion of a question's state.

import type { HeldAct, LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ViewAct } from "../view-protocol.ts";
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

/**
 * A command on its way, as the ladder reads it: the board page's outcome and the card act it
 * carries for this question (`answer`, `decline`, `postpone` or `reopen`).
 */
export type FlightOf = Pick<Flight, "outcome"> & { readonly act?: ViewAct["type"] | undefined };

export type AnswerStateInputs = {
  /** The question's status in the board state, if the state holds it. */
  readonly status: LifecycleQuestionStatus | undefined;
  /** The act held for Submit on the question, if any. */
  readonly held?: HeldAct["act"] | undefined;
  /** A held undo sits on the question (`QuestionWork.undo`): it starts again from open. */
  readonly undone?: boolean;
  /** The latest command of the card's acts that has not settled. */
  readonly flight?: FlightOf | undefined;
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
    // Once the board page has sent the command it is the state, until the command settles: a
    // sent answer is Sent whatever the board state still holds (the work it carries is not a
    // revision while it is on its way, and a revision never claims the old answer's receipt).
    if (flight?.outcome === "sent") {
      if (flight.act === "answer") return "sent";
      if (flight.act === "decline") return "declined";
      if (flight.act === "postpone") return "postponed";
    }
    if (status?.state === "answered") {
      return revising ? "draft" : status.answer.receipt;
    }
    if (status?.state === "declined") return revising ? "draft" : "declined";
    if (status?.state === "postponed") return "postponed";
  }
  return revising ? "draft" : "todo";
};

/**
 * Whether the question's answer work is a revision (design decision 1): answer work over a logged
 * answer or decline that no undo reopens, a held `reopen`, a held undo (`undone`) or a `reopen`
 * command on its way. A reopened question being edited is a first draft, not a revision.
 */
export const isRevision = ({ status, held, undone = false, flight, revising }: AnswerStateInputs) =>
  revising &&
  (status?.state === "answered" || status?.state === "declined") &&
  held !== "reopen" &&
  !undone &&
  flight?.act !== "reopen";

/** The count of the board's questions in each state. */
export type LadderCounts = Readonly<Record<AnswerState, number>> & {
  /** The `draft` questions that are revisions (`isRevision`): not to do. */
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
  flightOf: (questionId: string) => FlightOf | undefined,
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
    const inputs: AnswerStateInputs = {
      status,
      held: own?.held?.act,
      undone: own?.undo !== undefined,
      flight: flightOf(question.id),
      revising: revisingOf(question),
    };
    const ladder = answerStateOf(inputs);
    counts[ladder] += 1;
    if (ladder === "draft" && isRevision(inputs)) revisions += 1;
  }
  return { ...counts, revisions };
};
