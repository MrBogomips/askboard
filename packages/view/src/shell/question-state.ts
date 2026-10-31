// What a question card shows (EXPERIENCE.md, Question card, Answer and Delivery receipt): from the
// question's status in the board state, its draft value, the answer the user has just sent, if
// any, the answer the board page holds for it, whether its items have loaded, and whether the
// board page locked the board. The board state wins: once it says answered, the card shows the
// logged answer with its receipt, read-only (FR-22); then what the board page holds; then the act
// until the board page has replied to it. Nothing can be chosen or answered before the question is visible, once its item failed
// (AD-9, AD-10), or on a board that moved or was discarded (AD-21).

import type { BoardQuestion, BoardState, QuestionStatus } from "@askboard/contract";
import type { PendingAnswer, ViewAnswer } from "../view-protocol.ts";
import type { QuestionStatus as Load } from "./ready-tracker.ts";

/** The board's receipt texts (EXPERIENCE.md, Voice and Tone). */
export type ReceiptText = "not sent yet" | "sent" | "delivered to the agent";

const RECEIPTS = {
  queued: "not sent yet",
  sent: "sent",
  delivered: "delivered to the agent",
} as const;

/** The answer the user sent from this card, until the board state shows it logged. */
export type Act = {
  readonly choice: readonly string[];
  readonly when: string;
  /** Set once the board page has replied: sent, or queued until the board reconnects. */
  readonly outcome?: "sent" | "queued";
};

export type CardState = {
  readonly phase: "open" | "sending" | "answered";
  /** What the options show in place of the draft value. */
  readonly shown?: readonly string[];
  readonly receipt?: ReceiptText;
  readonly readOnly: boolean;
  readonly canAnswer: boolean;
};

/** The question's choice: the option labels Choice put in the draft record, none while unset. */
export const choiceOf = (value: unknown): readonly string[] => (Array.isArray(value) ? value : []);

export const statusOf = (state: BoardState, itemId: string): QuestionStatus | undefined =>
  state.questions.find((question) => question.itemId === itemId);

export const cardState = (
  status: QuestionStatus | undefined,
  value: readonly string[],
  act: Act | undefined,
  load: Load,
  locked = false,
  held?: PendingAnswer,
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
  if (held !== undefined) {
    return {
      phase: "sending",
      shown: held.choice,
      receipt: RECEIPTS[held.outcome],
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
  const answerable = status?.state === "open" && load === "visible" && !locked;
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
