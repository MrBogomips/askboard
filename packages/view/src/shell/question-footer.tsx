// The footer of a card the board stayed on, with the setting "Stay here" (answering-flow-guidance,
// design decision 3; DESIGN.md, Continue footer): the question's state and the question that is next,
// then "Continue", which takes focus when the footer appears and makes the move. The next question's
// title is agent text: shown as text, cut at the agent-label length and isolated for bidirectional
// text (AD-8, NFR-5). The footer leaves with "Continue", on an edit to its question (the card's `revise`), on an act
// on another and when the board no longer holds its target (`Flow`, `Board`).

import { useEffect, useRef } from "react";
import { useStrings } from "../catalog/port.ts";
import { IconEdit } from "../icons/index.ts";
import type { Mark } from "./board-view.ts";
import { cutTitle } from "./flow-messages.ts";
import type { Footer } from "./guided-flow.ts";
import { revealAndFocus } from "./reveal.ts";
import { BUTTON_SECONDARY } from "./styles.ts";

// The footer takes the tone of the state it names, as the badge does (design decision 7).
const TONES: Readonly<Record<Mark, string>> = {
  todo: "text-foreground-secondary",
  draft: "text-primary-text",
  ready: "text-primary-text",
  "not-sent-yet": "text-warning-text",
  sent: "text-info-text",
  delivered: "text-success-text",
  postponed: "text-foreground-secondary",
  declined: "text-foreground-secondary",
};

export const QuestionFooter = ({
  footer,
  questionId,
  state,
  mark,
  number,
  onEdit,
  onContinue,
}: {
  readonly footer: Footer;
  /** The question the footer is under: its "Edit" carries it as the test hook. */
  readonly questionId: string;
  /** The question's state line text: "Sent", "Ready, not sent". */
  readonly state: string;
  /** The question's state, whose tone draws the footer (design decision 7; frame 03). */
  readonly mark: Mark;
  /** The next question's short number, after its title; none where the board gives none. */
  readonly number?: number | undefined;
  /** "Edit", before "Continue", on a sent answer. */
  readonly onEdit?: (() => void) | undefined;
  readonly onContinue: () => void;
}) => {
  const text = useStrings();
  const button = useRef<HTMLButtonElement>(null);
  // "Continue" takes the focus where the footer appears, without scrolling the page.
  useEffect(() => {
    if (button.current !== null) revealAndFocus(button.current);
  }, []);
  // The title ends the sentence in both languages, so the text before it is the string with no title.
  const lead = text("footer.next", { title: "" });
  return (
    <div
      data-askboard-footer=""
      data-askboard-footer-state={mark}
      className={`flex flex-wrap items-center justify-end gap-md border-t border-border pt-sm text-body ${TONES[mark]}`}
    >
      <span>
        {state} · {lead}
        <bdi className="inline-block max-w-full">{cutTitle(footer.title)}</bdi>
        {number === undefined ? null : (
          <>
            {" "}
            <span data-askboard-number="" className="font-mono text-code">
              {text("question.number", { n: number })}
            </span>
          </>
        )}
        {footer.area === undefined ? null : (
          <>
            {" "}
            (<bdi className="inline-block max-w-full">{cutTitle(footer.area)}</bdi>)
          </>
        )}
        {footer.newFromAgent ? ` · ${text("footer.newFromAgent")}` : null}
      </span>
      {onEdit === undefined ? null : (
        <button
          type="button"
          data-askboard-edit={questionId}
          className={BUTTON_SECONDARY}
          onClick={onEdit}
        >
          <IconEdit className="size-4" />
          {text("question.edit")}
        </button>
      )}
      <button
        ref={button}
        type="button"
        data-askboard-continue=""
        className={BUTTON_SECONDARY}
        onClick={onContinue}
      >
        {text("footer.continue")}
      </button>
    </div>
  );
};
