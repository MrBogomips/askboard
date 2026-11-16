// The footer of a card the board stayed on, with the setting "Stay here" (answering-flow-guidance,
// design decision 3; DESIGN.md, Continue footer): the question's state and the question that is next,
// then "Continue", which takes focus when the footer appears and makes the move. The next question's
// title is agent text: shown as text, cut at the agent-label length and isolated for bidirectional
// text (AD-8, NFR-5). The footer leaves with "Continue", on an edit to its question (the card's `revise`), on an act
// on another and when the board no longer holds its target (`Flow`, `Board`).

import { useEffect, useRef } from "react";
import { useStrings } from "../catalog/port.ts";
import { cutTitle } from "./flow-messages.ts";
import type { Footer } from "./guided-flow.ts";
import { revealAndFocus } from "./reveal.ts";
import { BUTTON_SECONDARY } from "./styles.ts";

export const QuestionFooter = ({
  footer,
  state,
  onContinue,
}: {
  readonly footer: Footer;
  /** The question's state line text: "Sent", "Ready, not sent". */
  readonly state: string;
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
      className="flex flex-wrap items-center justify-end gap-md border-t border-border pt-sm text-body text-foreground-secondary"
    >
      <span>
        {state} · {lead}
        <bdi className="inline-block max-w-full">{cutTitle(footer.title)}</bdi>
        {footer.area === undefined ? null : (
          <>
            {" "}
            (<bdi className="inline-block max-w-full">{cutTitle(footer.area)}</bdi>)
          </>
        )}
        {footer.newFromAgent ? ` · ${text("footer.newFromAgent")}` : null}
      </span>
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
