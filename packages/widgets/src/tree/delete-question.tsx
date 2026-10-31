// The question before deleting a node with children (proposal, open question 11; spec, "Tree
// deleting nodes"): inline in the toolbar row, in place of the tools, never a modal dialog; a
// group, as a `fieldset`, named by its words. It names the node, says how many nodes go with it,
// and opens with the focus on "Cancel"; Escape is "Cancel". It stays until the user answers it,
// and nothing is deleted before "Delete". The node's name is text, never markup (AD-8).

import { type KeyboardEvent, useId, useLayoutEffect, useRef } from "react";
import { QUESTION, QUESTION_NAME, QUESTION_REST, QUESTION_ROW, TOOL, TOOLBAR } from "./classes.ts";
import { deletedWith, type DeleteQuestion as Question } from "./deleting.ts";
import { treeKeyOf } from "./key-event.ts";
import { keyAction } from "./model/keys.ts";

export const DeleteQuestion = ({
  ref,
  question,
  onConfirm,
  onCancel,
}: {
  /** The toolbar row's element, for the Tree's focus. */
  readonly ref: (row: HTMLElement | null) => void;
  readonly question: Question;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) => {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    cancel.current?.focus();
  }, []);

  // Escape means "Cancel", as it cancels an edit (`keys.ts`); the buttons take Enter and Space.
  const onKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>): void => {
    if (keyAction(treeKeyOf(event), "edit")?.kind !== "cancel") return;
    event.preventDefault();
    onCancel();
  };

  return (
    <fieldset
      ref={ref}
      aria-labelledby={id}
      className={`${TOOLBAR} ${QUESTION_ROW}`}
      onKeyDown={onKeyDown}
    >
      <p id={id} className={QUESTION}>
        <span className={QUESTION_NAME}>“{question.label}”</span>{" "}
        <span className={QUESTION_REST}>{deletedWith(question.under)}</span>
      </p>
      <button ref={cancel} type="button" className={TOOL} onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className={TOOL} onClick={onConfirm}>
        Delete
      </button>
    </fieldset>
  );
};
