// The references a question's work stands on (oversized-acts, design decision 2): its work record
// and the value, result and entry each of its items holds. The stores replace what changes and keep
// what does not, so a notice set on these references stays exactly while the question's work is as
// it was when the command was refused, however large the work is.

import type { ViewQuestion } from "../view-document.ts";
import type { ShownOf } from "./agent-change.ts";
import { type BoardDraft, itemIdsOf, resultIdsOf } from "./board-draft.ts";
import type { DraftStore } from "./draft-store.ts";
import { entryIdsOf, idsOver } from "./entries.ts";

export type WorkStores = {
  readonly draft: DraftStore;
  readonly results?: DraftStore | undefined;
  readonly entries?: DraftStore | undefined;
  readonly board: BoardDraft;
  /** The question as the card shows it: the work after "Keep mine" stands on that revision's items. */
  readonly shownOf?: ShownOf | undefined;
};

/**
 * The references of the question's work, in a fixed order: the items of the question and, where the
 * card shows another revision of it (`shownOf`), of that revision too, since work held only on an
 * item a later revision removed is still the question's work (document-review, design decision 15;
 * review S-3 of 6.17).
 */
export const workRefsOf = (
  question: ViewQuestion,
  { draft, results, entries, board, shownOf }: WorkStores,
): readonly unknown[] => {
  const shown = shownOf?.(question) ?? question;
  return [
    board.work(question.id),
    ...idsOver(itemIdsOf, question, shown).map((itemId) => draft.valueOf(itemId)),
    ...idsOver(resultIdsOf, question, shown).map((itemId) => results?.valueOf(itemId)),
    ...idsOver(entryIdsOf, question, shown).map((itemId) => entries?.valueOf(itemId)),
  ];
};

/** Whether two lists hold the same references, one by one. */
export const sameRefs = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((ref, index) => Object.is(ref, b[index]));
