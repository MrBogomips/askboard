// The answered look (answering-flow-visual, design decision 7; requirement "The answered look and
// Edit"): pure. A card looks answered while its answer stands and no revision is in draft.

import type { AnswerState } from "./answer-state.ts";
import { cutTitle } from "./flow-messages.ts";

const ANSWERED: ReadonlySet<AnswerState> = new Set<AnswerState>([
  "ready",
  "sent",
  "delivered",
  "declined",
]);

/** True for Ready, Sent, Delivered and Declined while no revision is in draft. */
export const answeredLookOf = (state: AnswerState, revising: boolean): boolean =>
  !revising && ANSWERED.has(state);

/**
 * The answer a card names on its answered look: the chosen labels, then the "Other…" text, joined
 * with ", " and cut as the status message cuts them; none when the answer names no choice (a
 * decline, a note alone). Agent and user text: shown as data (AD-8).
 */
export const answerLineOf = (
  choice: readonly string[] | undefined,
  other: string | undefined,
): string | undefined => {
  const parts = [...(choice ?? []), ...(other === undefined || other === "" ? [] : [other])];
  return parts.length === 0 ? undefined : cutTitle(parts.join(", "));
};

/**
 * The same answer as parts, for the card to draw each in an element of its own (an override in one
 * label cannot reorder the next): each chosen label, then the "Other…" text, each cut as the line
 * cuts; none when the answer names no choice.
 */
export const answerPartsOf = (
  choice: readonly string[] | undefined,
  other: string | undefined,
): readonly string[] | undefined => {
  const parts = [...(choice ?? []), ...(other === undefined || other === "" ? [] : [other])];
  return parts.length === 0 ? undefined : parts.map(cutTitle);
};
