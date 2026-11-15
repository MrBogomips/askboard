// The answer state ladder (answering-flow-guidance, design decision 1; EXPERIENCE.md, Counting):
// one state per question, pure, from the act held for Submit, the command in flight, the status
// the board last heard and the work in the draft. The card, the outline, the navigator and the
// completion panel read it, so no two surfaces hold their own notion of a question's state.

import type { HeldAct, LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
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
  /** What the draft holds for the question: `answerContentOf`. */
  readonly content: AnswerContent;
};

const filled = (text: string | undefined): boolean => text !== undefined && text !== "";
const some = (record: object | undefined): boolean =>
  record !== undefined && Object.keys(record).length > 0;

// The work that makes an answer: the choice, the "Other…" text, the option notes and the widget
// values and results; a note alone is no answer (FR-7).
const answers = ({ choice, other, optionNotes, values, results }: AnswerContent): boolean =>
  (choice !== undefined && choice.length > 0) ||
  filled(other) ||
  some(optionNotes) ||
  some(values) ||
  some(results);

/** The question's state on the ladder. */
export const answerStateOf = ({
  status,
  held,
  undone = false,
  flight,
  content,
}: AnswerStateInputs): AnswerState => {
  if (held === "answer") return "ready";
  if (held === "decline") return "declined";
  if (held === "postpone") return "postponed";
  const reopened = held === "reopen" || undone;
  if (!reopened) {
    if (flight?.outcome === "queued") return "not-sent-yet";
    if (status?.state === "answered") {
      if (answers(content)) return "draft";
      return status.answer.receipt;
    }
    if (status?.state === "declined") return "declined";
    if (status?.state === "postponed") return "postponed";
  }
  return answers(content) || filled(content.note) ? "draft" : "todo";
};

/** The count of the board's questions in each state. */
export type LadderCounts = Readonly<Record<AnswerState, number>>;

/**
 * Each state's count over the board: the completion panel reads it now, and a ledger later. The
 * work and the flights are the board's; `contentOf` is the draft's answer content for a question.
 */
export const ladderCountsOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: ReadonlyMap<string, QuestionWork>,
  flightOf: (questionId: string) => Pick<Flight, "outcome"> | undefined,
  contentOf: (question: ViewQuestion) => AnswerContent,
): LadderCounts => {
  const counts = Object.fromEntries(ANSWER_STATES.map((each) => [each, 0])) as Record<
    AnswerState,
    number
  >;
  const statuses = new Map<string, LifecycleQuestionStatus>();
  for (const status of state.questions)
    if (!statuses.has(status.itemId)) statuses.set(status.itemId, status);
  for (const question of questionsOf(document)) {
    const own = work.get(question.id);
    counts[
      answerStateOf({
        status: statuses.get(question.id),
        held: own?.held?.act,
        undone: own?.undo !== undefined,
        flight: flightOf(question.id),
        content: contentOf(question),
      })
    ] += 1;
  }
  return counts;
};
