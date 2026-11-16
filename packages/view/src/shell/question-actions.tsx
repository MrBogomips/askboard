// The question actions row (EXPERIENCE.md, Question actions, Postpone and Answer; DESIGN.md, the
// same; ask-lifecycle, task 6.5; answering-flow-visual, design decision 7): the primary first, beside
// the options (F-19), with its key cap and the reason it waits on, then "Later" (Postpone, a toggle
// that undoes when pressed again) at the row's end. "More" is in the card's head. An answered card
// (the answered look) shows the answer's line and "Edit" in place of the primary and "Later": on a
// ready answer the primary reads "Edit", otherwise a plain button focuses the answer and sends
// nothing. After Postpone or Decline, the board moves on or focus goes to the question's heading, as
// After an answer says (answering-flow-guidance, decision 3; Accessibility Floor, Focus).

import { useId } from "react";
import { useStrings } from "../catalog/port.ts";
import { IconBlocked, IconEdit } from "../icons/index.ts";
import type { FieldToFix } from "./field-block.ts";
import { QuestionMarker } from "./markers.tsx";
import { PrimaryButton } from "./primary-button.tsx";
import { primaryLabelOf } from "./primary-label.ts";
import type { CardActions, CardState } from "./question-state.ts";
import { SizeLines } from "./size-lines.tsx";
import type { SizeNotice } from "./size-notices.ts";
import { BUTTON_LINK_MUTED, BUTTON_SECONDARY } from "./styles.ts";
import { useBoardKeyTable } from "./use-board-keys.ts";

export type ActionsRowProps = {
  /** An opened Snapshot: only the delivery receipt shows. */
  readonly opened?: boolean;
  readonly card: CardState;
  /** The answered look: the answer's line and "Edit" in place of the primary and "Later". */
  readonly questionId: string;
  readonly answered: boolean;
  /** The answer the line names; none for a decline. */
  readonly answerLine: string | undefined;
  /** The primary waits only on a choice: "Choose an option" describes it (design decision 9). */
  readonly nothingChosen: boolean;
  readonly actions: CardActions;
  /**
   * While a field blocks, what describes the disabled "Answer" and the field it names: "Correct
   * {label} first." (atoms, design decision 3; answering-flow-fixes, decision 7). It shows beside
   * "Answer" as a `button-link` that leads to the field, and as hidden text on a locked board.
   */
  readonly fieldToFix?: FieldToFix | undefined;
  /** Moves focus to the field the reason names. */
  readonly onFixField: (itemId: string) => void;
  /** What did not go because it was too large: an answer, a Submit or a refused command. */
  readonly sizeNotice?: SizeNotice | undefined;
  /** The board page left this question's work out of the draft it mirrors (oversized-acts). */
  readonly draftLeftOut?: boolean;
  /** The board is locked: nothing in the row acts. */
  readonly locked: boolean;
  readonly single: boolean;
  readonly submitted: boolean;
  /** Pressed on `control`, the button, which a confirmation gives focus back to. */
  readonly onAnswer: (control: HTMLElement) => void;
  readonly onPostpone: () => void;
  /** "Edit" on a sent, delivered or declined answer: focus the chosen option; send nothing. */
  readonly onEdit: () => void;
};

export const ActionsRow = ({
  opened = false,
  card,
  questionId,
  answered,
  answerLine,
  nothingChosen,
  actions,
  fieldToFix,
  onFixField,
  sizeNotice,
  draftLeftOut = false,
  locked,
  single,
  submitted,
  onAnswer,
  onPostpone,
  onEdit,
}: ActionsRowProps) => {
  const hintId = useId();
  const text = useStrings();
  const answerKey = useBoardKeyTable().find((entry) => entry.action === "board.answer");
  // What describes the disabled primary: the field to correct, as a link to it, or "Choose an option"
  // when only a choice is missing; on a locked board the field's text is hidden.
  const reason =
    answered || opened ? undefined : fieldToFix !== undefined && !locked ? (
      <button
        type="button"
        id={hintId}
        className={BUTTON_LINK_MUTED}
        onClick={() => onFixField(fieldToFix.itemId)}
      >
        {fieldToFix.text}
      </button>
    ) : fieldToFix !== undefined ? (
      <span id={hintId} className="sr-only">
        {fieldToFix.text}
      </span>
    ) : nothingChosen && !locked ? (
      <span id={hintId} className="inline-flex items-center gap-1 text-body text-muted-foreground">
        <IconBlocked className="size-4 shrink-0" />
        {text("question.chooseOption")}
      </span>
    ) : undefined;
  if (opened) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-md">
        {answered && answerLine !== undefined ? (
          <span data-askboard-answer-line="" className="min-w-0 text-body text-foreground">
            <bdi>{text("answer.line", { answer: answerLine })}</bdi>
          </span>
        ) : null}
        {answered && !card.ready ? (
          <button
            type="button"
            data-askboard-edit={questionId}
            className={BUTTON_SECONDARY}
            disabled={locked}
            onClick={onEdit}
          >
            <IconEdit className="size-4" />
            {text("question.edit")}
          </button>
        ) : (
          <PrimaryButton
            card={card}
            entry={answerKey}
            describedBy={reason === undefined ? undefined : hintId}
            single={single}
            submitted={submitted}
            onAnswer={onAnswer}
          >
            {card.ready ? <QuestionMarker mark="ready" inControl /> : null}
            {text(
              primaryLabelOf({
                single,
                delivery: submitted ? "submitted" : "immediate",
                ready: card.ready,
                noteOnly: card.noteOnly,
                // An answered or declined question under edit: it holds its logged receipt.
                revision: card.phase === "open" && card.receiptKind !== undefined,
              }),
            )}
          </PrimaryButton>
        )}
        {reason}
        {answered ? null : (
          <>
            <span className="flex-1" />
            <button
              type="button"
              className={`${BUTTON_SECONDARY} aria-pressed:border-foreground-secondary aria-pressed:font-semibold`}
              aria-pressed={actions.postponed}
              data-askboard-postpone=""
              disabled={!actions.canPostpone}
              onClick={onPostpone}
            >
              {actions.postponed ? <QuestionMarker mark="postponed" inControl /> : null}
              {text("question.postpone")}
            </button>
          </>
        )}
      </div>
      <SizeLines notice={sizeNotice} draftLeftOut={draftLeftOut} />
    </>
  );
};
