// The "Accept as is" button of the question actions row (accept-as-sent, design decision 1;
// EXPERIENCE.md, Question card: Question actions): a secondary button that answers the question with
// its content as the agent sent it. It has no icon and no key of its own: `Ctrl+Enter` stays the
// primary's (decision 7). Its hint is its accessible description, read in place of a reason. The row
// gives it the strings and the ID, so that the button holds no hook.

import { BUTTON_SECONDARY } from "./styles.ts";

export type AcceptAsIsButtonProps = {
  /** A notice, a command on its way or a field that blocks: it waits. */
  readonly disabled: boolean;
  /** Pressed on `control`, the button, which a confirmation gives focus back to. */
  readonly onAccept: (control: HTMLElement) => void;
};

type DrawnProps = AcceptAsIsButtonProps & {
  readonly label: string;
  readonly hint: string;
  readonly hintId: string;
};

export const AcceptAsIsButton = ({ disabled, onAccept, label, hint, hintId }: DrawnProps) => (
  <>
    <button
      type="button"
      data-askboard-accept-as-is=""
      className={BUTTON_SECONDARY}
      disabled={disabled}
      aria-describedby={hintId}
      onClick={(event) => onAccept(event.currentTarget)}
    >
      {label}
    </button>
    <span id={hintId} className="sr-only">
      {hint}
    </span>
  </>
);
