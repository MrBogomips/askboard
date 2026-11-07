// A reason the answer requires (approval-scale-ranking, design decisions 5 and 6): which strings
// the question's open prompt uses. Pure: it reads the facts a chunk registered for the type of
// each of the question's widget items, through a lookup, and the results held or shown.

import { noteHoldsReason } from "@askboard/contract";
import { type ComponentFacts, componentFacts, type ReasonStrings } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
import { shownResultFor } from "./question-state.ts";
import type { Store } from "./store.ts";

/** The facts a widget type's chunk registered, if any. */
export type FactsOf = (type: string) => ComponentFacts | undefined;

/**
 * The strings of the reason the question's answer requires: of the first item of the question, in
 * order, whose facts' `reason` gives a pair for the result the user holds for it, else for the
 * result the card shows of the answer, which is the case while no revision is under way; none when
 * no item requires one. An item without a result is not asked.
 */
export const reasonOf = (
  question: ViewQuestion,
  held: ReadonlyMap<string, unknown>,
  shown: AnswerContent | undefined,
  factsOf: FactsOf = componentFacts,
): ReasonStrings | undefined => {
  const items = question.props.items ?? [];
  const firstPair = (resultOf: (itemId: string) => unknown): ReasonStrings | undefined => {
    for (const { type, id } of items) {
      const result = resultOf(id);
      if (result === undefined) continue;
      const pair = factsOf(type)?.reason?.(result);
      if (pair !== undefined) return pair;
    }
    return undefined;
  };
  return (
    firstPair((id) => held.get(id)) ??
    (shown === undefined ? undefined : firstPair((id) => shownResultFor(shown, question.id, id)))
  );
};

/**
 * Whether the field error shows under the open prompt, and the next value of the flag a press of
 * "Answer" sets: it was asked for, a reason is still required and still missing. It clears when
 * the note gains a reason and when no held result requires one any more, and the card stores it
 * cleared, so that it stays cleared if the text is deleted later; only a press that asks sets the
 * flag again (approval-scale-ranking, design decision 6).
 */
export const reasonAskedAfter = (
  asked: boolean,
  reason: ReasonStrings | undefined,
  note: string | undefined,
): boolean => asked && reason !== undefined && !noteHoldsReason(note);

/**
 * A request for a question's card to ask for its reason, as a press of "Answer" without one
 * does: Submit makes it when a held answer lacks the reason its held result requires. The card
 * takes it and sets the store back to none, so that a card mounted later does not repeat it.
 */
export type ReasonRequest = { readonly questionId: string };
export type ReasonRequests = Store<ReasonRequest | undefined>;
