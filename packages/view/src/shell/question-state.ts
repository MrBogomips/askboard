// What a question card shows (EXPERIENCE.md, Question card, Answer and Delivery receipt): from the
// question's status in the board state, its draft value, the answer the user has just sent, if
// any, and whether its items have loaded. The board state wins: once it says answered, the card
// shows the logged answer with its receipt, read-only (FR-22). Nothing can be chosen or answered
// before the question is visible, or once its item failed (AD-9, AD-10).

import type { BoardQuestion, BoardState, QuestionStatus } from "@askboard/contract";
import type { ViewAnswer } from "../view-protocol.ts";
import type { QuestionStatus as Load } from "./ready-tracker.ts";

/** The board's receipt texts (EXPERIENCE.md, Voice and Tone); task 8.6 adds "not sent yet". */
export type ReceiptText = "sent" | "delivered to the agent";

const RECEIPTS = { sent: "sent", delivered: "delivered to the agent" } as const;

/** The answer the user sent from this card, until the board state shows it logged. */
export type Act = {
  readonly choice: readonly string[];
  readonly when: string;
  /** Set once the board page has replied that it sent the answer. */
  readonly outcome?: "sent";
};

export type CardState = {
  readonly phase: "open" | "sending" | "answered";
  /** What the options show in place of the draft value. */
  readonly shown?: readonly string[];
  readonly receipt?: ReceiptText;
  readonly readOnly: boolean;
  readonly canAnswer: boolean;
};

export const statusOf = (state: BoardState, itemId: string): QuestionStatus | undefined =>
  state.questions.find((question) => question.itemId === itemId);

export const cardState = (
  status: QuestionStatus | undefined,
  value: readonly string[],
  act: Act | undefined,
  load: Load,
): CardState => {
  if (status?.state === "answered") {
    const { choice, receipt } = status.answer;
    return {
      phase: "answered",
      shown: choice,
      receipt: RECEIPTS[receipt],
      readOnly: true,
      canAnswer: false,
    };
  }
  if (act !== undefined) {
    return {
      phase: "sending",
      shown: act.choice,
      ...(act.outcome === undefined ? {} : { receipt: RECEIPTS[act.outcome] }),
      readOnly: true,
      canAnswer: false,
    };
  }
  const answerable = status?.state === "open" && load === "visible";
  return { phase: "open", readOnly: !answerable, canAnswer: answerable && value.length > 0 };
};

/** The answer view message for the question's choice, stamped with the time of the act. */
export const answerOf = (
  question: BoardQuestion,
  choice: readonly string[],
  at: Date,
): ViewAnswer => ({
  type: "answer",
  itemId: question.id,
  rev: question.rev,
  choice: [...choice],
  when: at.toISOString(),
});
