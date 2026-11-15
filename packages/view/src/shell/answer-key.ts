// What the answer key does on a card (board-keys, design decisions 3 and 4). Pure.

import type { StringKey } from "../strings/index.ts";
import type { FieldToFix } from "./field-block.ts";

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
