// The answers the board page holds (design decision 8, FR-22): each answer from the view, in the
// order given, until a state shows its question no longer open. One given while the board is not
// live waits unsent ("not sent yet"); one sent on a socket that drops before its state shows the
// answer logged is held too. On each new socket, once its state has come, the board page sends
// every held answer whose question that state shows still open, in order (AD-10: never one the
// state no longer allows). `ask-core` refuses a second answer to an answered question, so an
// answer sent again is logged once (design decision 8, Answer idempotence).

import type { AnswerCommand, BoardState } from "@askboard/contract";
import type { PendingAnswer, ViewAnswer } from "../view-protocol.ts";
import { answerCommandFor, type BoardModel } from "./model.ts";

export type HeldAnswer = { readonly answer: ViewAnswer; readonly sent: boolean };

export type Outbox = readonly HeldAnswer[];

export const EMPTY_OUTBOX: Outbox = [];

/** The outbox with this answer last; a question holds one answer, the latest. */
export const hold = (outbox: Outbox, answer: ViewAnswer, sent: boolean): Outbox => [
  ...withoutItem(outbox, answer.itemId),
  { answer, sent },
];

export const withoutItem = (outbox: Outbox, itemId: string): Outbox =>
  outbox.filter((held) => held.answer.itemId !== itemId);

/** The outbox without the answers whose questions the state shows no longer open. */
export const settled = (outbox: Outbox, state: BoardState): Outbox =>
  outbox.filter((held) =>
    state.questions.some(
      (question) => question.itemId === held.answer.itemId && question.state === "open",
    ),
  );

export const hasUnsent = (outbox: Outbox): boolean => outbox.some((held) => !held.sent);

/**
 * The held answers as the view hears of them (M3: the view settles its acts on them). Each held
 * answer became a command first, so it carries a choice (`answerCommandFor`).
 */
export const pendingOf = (outbox: Outbox): PendingAnswer[] =>
  outbox.map(({ answer, sent }) => ({
    itemId: answer.itemId,
    choice: [...(answer.choice ?? [])],
    when: answer.when,
    outcome: sent ? "sent" : "queued",
  }));

export type Flushed = {
  readonly outbox: Outbox;
  /** The answers dropped because the board page would refuse them now, and why. */
  readonly dropped: readonly { readonly itemId: string; readonly detail: string }[];
};

/** Sends each held answer the model still allows, in order, through `send`. */
export const flush = (
  outbox: Outbox,
  model: BoardModel,
  send: (command: AnswerCommand) => boolean,
): Flushed => {
  const kept: HeldAnswer[] = [];
  const dropped: { itemId: string; detail: string }[] = [];
  for (const held of outbox) {
    const command = answerCommandFor(model, held.answer);
    if (!command.ok) dropped.push({ itemId: held.answer.itemId, detail: command.detail });
    else kept.push({ answer: held.answer, sent: send(command.value) });
  }
  return { outbox: kept, dropped };
};
