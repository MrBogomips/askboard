// The messages `board-host` sends over the board protocol (contract, board protocol set): built from
// what ask-core shows of an ask, and refusals whose detail fits the contract's limit. Protocol 1.1
// (ask-lifecycle, design decisions 2 and 5): the board and state of an ask of several questions,
// acknowledgements, the draft record and the closed ask.

import {
  BOARD_PROTOCOL_VERSION,
  type ClosedReason,
  type CurrentAnswer,
  type DiscardReason,
  type DraftRecord,
  type LifecycleBoardState,
  type LifecycleHostMessage,
  type LifecycleQuestionStatus,
  REFUSAL_DETAIL_MAX_CHARS,
  type RefusalReason,
} from "@askboard/contract";
import type { Problem } from "@askboard/contract/validate";
import type { AnswerView, LifecycleBoardView, LifecycleQuestionView } from "@askboard/core";

const version = BOARD_PROTOCOL_VERSION;

/** What ask-core shows of an ask that is not discarded: its board is told with `discarded`. */
export type OpenBoardView = Exclude<LifecycleBoardView, { readonly state: "discarded" }>;

// An answer as the board shows it: its content, when, its receipt and whether it was recorded;
// never who or its cursor, which the board does not need.
const currentOf = (answer: AnswerView): CurrentAnswer => ({
  ...(answer.choice === undefined ? {} : { choice: [...answer.choice] }),
  ...(answer.other === undefined ? {} : { other: answer.other }),
  ...(answer.optionNotes === undefined ? {} : { optionNotes: { ...answer.optionNotes } }),
  ...(answer.note === undefined ? {} : { note: answer.note }),
  ...(answer.values === undefined ? {} : { values: { ...answer.values } }),
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
export const stateOf = (board: OpenBoardView): LifecycleBoardState => ({
  ask: board.state,
  // An ask always holds a question: ask-core refuses to delete its last (FR-6).
  questions: board.questions.map(statusOf) as unknown as LifecycleBoardState["questions"],
});

export const boardMessage = (board: OpenBoardView): LifecycleHostMessage => ({
  version,
  type: "board",
  document: board.document,
});

export const stateMessage = (board: OpenBoardView): LifecycleHostMessage => ({
  version,
  type: "state",
  state: stateOf(board),
});

export const receiptMessage = (itemId: string): LifecycleHostMessage => ({
  version,
  type: "receipt",
  itemId,
  receipt: "delivered",
});

export const MOVED: LifecycleHostMessage = { version, type: "moved" };

/** The ask was discarded: at the session's exit, or past the grace period (AD-21). */
export const discardedMessage = (reason: DiscardReason): LifecycleHostMessage => ({
  version,
  type: "discarded",
  reason,
});

/** Text cut to the contract's limit on a refusal's detail, in code points as the schema counts. */
export const cutDetail = (text: string): string => {
  const points = Array.from(text);
  if (points.length === 0) return "refused";
  if (points.length <= REFUSAL_DETAIL_MAX_CHARS) return text;
  return `${points.slice(0, REFUSAL_DETAIL_MAX_CHARS - 1).join("")}…`;
};

const PROBLEMS_SHOWN = 5;

/** The detail of a schema refusal: the first problems, each at its path unless it names its type. */
export const problemsDetail = (problems: readonly Problem[]): string =>
  problems
    .slice(0, PROBLEMS_SHOWN)
    .map(({ path, message }) =>
      path === "/" || path === "/type" ? message : `${path}: ${message}`,
    )
    .join("; ");

export const refusedMessage = (
  reason: RefusalReason,
  detail: string,
  itemId?: string,
): LifecycleHostMessage => ({
  version,
  type: "refused",
  reason,
  detail: cutDetail(detail),
  ...(reason === "answer" && itemId !== undefined ? { itemId } : {}),
});

// Protocol 1.1's host messages (ask-lifecycle, design decision 8): appended after E1's.

/** The act command with this action ID is applied, once (AD-20). */
export const doneMessage = (actionId: string): LifecycleHostMessage => ({
  version,
  type: "done",
  actionId,
});

/** An act command refused whole, naming its action ID and the act that refused it (AD-20). */
export const actRefusedMessage = (
  actionId: string,
  index: number,
  itemId: string,
  detail: string,
): LifecycleHostMessage => ({
  version,
  type: "refused",
  reason: "act",
  detail: cutDetail(detail),
  actionId,
  index,
  itemId,
});

/** An act command on a closed ask, naming its action ID (FR-6). */
export const closedRefusedMessage = (actionId: string, detail: string): LifecycleHostMessage => ({
  version,
  type: "refused",
  reason: "closed",
  detail: cutDetail(detail),
  actionId,
});

/** The ask's draft record, restored to its board (AD-20). */
export const draftMessage = (record: DraftRecord): LifecycleHostMessage => ({
  version,
  type: "draft",
  record,
});

/** The ask is closed: its board locks (FR-6). */
export const closedMessage = (reason: ClosedReason): LifecycleHostMessage => ({
  version,
  type: "closed",
  reason,
});
