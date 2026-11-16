// The numbers of the questions the agent removed while the page is open (answering-flow-visual,
// design decision 6; spec "The agent removes a question"): the outline shows "{number} removed by
// the agent" where each stood, until the page reloads. Pure: the questions before and after, and the
// numbers the board gave.

import type { ViewQuestion } from "../view-document.ts";

/** A removed question's number, and the question it stood after on the board (none: at the start). */
export type RemovedNumber = {
  readonly number: number;
  readonly after?: string;
};

/**
 * The entries for the questions in `earlier` that `now` no longer holds, in board order: each takes
 * the nearest earlier question that is still there as its place. A question without a number leaves
 * none.
 */
export const removedNumbersOf = (
  earlier: readonly ViewQuestion[],
  now: ReadonlySet<string>,
  numbers: ReadonlyMap<string, number> | undefined,
): readonly RemovedNumber[] => {
  const removed: RemovedNumber[] = [];
  let after: string | undefined;
  for (const question of earlier) {
    if (now.has(question.id)) {
      after = question.id;
      continue;
    }
    const number = numbers?.get(question.id);
    if (number !== undefined) removed.push({ number, ...(after === undefined ? {} : { after }) });
  }
  return removed;
};
