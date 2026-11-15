// What the answer key does on a card (board-keys, design decisions 3 and 4). Pure.

import { BOARD_PART, type KeyEntry, keyActionOf } from "@askboard/contract";
import { type KeyEventFields, keyPressOf } from "../catalog/keys/press.ts";
import type { StringKey } from "../strings/index.ts";
import { boardKeyScopeOf, type ScopeElement } from "./board-key-scope.ts";
import type { FieldToFix } from "./field-block.ts";
import type { CardState } from "./question-state.ts";

export type AnswerableInputs = {
  readonly card: Pick<CardState, "phase" | "readOnly">;
  /** The question is answered (a revision may be under way). */
  readonly answered: boolean;
  /** An agent change waits for the user's choice. */
  readonly pending: boolean;
};

/**
 * Whether the card can take an answer now (finding S-5, task 2b.2): the question is visible, nothing
 * is in flight and the card is no answered one left as it is. A pending agent change on an answered
 * card gives false: the key then does nothing and announces nothing.
 */
export const answerableOf = ({ card, answered, pending }: AnswerableInputs): boolean =>
  !card.readOnly && card.phase === "open" && !(answered && pending);

export type AnswerKeyInputs = {
  /** An opened Snapshot. */
  readonly opened: boolean;
  /** The board is locked. */
  readonly locked: boolean;
  /** The question can take an answer now: visible, nothing in flight, not an answered card left as it is. */
  readonly answerable: boolean;
  /** The primary button is enabled. */
  readonly canAnswer: boolean;
  /** An agent change waits for the user's choice. */
  readonly pending: boolean;
  readonly fieldToFix: FieldToFix | undefined;
  /** Nothing chosen and no note. */
  readonly empty: boolean;
};

export type AnswerKeyVerdict =
  | { readonly verdict: "press" }
  | {
      readonly verdict: "announce";
      readonly message: Extract<
        StringKey,
        "status.answerChangePending" | "status.answerBlocked" | "status.answerEmpty"
      >;
      readonly reason?: string;
    }
  | { readonly verdict: "none" };

export const answerKeyOf = (input: AnswerKeyInputs): AnswerKeyVerdict => {
  if (input.opened || input.locked || !input.answerable) return { verdict: "none" };
  if (input.canAnswer) return { verdict: "press" };
  if (input.pending) return { verdict: "announce", message: "status.answerChangePending" };
  if (input.fieldToFix !== undefined) {
    return { verdict: "announce", message: "status.answerBlocked", reason: input.fieldToFix.text };
  }
  if (input.empty) return { verdict: "announce", message: "status.answerEmpty" };
  return { verdict: "none" };
};

/** What a card's keydown reads of the event. */
export type AnswerKeyEvent = Omit<KeyEventFields, "target"> & {
  readonly repeat: boolean;
  readonly target: ScopeElement | null;
};

/**
 * What the card's own keydown does (design decision 4). The key is the card's when the press
 * matches `board.answer` on one of this question's own controls: its default is then prevented
 * whatever the verdict (engines differ on a focused button or radio), `defaultPrevented` is not read
 * (Radix's Checkbox prevents Enter's), and a repeat does nothing (NFR-10: a held key never sends
 * what the user did not choose). A link, a text field and any other key stay the control's.
 */
export const answerKeyHandling = (
  table: readonly KeyEntry[],
  event: AnswerKeyEvent,
  questionId: string,
  inputs: AnswerKeyInputs,
): { readonly prevent: boolean; readonly verdict: AnswerKeyVerdict } => {
  const left = { prevent: false, verdict: { verdict: "none" } } as const;
  if (keyActionOf(table, BOARD_PART, keyPressOf(event), false)?.action !== "board.answer") {
    return left;
  }
  const scope = boardKeyScopeOf(event.target);
  if (typeof scope !== "object" || scope.card !== questionId) return left;
  if (event.repeat) return { prevent: true, verdict: { verdict: "none" } };
  return { prevent: true, verdict: answerKeyOf(inputs) };
};
