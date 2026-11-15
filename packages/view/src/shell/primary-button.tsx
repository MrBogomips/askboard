// The question's primary button, "Answer" (board-keys, design decisions 4 and 5): found by its
// `data-askboard-primary`, it carries the answer key as a hint from the board's table in effect,
// and keeps the reason that describes it while a field blocks.

import type { KeyEntry } from "@askboard/contract";
import type { ReactNode } from "react";
import { KeyHint } from "../catalog/keys/key-help.tsx";
import type { CardState } from "./question-state.ts";
import { BUTTON_ANSWER, BUTTON_ANSWER_PRIMARY } from "./styles.ts";

export type PrimaryButtonProps = {
  readonly card: Pick<CardState, "canAnswer" | "ready">;
  /** Its content: the ready marker, if any, and its name. */
  readonly children: ReactNode;
  /** The `board.answer` entry in effect; none when the table has no such entry. */
  readonly entry: KeyEntry | undefined;
  /** The element that holds the reason while a field blocks. */
  readonly describedBy: string | undefined;
  readonly single: boolean;
  readonly submitted: boolean;
  readonly onAnswer: (control: HTMLElement) => void;
};

export const PrimaryButton = ({
  card,
  children,
  entry,
  describedBy,
  single,
  submitted,
  onAnswer,
}: PrimaryButtonProps) => {
  const button = (
    <button
      type="button"
      data-askboard-primary=""
      disabled={!card.canAnswer}
      aria-describedby={describedBy}
      onClick={(event) => onAnswer(event.currentTarget)}
      aria-pressed={submitted ? card.ready : undefined}
      className={single ? BUTTON_ANSWER_PRIMARY : BUTTON_ANSWER}
    >
      {children}
    </button>
  );
  return entry === undefined ? button : <KeyHint entry={entry}>{button}</KeyHint>;
};
