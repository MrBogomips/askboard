// The question actions row (EXPERIENCE.md, Question actions, Postpone, More, Decline, Explain and
// Answer; DESIGN.md, the same; ask-lifecycle, task 6.5): on the left Postpone, a toggle that
// undoes when pressed again, and "More", a Radix Dropdown Menu, keyboard operable, holding Explain
// and Decline, which also undoes when chosen again; on the right the delivery receipt and "Answer".
// After Postpone or Decline, focus moves to the question's heading (Accessibility Floor, Focus).
// The menu is not modal, so it locks no scroll and adds no style element.

import { DropdownMenu } from "radix-ui";
import { useRef } from "react";
import { useStrings } from "../catalog/port.ts";
import { QuestionMarker } from "./markers.tsx";
import type { CardActions, CardState } from "./question-state.ts";
import { BUTTON_ANSWER, BUTTON_ANSWER_PRIMARY, BUTTON_SECONDARY, FOCUS_RING } from "./styles.ts";

const MENU =
  "z-20 flex min-w-36 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-control text-foreground shadow-md";

const MENU_ITEM = `flex cursor-default items-center gap-sm rounded-md px-sm py-1 outline-none select-none data-[highlighted]:bg-accent data-[disabled]:text-muted-foreground data-[disabled]:opacity-50 ${FOCUS_RING}`;

export type ActionsRowProps = {
  /** An opened Snapshot: only the delivery receipt shows. */
  readonly opened?: boolean;
  readonly card: CardState;
  readonly actions: CardActions;
  /** The board is locked: nothing in the row acts. */
  readonly locked: boolean;
  readonly single: boolean;
  readonly submitted: boolean;
  readonly onAnswer: () => void;
  readonly onPostpone: () => void;
  readonly onExplain: () => void;
  readonly onDecline: () => void;
  /** Moves focus to the question's heading. */
  readonly focusHeading: () => void;
};

export const ActionsRow = ({
  opened = false,
  card,
  actions,
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
  const text = useStrings();
  if (opened) {
    return card.receipt === undefined ? null : (
      <span className="text-badge text-muted-foreground">{card.receipt}</span>
    );
  }
  return (
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
        <DropdownMenu.Trigger className={BUTTON_SECONDARY} disabled={locked}>
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
                toHeading.current = true;
                onDecline();
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
          onClick={onAnswer}
          aria-pressed={submitted ? card.ready : undefined}
          className={single ? BUTTON_ANSWER_PRIMARY : BUTTON_ANSWER}
        >
          {card.ready ? <QuestionMarker mark="ready" /> : null}
          {text("question.answer")}
        </button>
      </span>
    </div>
  );
};
