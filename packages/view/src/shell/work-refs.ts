// The references a question's work stands on (oversized-acts, design decision 2): its work record
// and the value, result and entry each of its items holds. The stores replace what changes and keep
// what does not, so a notice set on these references stays exactly while the question's work is as
// it was when the command was refused, however large the work is.

import type { ViewQuestion } from "../view-document.ts";
import { type BoardDraft, itemIdsOf, resultIdsOf } from "./board-draft.ts";
import type { DraftStore } from "./draft-store.ts";
import { entryIdsOf } from "./entries.ts";

export type WorkStores = {
  readonly draft: DraftStore;
  readonly results?: DraftStore | undefined;
  readonly entries?: DraftStore | undefined;
  readonly board: BoardDraft;
};

/** The references of the question's work, in a fixed order. */
export const workRefsOf = (
  question: ViewQuestion,
  { draft, results, entries, board }: WorkStores,
): readonly unknown[] => [
  board.work(question.id),
  ...itemIdsOf(question).map((itemId) => draft.valueOf(itemId)),
  ...resultIdsOf(question).map((itemId) => results?.valueOf(itemId)),
  ...entryIdsOf(question).map((itemId) => entries?.valueOf(itemId)),
];

/** Whether two lists hold the same references, one by one. */
export const sameRefs = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((ref, index) => Object.is(ref, b[index]));
