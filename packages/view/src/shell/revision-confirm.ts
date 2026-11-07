// Revising a verdict the agent has received asks first (approval-scale-ranking, design decisions
// 5 and 6; F-63, FR-22). Pure: when a confirmation is needed, from the status the board last
// heard and the facts the chunks of the question's items registered, and how a press waits for
// it. The dialog is the card's.

import type { HeldAct, LifecycleQuestionStatus } from "@askboard/contract";
import { type ComponentFacts, componentFacts } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";

/**
 * Whether "Answer" or Decline on the question asks first: its latest answer or decline has been
 * delivered to the agent, and one of its widget items has facts that ask for it. A question the
 * agent has not received an answer of, whose receipt reads queued or sent, is revised freely.
 */
export const confirmsRevisionOf = (
  question: ViewQuestion,
  status: LifecycleQuestionStatus | undefined,
  factsOf: (type: string) => ComponentFacts | undefined = componentFacts,
): boolean =>
  (status?.state === "answered" || status?.state === "declined") &&
  status.answer.receipt === "delivered" &&
  (question.props.items ?? []).some(({ type }) => factsOf(type)?.confirmsRevision === true);

/**
 * Whether a press of "Answer" or Decline asks first: a confirmation is needed, and the press does
 * more than take back the act the question holds for Submit, which only changes the draft.
 */
export const asksFirst = (
  act: "answer" | "decline",
  question: ViewQuestion,
  status: LifecycleQuestionStatus | undefined,
  held: HeldAct["act"] | undefined,
  factsOf?: (type: string) => ComponentFacts | undefined,
): boolean => held !== act && confirmsRevisionOf(question, status, factsOf);

/** An act waiting for the user's confirmation; it runs at most once, and never after Cancel. */
export type Waiting = { readonly confirm: () => void; readonly cancel: () => void };

/**
 * A press of "Answer" or Decline: when no confirmation is needed the act runs now and nothing
 * waits; when one is, the act waits for `settle`.
 */
export const press = (needed: boolean, run: () => void): Waiting | undefined => {
  if (!needed) {
    run();
    return undefined;
  }
  let open = true;
  return {
    confirm: () => {
      if (!open) return;
      open = false;
      run();
    },
    cancel: () => {
      open = false;
    },
  };
};

/** The user's choice: confirming runs the waiting act once; Cancel drops it, the draft as it was. */
export const settle = (waiting: Waiting | undefined, confirmed: boolean): void => {
  if (confirmed) waiting?.confirm();
  else waiting?.cancel();
};

/**
 * A confirmation under way: the act waiting, what runs it, and the control the user pressed to ask
 * for it, which is where focus goes back on Cancel or Escape. `Control` is the card's element; the
 * helpers below read none of it.
 */
export type Confirmation<Control> = {
  readonly act: "answer" | "decline";
  readonly waiting: Waiting;
  readonly control: Control | undefined;
};

/** Where focus goes once the dialog has closed: the control pressed, or the question's heading. */
export type FocusTarget<Control> =
  | { readonly to: "control"; readonly control: Control }
  | { readonly to: "heading" };

/** The confirmation a press made, or none when the press acted at once. */
export const confirmationOf = <Control>(
  act: "answer" | "decline",
  waiting: Waiting | undefined,
  control: Control | undefined,
): Confirmation<Control> | undefined =>
  waiting === undefined ? undefined : { act, waiting, control };

/**
 * The user's choice on a confirmation, and where focus goes: Cancel and Escape give back the
 * control pressed (the dialog has no trigger, so Radix restores none); a confirmed Decline gives
 * the heading, as the menu item that made it is gone; a confirmed Answer gives none.
 */
export const settleConfirmation = <Control>(
  confirmation: Confirmation<Control> | undefined,
  confirmed: boolean,
): FocusTarget<Control> | undefined => {
  settle(confirmation?.waiting, confirmed);
  if (confirmation === undefined) return undefined;
  if (confirmed) return confirmation.act === "decline" ? { to: "heading" } : undefined;
  return confirmation.control === undefined
    ? undefined
    : { to: "control", control: confirmation.control };
};
