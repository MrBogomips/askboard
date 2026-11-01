// What a question card shows (EXPERIENCE.md, Question card, Answer and Delivery receipt): from the
// question's status in the board state, its draft answer (the choice, and the value of each widget
// item the user changed, design decision 7), the answer the user has just sent, if any, the answer
// the board page holds for it, whether its items have loaded, and whether the board page locked
// the board. The board state wins: once it says answered, the card shows the logged answer with
// its receipt, read-only (FR-22); then what the board page holds; then the act until the board
// page has replied to it. Nothing can be chosen or answered before the question is visible, once
// one of its items failed (AD-9, AD-10), or on a board that moved or was discarded (AD-21).

import type { BoardState, QuestionStatus } from "@askboard/contract";
import type { ViewQuestion } from "../view-document.ts";
import type { AnswerContent, PendingAnswer, ViewAnswer } from "../view-protocol.ts";
import type { DraftRecord } from "./draft-store.ts";
import type { QuestionStatus as Load } from "./ready-tracker.ts";

/** The board's receipt texts (EXPERIENCE.md, Voice and Tone). */
export type ReceiptText = "not sent yet" | "sent" | "delivered to the agent";

const RECEIPTS = {
  queued: "not sent yet",
  sent: "sent",
  delivered: "delivered to the agent",
} as const;

/** The answer the user sent from this card, until the board state shows it logged. */
export type Act = AnswerContent & {
  readonly when: string;
  /** Set once the board page has replied: sent, or queued until the board reconnects. */
  readonly outcome?: "sent" | "queued";
};

export type CardState = {
  readonly phase: "open" | "sending" | "answered";
  /** What the card's items show in place of their draft values: an answer's content. */
  readonly shown?: AnswerContent;
  readonly receipt?: ReceiptText;
  readonly readOnly: boolean;
  readonly canAnswer: boolean;
};

/** The question's choice: the option labels Choice put in the draft record, none while unset. */
export const choiceOf = (value: unknown): readonly string[] => (Array.isArray(value) ? value : []);

/**
 * What "Answer" would send now: the question's choice, if it has one, and the draft value of each
 * of its widget items that holds one, which a widget sets only while it differs from the agent's
 * content (design decision 7). Built with own properties only, so any item ID is a plain key.
 */
export const draftAnswerOf = (question: ViewQuestion, record: DraftRecord): AnswerContent => {
  const choice = choiceOf(record.get(question.id));
  const changed = (question.props.items ?? []).flatMap(({ id }) => {
    const value = record.get(id);
    return value === undefined ? [] : [[id, value] as const];
  });
  return {
    ...(choice.length === 0 ? {} : { choice }),
    ...(changed.length === 0 ? {} : { values: Object.fromEntries(changed) }),
  };
};

/**
 * What an item of the card shows in place of its draft value, if anything: the shown choice for
 * the question's own options, the shown value for a widget item, looked up as an own property.
 */
export const shownFor = (
  shown: AnswerContent | undefined,
  questionId: string,
  itemId: string,
): unknown => {
  if (shown === undefined) return undefined;
  if (itemId === questionId) return shown.choice;
  const { values } = shown;
  return values !== undefined && Object.hasOwn(values, itemId) ? values[itemId] : undefined;
};

export const statusOf = (state: BoardState, itemId: string): QuestionStatus | undefined =>
  state.questions.find((question) => question.itemId === itemId);

export const cardState = (
  status: QuestionStatus | undefined,
  draft: AnswerContent,
  act: Act | undefined,
  load: Load,
  locked = false,
  held?: PendingAnswer,
): CardState => {
  if (status?.state === "answered") {
    const { choice, receipt } = status.answer;
    return {
      phase: "answered",
      shown: { choice },
      receipt: RECEIPTS[receipt],
      readOnly: true,
      canAnswer: false,
    };
  }
  if (held !== undefined) {
    return {
      phase: "sending",
      shown: { choice: held.choice },
      receipt: RECEIPTS[held.outcome],
      readOnly: true,
      canAnswer: false,
    };
  }
  if (act !== undefined) {
    return {
      phase: "sending",
      shown: contentOf(act),
      ...(act.outcome === undefined ? {} : { receipt: RECEIPTS[act.outcome] }),
      readOnly: true,
      canAnswer: false,
    };
  }
  const answerable = status?.state === "open" && load === "visible" && !locked;
  const content = draft.choice !== undefined || draft.values !== undefined;
  return { phase: "open", readOnly: !answerable, canAnswer: answerable && content };
};

/**
 * An answer's content alone, with the choice copied: the fields it has, never one set to
 * undefined, since the view protocol refuses a field that is present and not valid.
 */
export const contentOf = ({ choice, values }: AnswerContent): AnswerContent => ({
  ...(choice === undefined ? {} : { choice: [...choice] }),
  ...(values === undefined ? {} : { values }),
});

/** The answer view message for the draft's answer, stamped with the time of the act. */
export const answerOf = (question: ViewQuestion, draft: AnswerContent, at: Date): ViewAnswer => ({
  type: "answer",
  itemId: question.id,
  rev: question.rev,
  ...contentOf(draft),
  when: at.toISOString(),
});
