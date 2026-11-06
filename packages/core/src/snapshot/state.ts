// A Snapshot's board state, as the board receives it (snapshot design decision 1, Receipts): built
// from what ask-core shows of the ask with the gathering's own receipt mapping, since `board-host`'s
// `stateOf` lives where ask-core may not import it (AD-1). Its rule is `stateOf`'s: each answer's
// `delivered` flag gives its receipt, and `who` and the cursor stay out; `board-host`'s tests check
// that a board's Snapshot holds the state its board receives.

import type {
  CurrentAnswer,
  LifecycleBoardState,
  LifecycleQuestionStatus,
} from "@askboard/contract";
import type { AnswerView, LifecycleBoardView, LifecycleQuestionView } from "../lifecycle/views.ts";

/** What ask-core shows of an ask that is not discarded: the only kind a Snapshot is taken of. */
export type OpenBoardView = Exclude<LifecycleBoardView, { readonly state: "discarded" }>;

// An answer as the board shows it: its content, when, its receipt and whether it was recorded.
const currentOf = (answer: AnswerView): CurrentAnswer => ({
  ...(answer.choice === undefined ? {} : { choice: [...answer.choice] }),
  ...(answer.other === undefined ? {} : { other: answer.other }),
  ...(answer.optionNotes === undefined ? {} : { optionNotes: { ...answer.optionNotes } }),
  ...(answer.note === undefined ? {} : { note: answer.note }),
  ...(answer.results === undefined ? {} : { results: { ...answer.results } }),
  ...(answer.declined ? { declined: true as const } : {}),
  when: answer.when,
  receipt: answer.delivered ? "delivered" : "sent",
  ...(answer.recorded ? { recorded: true as const } : {}),
});

const statusOf = (question: LifecycleQuestionView): LifecycleQuestionStatus => {
  const { itemId, rev, state, answer, previous, thread } = question;
  const extras = {
    ...(previous === undefined ? {} : { previous: currentOf(previous) }),
    ...(thread.length === 0
      ? {}
      : {
          thread: thread.map(({ cursor, who, when, text, replies }) => ({
            cursor,
            who,
            when,
            text,
            replies: replies.map((reply) => ({ ...reply })),
          })),
        }),
  };
  if ((state === "answered" || state === "declined") && answer !== undefined) {
    return { itemId, rev, state, answer: currentOf(answer), ...extras } as LifecycleQuestionStatus;
  }
  const open = state === "postponed" ? "postponed" : "open";
  return { itemId, rev, state: open, ...extras } as LifecycleQuestionStatus;
};

/** The board state of an ask that is not discarded (AD-21): its state and every question's. */
export const boardStateOf = (board: OpenBoardView): LifecycleBoardState => ({
  ask: board.state,
  // An ask always holds a question: ask-core refuses to delete its last (FR-6).
  questions: board.questions.map(statusOf) as unknown as LifecycleBoardState["questions"],
});
