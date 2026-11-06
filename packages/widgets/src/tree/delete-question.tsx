// The question before deleting a node with children (proposal, open question 11; spec, "Tree
// deleting nodes"): inline in the toolbar row, in place of the tools, never a modal dialog; a
// group, as a `fieldset`, named by its words. It names the node, says how many nodes go with it,
// and opens with the focus on "Cancel"; Escape is "Cancel". It stays until the user answers it,
// and nothing is deleted before "Delete". It also says how many tasks of the plans over the Tree
// depend on the node; a confirmed delete those plans refuse leaves it open with the refusal after
// its buttons, announced (molecules, view spec, "Deleting a package with dependents"). The node's
// name is text, never markup (AD-8).

import { useStrings } from "@askboard/view/catalog";
import { type KeyboardEvent, useId, useLayoutEffect, useRef } from "react";
import {
  QUESTION,
  QUESTION_ERROR,
  QUESTION_NAME,
  QUESTION_REST,
  QUESTION_ROW,
  TOOL,
} from "./classes.ts";
import { deletedWith, type DeleteQuestion as Question } from "./deleting.ts";
import { treeKeyOf } from "./key-event.ts";
import { keyAction } from "./model/keys.ts";

export const DeleteQuestion = ({
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
    <fieldset aria-labelledby={id} className={QUESTION_ROW} onKeyDown={onKeyDown}>
      <p id={id} className={QUESTION}>
        <span className={QUESTION_NAME}>“{question.label}”</span>{" "}
        <span className={QUESTION_REST}>
          {deletedWith(question.under, question.dependents, text)}
        </span>
      </p>
      <button ref={cancel} type="button" className={TOOL} onClick={onCancel}>
        {text("tree.delete.cancel")}
      </button>
      <button type="button" className={TOOL} onClick={onConfirm}>
        {text("tree.delete.confirm")}
      </button>
      {question.refusal === undefined ? null : (
        <p role="alert" className={QUESTION_ERROR}>
          {question.refusal}
        </p>
      )}
    </fieldset>
  );
};
