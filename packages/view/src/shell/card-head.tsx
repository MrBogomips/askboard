// The head of a question card (answering-flow-visual, design decision 7; EXPERIENCE.md, Question
// card; DESIGN.md, Question card and State badge): the short number (`{typography.code}`, muted),
// the header chip, a spacer, the state badge, and "More" as an icon button named `question.more`,
// which moved here from the actions row. The badge is the state's text with its marker on the tone's
// subtle fill: the stripe on the card's edge is never the only sign (WCAG 1.4.1). The chip is agent
// text, rendered as text (AD-8). The delivery receipt's hook (`data-askboard-receipt`) stays on the
// badge of the three states of a sent answer, where the state line carried it.

import { DropdownMenu } from "radix-ui";
import { useRef } from "react";
import { useLanguage, useStrings } from "../catalog/port.ts";
import { IconMore } from "../icons/index.ts";
import { type Mark, markLabel } from "./board-view.ts";
import { QuestionMarker } from "./markers.tsx";
import type { CardActions } from "./question-state.ts";
import { BUTTON_SECONDARY, CHIP, FOCUS_RING } from "./styles.ts";

const MENU =
  "z-20 flex min-w-36 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-control text-foreground shadow-md";

const MENU_ITEM = `flex cursor-pointer items-center gap-sm rounded-md px-sm py-1 outline-none select-none data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground data-[disabled]:opacity-50 ${FOCUS_RING}`;

// The receipt hook (`data-askboard-receipt`) a state keeps: only the three states of a sent answer.
const RECEIPT_OF: Readonly<Partial<Record<Mark, "queued" | "sent" | "delivered">>> = {
  "not-sent-yet": "queued",
  sent: "sent",
  delivered: "delivered",
};

// The tone of each state's badge: its subtle fill and text, from the role tokens.
const TONES: Readonly<Record<Mark, string>> = {
  todo: "bg-muted text-foreground-secondary",
  draft: "bg-primary-subtle text-primary-text",
  ready: "bg-primary-subtle text-primary-text",
  "not-sent-yet": "bg-warning-subtle text-warning-text",
  sent: "bg-info-subtle text-info-text",
  delivered: "bg-success-subtle text-success-text",
  postponed: "bg-muted text-foreground-secondary",
  declined: "bg-muted text-foreground-secondary",
};

export type CardHeadProps = {
  /** The question's short number; none on the single-question board and in a Snapshot. */
  readonly number: number | undefined;
  readonly chip: string | undefined;
  readonly mark: Mark;
  /** An opened Snapshot: no "More". */
  readonly opened: boolean;
  readonly locked: boolean;
  readonly actions: CardActions;
  readonly onExplain: () => void;
  /**
   * Whether the decline went through; false while a confirmation waits for the user. `control` is
   * the More menu's trigger, which a confirmation gives focus back to.
   */
  readonly onDecline: (control: HTMLElement | undefined) => boolean;
  /** Decline went through and the menu has closed: the card moves on or focuses the heading. */
  readonly onMenuClosed: () => void;
};

export const CardHead = ({
  number,
  chip,
  mark,
  opened,
  locked,
  actions,
  onExplain,
  onDecline,
  onMenuClosed,
}: CardHeadProps) => {
  const text = useStrings();
  const language = useLanguage();
  // Decline moves focus to the heading once the menu has closed, instead of back to "More".
  const toHeading = useRef(false);
  const more = useRef<HTMLButtonElement>(null);
  return (
    <div data-askboard-card-head="" className="flex items-center gap-sm">
      {number === undefined ? null : (
        <span data-askboard-number="" className="font-mono text-code text-muted-foreground">
          {text("question.number", { n: number })}
        </span>
      )}
      {chip === undefined ? null : <span className={CHIP}>{chip}</span>}
      <span className="flex-1" />
      <span
        data-askboard-state={mark}
        data-askboard-receipt={RECEIPT_OF[mark]}
        className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-badge ${TONES[mark]}`}
      >
        <QuestionMarker mark={mark} />
        {markLabel(mark, language)}
      </span>
      {opened ? null : (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger
            ref={more}
            aria-label={text("question.more")}
            title={text("question.more")}
            className={`${BUTTON_SECONDARY} w-control-height justify-center px-0`}
            disabled={locked}
          >
            <IconMore className="size-4" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className={MENU}
              onCloseAutoFocus={(event) => {
                if (!toHeading.current) return;
                toHeading.current = false;
                event.preventDefault();
                onMenuClosed();
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
                    <QuestionMarker mark="declined" inControl />
                  </DropdownMenu.ItemIndicator>
                </span>
                {text("question.decline")}
              </DropdownMenu.CheckboxItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
};
