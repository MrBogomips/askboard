// Whether a question's work holds an edit of its answer: the one predicate the card and the board
// share (reopen-start-from-answer, design decision 2). The card reads it from its own subscriptions;
// the board's content reads it here, from the stores, so that the logged answer fills the board
// only for a question with no revision under way, as it fills the results (Issue #107).

import type { ViewQuestion } from "../view-document.ts";
import { type Revisions, workingQuestion } from "./agent-change.ts";
import { type BoardDraft, hasAnswerWork } from "./board-draft.ts";
import { entriesWithCells } from "./cell-entries.ts";
import type { DraftStore } from "./draft-store.ts";

export type RevisingStores = {
  readonly draft: DraftStore;
  readonly board: BoardDraft;
  readonly revisions: Revisions;
  readonly results?: DraftStore | undefined;
  readonly entries?: DraftStore | undefined;
  readonly cellEntries?: DraftStore | undefined;
};

/**
 * A test of a question for a revision under way, over the stores as they stand at each call: the
 * card's own predicate (`hasAnswerWork` on the question the work was made on), so the board and
 * the card never disagree.
 */
export const createRevising =
  ({ draft, board, revisions, results, entries, cellEntries }: RevisingStores) =>
  (question: ViewQuestion): boolean => {
    const work = board.work(question.id);
    return hasAnswerWork(
      workingQuestion(question, work, revisions),
      draft.record(),
      work,
      results?.record(),
      entriesWithCells(entries?.record(), cellEntries?.record()),
    );
  };
