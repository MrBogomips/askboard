// Revising a verdict the agent has received asks first (approval-scale-ranking, design decisions
// 5 and 6; F-63, FR-22). Pure: when a confirmation is needed, from the status the board last
// heard and the facts the chunks of the question's items registered, and how a press waits for
// it. The dialog is the card's.

import type { HeldAct, LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import { type ComponentFacts, componentFacts } from "../catalog/port.ts";
import { valueItemsOf } from "../nested-items.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";

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
  valueItemsOf(question.props.items).some(({ type }) => factsOf(type)?.confirmsRevision === true);

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
export type Waiting<R = unknown> = {
  /** Runs the act, once, and gives what the run returned; nothing after the first call or Cancel. */
  readonly confirm: () => R | undefined;
  readonly cancel: () => void;
};

/**
 * A press of "Answer" or Decline: when no confirmation is needed the act runs now and nothing
 * waits; when one is, the act waits for `settle`.
 */
export const press = <R>(needed: boolean, run: () => R): Waiting<R> | undefined => {
  if (!needed) {
    run();
    return undefined;
  }
  let open = true;
  return {
    confirm: () => {
      if (!open) return undefined;
      open = false;
      return run();
    },
    cancel: () => {
      open = false;
    },
  };
};

/**
 * The user's choice: confirming runs the waiting act once and gives what the run returned (the
 * answer's result); Cancel drops it, the draft as it was, and gives nothing.
 */
export const settle = <R>(waiting: Waiting<R> | undefined, confirmed: boolean): R | undefined => {
  if (confirmed) return waiting?.confirm();
  waiting?.cancel();
  return undefined;
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

/**
 * What "Answer" did (answering-flow-fixes, design decision 1): `sent` (an answer command started),
 * `note-sent` (a note alone started), `held` (the answer was marked ready), `released` (the mark
 * was taken back), `note-held` and `note-released` (the same for a note alone, which is no
 * ready answer), or `needs-reason` (nothing was sent or marked for want of the reason).
 */
export type AnswerResult =
  | "sent"
  | "note-sent"
  | "held"
  | "released"
  | "note-held"
  | "note-released"
  | "needs-reason";

/** The confirmation a press made, or none when the press acted at once. */
export const confirmationOf = <Control>(
  act: "answer" | "decline",
  waiting: Waiting | undefined,
  control: Control | undefined,
): Confirmation<Control> | undefined =>
  waiting === undefined ? undefined : { act, waiting, control };

const confirmedTarget = <Control>(
  confirmation: Confirmation<Control>,
  result: unknown,
): FocusTarget<Control> | undefined => {
  if (confirmation.act === "decline") return { to: "heading" };
  if (result === "sent" || result === "note-sent") return { to: "heading" };
  const kept =
    result === "held" ||
    result === "released" ||
    result === "note-held" ||
    result === "note-released";
  if (kept && confirmation.control !== undefined) {
    return { to: "control", control: confirmation.control };
  }
  return undefined;
};

/**
 * The user's choice on a confirmation, and where focus goes: Cancel and Escape give back the
 * control pressed (the dialog has no trigger, so Radix restores none); a confirmed Decline gives
 * the heading, as the menu item that made it is gone; a confirmed Answer gives the heading when it
 * sent (the run returned `sent` or `note-sent`) and the control when it marked or unmarked the answer
 * ready (`held`, `released`), and none when the run returned no known result.
 */
export const settleConfirmation = <Control>(
  confirmation: Confirmation<Control> | undefined,
  confirmed: boolean,
): FocusTarget<Control> | undefined => {
  const result = settle(confirmation?.waiting, confirmed);
  if (confirmation === undefined) return undefined;
  if (confirmed) return confirmedTarget(confirmation, result);
  return confirmation.control === undefined
    ? undefined
    : { to: "control", control: confirmation.control };
};

/** A question with an act held for Submit; the work is read for the act alone. */
export type HeldEntry = {
  readonly question: ViewQuestion;
  readonly work: { readonly held: { readonly act: HeldAct["act"] } };
};

/**
 * The questions Submit asks about, in board order: those whose held answer or decline would
 * replace a latest answer or decline the agent has received (its receipt reads `delivered`) on a
 * question holding an item whose chunk asks for it, whether or not the press that held the act
 * asked, the receipt having possibly turned `delivered` since. A held postpone, note or reopen
 * replaces nothing. `shownOf` gives the question as its card shows it, whose items decide.
 */
export const questionsToConfirm = (
  document: ViewDocument,
  held: readonly HeldEntry[],
  state: LifecycleBoardState,
  factsOf?: (type: string) => ComponentFacts | undefined,
  shownOf?: (question: ViewQuestion) => ViewQuestion,
): readonly ViewQuestion[] =>
  questionsOf(document).filter((question) => {
    const act = held.find((entry) => entry.question.id === question.id)?.work.held.act;
    if (act !== "answer" && act !== "decline") return false;
    const status = state.questions.find((each) => each.itemId === question.id);
    // The items that ask are those of the revision the card shows and the act names (Issue #92).
    return confirmsRevisionOf(shownOf?.(question) ?? question, status, factsOf);
  });
