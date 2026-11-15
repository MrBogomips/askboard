// The completion panel's model (answering-flow-guidance, design decision 6; EXPERIENCE.md,
// Completion): pure, from the board document, the state, the work and the flights. It counts from
// the questions' receipts only, never from `state.ask` or the ask pill, so the panel claims
// nothing the receipts do not (NFR-10, AD-3).

import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
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

const statusesOf = (state: LifecycleBoardState): Map<string, LifecycleQuestionStatus> => {
  const statuses = new Map<string, LifecycleQuestionStatus>();
  for (const status of state.questions)
    if (!statuses.has(status.itemId)) statuses.set(status.itemId, status);
  return statuses;
};

/**
 * The counts of the receipts the board logged: `sent` is the questions whose logged answer or
 * decline has a receipt (`sent` or `delivered`), a revision included; `delivered` those whose
 * receipt is `delivered`. Never `state.ask`, never the ladder, whose counts leave out a question
 * while it is revising.
 */
export const receiptCountsOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
): { readonly sent: number; readonly delivered: number } => {
  const statuses = statusesOf(state);
  let sent = 0;
  let delivered = 0;
  for (const question of questionsOf(document)) {
    const receipt = receiptOf(statuses.get(question.id));
    if (receipt === undefined) continue;
    sent += 1;
    if (receipt === "delivered") delivered += 1;
  }
  return { sent, delivered };
};

/** What the completion panel shows, if anything. */
export const completionOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: ReadonlyMap<string, QuestionWork>,
  flightOf: (questionId: string) => Pick<Flight, "outcome"> | undefined,
  revisingOf: (question: ViewQuestion) => boolean,
  delivery: Delivery,
): Completion => {
  const questions = questionsOf(document);
  if (questions.length < 2) return NONE;
  const statuses = statusesOf(state);

  let heldAnswers = 0;
  let heldActs = 0;
  const postponed: string[] = [];
  for (const question of questions) {
    if (flightOf(question.id) !== undefined) return NONE;
    const own = work.get(question.id);
    const status = statuses.get(question.id);
    const ladder: AnswerState = answerStateOf({
      status,
      held: own?.held?.act,
      undone: own?.undo !== undefined,
      flight: flightOf(question.id),
      revising: revisingOf(question),
    });
    // A revision (a draft on a logged answer or decline) keeps the panel: only a first draft or
    // a question to do holds it back.
    const revision = status?.state === "answered" || status?.state === "declined";
    if (ladder === "todo" || (ladder === "draft" && !revision)) return NONE;
    if (own?.held !== undefined) {
      heldActs += 1;
      if (own.held.act === "answer") heldAnswers += 1;
    }
    if (ladder === "postponed" && status?.state === "postponed") postponed.push(question.id);
  }
  if (heldActs > 0) {
    return delivery === "submitted" ? { kind: "send-all", count: heldAnswers } : NONE;
  }
  const [first] = postponed;
  if (first !== undefined) return { kind: "postponed", count: postponed.length, first };
  // Finished: every question has a logged answer or decline with its receipt.
  const { sent, delivered } = receiptCountsOf(document, state);
  return sent === questions.length ? { kind: "done", sent, delivered } : NONE;
};
