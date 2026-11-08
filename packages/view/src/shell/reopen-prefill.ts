// The reopen prefill (reopen-start-from-answer, design decisions 3 and 4; view spec: A reopened
// question starts from the previous answer): when the agent reopens a question and changes nothing
// in it, the board starts its draft from the user's previous answer, once per revision, and marks
// the work so that a reload never fills it again over what the user undid. Nothing is sent
// (AD-10): the user still answers by an explicit act (AD-20).

import type { LifecycleBoardState } from "@askboard/contract";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ViewLock } from "../view-protocol.ts";
import {
  type BoardDraft,
  createBoardDraft,
  hasAnswerWork,
  type QuestionWork,
} from "./board-draft.ts";
import { fillFrom } from "./card-acts.ts";
import { entriesWithCells } from "./cell-entries.ts";
import { createDraftStore, type DraftRecord, type DraftStore } from "./draft-store.ts";
import { unchangedOf } from "./question-state.ts";
import type { FactsOf } from "./reason.ts";

/** The stores the prefill reads and fills. */
export type PrefillStores = {
  readonly draft: DraftStore;
  readonly results: DraftStore;
  readonly entries: DraftStore;
  readonly cellEntries: DraftStore;
  readonly board: BoardDraft;
  readonly facts?: FactsOf;
};

/** What the draft holds besides the work, by item ID. */
export type HeldValues = {
  readonly values: DraftRecord;
  readonly results: DraftRecord;
  readonly entries: DraftRecord;
};

/**
 * The questions to fill: those the state holds `open` or `postponed` with a previous answer that
 * is no decline and holds the question's own ID unchanged (`unchangedOf`, by the previous role, so
 * a previous answer without the list fills nothing), while the question holds no work on any
 * revision, the mark included, and only while the ask is not closed and the view is not locked
 * (a read-only card is never filled, and the leave-page prompt is never armed for it). Pure.
 */
export const reopenPrefills = (
  document: ViewDocument,
  state: LifecycleBoardState,
  held: HeldValues,
  workOf: (questionId: string) => QuestionWork | undefined,
  lock?: ViewLock,
): readonly ViewQuestion[] =>
  lock !== undefined || state.ask === "closed"
    ? []
    : questionsOf(document).filter((question) => {
        const status = state.questions.find((each) => each.itemId === question.id);
        if (status?.state !== "open" && status?.state !== "postponed") return false;
        const { previous } = status;
        if (previous === undefined || previous.declined === true) return false;
        if (!unchangedOf(previous, "previous")(question.id)) return false;
        const work = workOf(question.id);
        return (
          work === undefined &&
          !hasAnswerWork(
            question,
            held.values,
            undefined,
            held.results,
            entriesWithCells(held.entries, undefined),
          )
        );
      });

// The same carry against scratch stores: whether every part of the answer would be carried.
const wouldCarry = (
  question: ViewQuestion,
  previous: Parameters<typeof fillFrom>[1],
  stores: PrefillStores,
): boolean =>
  fillFrom(question, previous, "previous", {
    draft: createDraftStore(),
    results: createDraftStore(),
    entries: createDraftStore(),
    cellEntries: createDraftStore(),
    board: createBoardDraft(stores.board.get().delivery),
    ...(stores.facts === undefined ? {} : { facts: stores.facts }),
  });

/**
 * Fills each question `reopenPrefills` returns from its previous answer, once, and marks its work:
 * only when every part of the answer fits (a dry run on scratch stores first), else nothing is
 * filled and no mark is set, the same verdict on the next state, since its inputs have not changed.
 * Runs at the end of each update, after the update's restore is applied (design decision 9).
 */
export const prefillReopened = (
  document: ViewDocument,
  state: LifecycleBoardState,
  stores: PrefillStores,
  lock?: ViewLock,
): void => {
  const held = {
    values: stores.draft.record(),
    results: stores.results.record(),
    entries: stores.entries.record(),
  };
  for (const question of reopenPrefills(
    document,
    state,
    held,
    (id) => stores.board.work(id),
    lock,
  )) {
    const previous = state.questions.find((each) => each.itemId === question.id)?.previous;
    if (previous === undefined || !wouldCarry(question, previous, stores)) continue;
    fillFrom(question, previous, "previous", stores);
    stores.board.edit(question.id, question.rev, (work) => ({ ...work, prefilled: true }));
  }
};
