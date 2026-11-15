// The completion panel's model (answering-flow-guidance, design decision 6; EXPERIENCE.md,
// Completion): pure, from the board document, the state, the work and the flights. It counts from
// the questions' receipts only, never from `state.ask` or the ask pill, so the panel claims
// nothing the receipts do not (NFR-10, AD-3).

import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
import type { Flight } from "./answer-acts.ts";
import { type AnswerState, answerStateOf } from "./answer-state.ts";
import type { Delivery, QuestionWork } from "./board-draft.ts";

export type Completion =
  /** Something is to do, in draft, held back or on its way: no panel. */
  | { readonly kind: "none" }
  /** "All together", nothing to do, acts held: "All ready", beside Send. `count` is the held answers. */
  | { readonly kind: "send-all"; readonly count: number }
  /** Only postponed questions are left, nothing held. */
  | { readonly kind: "postponed"; readonly count: number; readonly first: string }
  /** Every question has an answer or a decline, each sent: the counts are the receipts'. */
  | { readonly kind: "done"; readonly sent: number; readonly delivered: number };

const NONE: Completion = { kind: "none" };

const receiptOf = (status: LifecycleQuestionStatus | undefined) =>
  status?.state === "answered" || status?.state === "declined" ? status.answer.receipt : undefined;

/** What the completion panel shows, if anything. */
export const completionOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: ReadonlyMap<string, QuestionWork>,
  flightOf: (questionId: string) => Pick<Flight, "outcome"> | undefined,
  contentOf: (question: ViewQuestion) => AnswerContent,
  delivery: Delivery,
): Completion => {
  const questions = questionsOf(document);
  if (questions.length < 2) return NONE;
  const statuses = new Map<string, LifecycleQuestionStatus>();
  for (const status of state.questions)
    if (!statuses.has(status.itemId)) statuses.set(status.itemId, status);

  let heldAnswers = 0;
  let heldActs = 0;
  let sent = 0;
  let delivered = 0;
  const postponed: string[] = [];
  let finished = true;
  for (const question of questions) {
    if (flightOf(question.id) !== undefined) return NONE;
    const own = work.get(question.id);
    const status = statuses.get(question.id);
    const ladder: AnswerState = answerStateOf({
      status,
      held: own?.held?.act,
      undone: own?.undo !== undefined,
      flight: flightOf(question.id),
      content: contentOf(question),
    });
    if (ladder === "todo" || ladder === "draft") return NONE;
    if (own?.held !== undefined) {
      heldActs += 1;
      if (own.held.act === "answer") heldAnswers += 1;
    }
    if (ladder === "postponed" && status?.state === "postponed") postponed.push(question.id);
    const receipt = receiptOf(status);
    // Finished: every question has a logged answer or decline with its receipt.
    if (receipt === undefined) finished = false;
    else sent += 1;
    if (receipt === "delivered") delivered += 1;
  }
  if (heldActs > 0) {
    return delivery === "submitted" ? { kind: "send-all", count: heldAnswers } : NONE;
  }
  const [first] = postponed;
  if (first !== undefined) return { kind: "postponed", count: postponed.length, first };
  return finished ? { kind: "done", sent, delivered } : NONE;
};
