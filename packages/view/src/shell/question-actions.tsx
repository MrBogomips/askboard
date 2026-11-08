// The question actions row (EXPERIENCE.md, Question actions, Postpone, More, Decline, Explain and
// Answer; DESIGN.md, the same; ask-lifecycle, task 6.5): on the left Postpone, a toggle that
// undoes when pressed again, and "More", a Radix Dropdown Menu, keyboard operable, holding Explain
// and Decline, which also undoes when chosen again; on the right the delivery receipt and "Answer".
// After Postpone or Decline, focus moves to the question's heading (Accessibility Floor, Focus).
// The menu is not modal, so it locks no scroll and adds no style element.

import { DropdownMenu } from "radix-ui";
import { useId, useRef } from "react";
import { useStrings } from "../catalog/port.ts";
import { QuestionMarker } from "./markers.tsx";
import type { CardActions, CardState } from "./question-state.ts";
import { SizeLines } from "./size-lines.tsx";
import type { SizeNotice } from "./size-notices.ts";
import { BUTTON_ANSWER, BUTTON_ANSWER_PRIMARY, BUTTON_SECONDARY, FOCUS_RING } from "./styles.ts";

const MENU =
  "z-20 flex min-w-36 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-control text-foreground shadow-md";

const MENU_ITEM = `flex cursor-pointer items-center gap-sm rounded-md px-sm py-1 outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground data-[disabled]:opacity-50 ${FOCUS_RING}`;

export type ActionsRowProps = {
  /** An opened Snapshot: only the delivery receipt shows. */
  readonly opened?: boolean;
  readonly card: CardState;
  readonly actions: CardActions;
  /**
   * While a field holds text it cannot read, what describes the disabled "Answer": "Correct {label}
   * first." (atoms, design decision 3).
   */
  readonly answerHint?: string | undefined;
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
  readonly onExplain: () => void;
  /**
   * Whether the decline went through; false while a confirmation waits for the user. `control` is
   * the More menu's trigger, which a confirmation gives focus back to.
   */
  readonly onDecline: (control: HTMLElement | undefined) => boolean;
  /** Moves focus to the question's heading. */
  readonly focusHeading: () => void;
};

export const ActionsRow = ({
  opened = false,
  card,
  actions,
  answerHint,
  sizeNotice,
  draftLeftOut = false,
  locked,
  single,
  submitted,
  onAnswer,
  onPostpone,
  onExplain,
  onDecline,
  focusHeading,
}: ActionsRowProps) => {
  // Decline moves focus to the heading once the menu has closed, instead of back to "More".
  const toHeading = useRef(false);
  const hintId = useId();
  const more = useRef<HTMLButtonElement>(null);
  const text = useStrings();
  if (opened) {
    return card.receipt === undefined ? null : (
      <span className="text-badge text-muted-foreground">{card.receipt}</span>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-md">
        <button
          type="button"
          className={`${BUTTON_SECONDARY} aria-pressed:border-foreground-secondary aria-pressed:font-semibold`}
          aria-pressed={actions.postponed}
          disabled={!actions.canPostpone}
          onClick={() => {
            onPostpone();
            focusHeading();
          }}
        >
          {actions.postponed ? <QuestionMarker mark="postponed" /> : null}
          {text("question.postpone")}
        </button>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger ref={more} className={BUTTON_SECONDARY} disabled={locked}>
            {text("question.more")}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={4}
              className={MENU}
              onCloseAutoFocus={(event) => {
                if (!toHeading.current) return;
                toHeading.current = false;
                event.preventDefault();
                focusHeading();
              }}
            >
              <DropdownMenu.Item
                className={MENU_ITEM}
                disabled={!actions.canExplain}
                onSelect={onExplain}
              >
                {text("question.explain")}
              </DropdownMenu.Item>
              <DropdownMenu.CheckboxItem
                className={MENU_ITEM}
                checked={actions.declined}
                disabled={!actions.canDecline}
                onSelect={() => {
                  toHeading.current = onDecline(more.current ?? undefined);
                }}
              >
                <span aria-hidden="true" className="flex size-3 items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <QuestionMarker mark="declined" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {text("question.decline")}
              </DropdownMenu.CheckboxItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <span className="ml-auto flex items-center gap-md">
          {card.receipt === undefined ? null : (
            <span className="text-badge text-muted-foreground">{card.receipt}</span>
          )}
          <button
            type="button"
            disabled={!card.canAnswer}
            aria-describedby={answerHint === undefined ? undefined : hintId}
            onClick={(event) => onAnswer(event.currentTarget)}
            aria-pressed={submitted ? card.ready : undefined}
            className={single ? BUTTON_ANSWER_PRIMARY : BUTTON_ANSWER}
          >
            {card.ready ? <QuestionMarker mark="ready" /> : null}
            {text("question.answer")}
          </button>
          {answerHint === undefined ? null : (
            <span id={hintId} className="sr-only">
              {answerHint}
            </span>
          )}
        </span>
      </div>
      <SizeLines notice={sizeNotice} draftLeftOut={draftLeftOut} />
    </>
  );
};
