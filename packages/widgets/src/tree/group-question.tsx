// The question before an edit makes a leaf a group (view spec, "Making a work package a group asks
// first", "The group question's words"; design decision 2): the delete question's sibling, inline
// in the toolbar row in place of the tools, never a modal dialog, a group as a `fieldset` named by
// its words. It names the leaf, says what leaves with it and how many tasks depend on it, and opens
// with the focus on "Cancel"; Escape is "Cancel". It stays until the user answers it, and nothing
// changes before "Continue". The leaf's name is text, never markup (AD-8).

import { useStrings } from "@askboard/view/catalog";
import { type KeyboardEvent, useId } from "react";
import { QUESTION, QUESTION_NAME, QUESTION_REST, QUESTION_ROW, TOOL } from "./classes.ts";
import { groupedWith, type GroupQuestion as Question } from "./grouping.ts";
import { treeKeyOf } from "./key-event.ts";
import { keyAction } from "./model/keys.ts";

/**
 * The question's key handler: Escape means "Cancel", as it cancels an edit (`keys.ts`); the buttons
 * take Enter and Space, and a key an input method is composing is not the question's.
 */
export const questionKeyDown =
  (onCancel: () => void) =>
  (event: KeyboardEvent<HTMLFieldSetElement>): void => {
    if (keyAction(treeKeyOf(event), "edit")?.kind !== "cancel") return;
    event.preventDefault();
    onCancel();
  };

/** Puts the focus on "Cancel" as it mounts: the safe answer, as the delete question does. */
export const focusOnMount = (button: HTMLButtonElement | null): void => button?.focus();

export const GroupQuestion = ({
  question,
  onConfirm,
  onCancel,
}: {
  readonly question: Question;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) => {
  const text = useStrings();
  const id = useId();

  return (
    <fieldset aria-labelledby={id} className={QUESTION_ROW} onKeyDown={questionKeyDown(onCancel)}>
      <p id={id} className={QUESTION}>
        <span className={QUESTION_NAME}>“{question.label}”</span>{" "}
        <span className={QUESTION_REST}>{groupedWith(question, text)}</span>
      </p>
      <button ref={focusOnMount} type="button" className={TOOL} onClick={onCancel}>
        {text("tree.group.cancel")}
      </button>
      <button type="button" className={TOOL} onClick={onConfirm}>
        {text("tree.group.continue")}
      </button>
    </fieldset>
  );
};
