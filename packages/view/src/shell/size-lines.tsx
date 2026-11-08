// The lines under a question's actions for a message too large (oversized-acts, design decisions 2
// to 4; EXPERIENCE.md, State Patterns, Question; DESIGN.md, Field error; NFR-12): each a polite
// status in the Field error style, in the ask's language, its sizes in the ask's locale. They say
// what did not go; the question's work is never touched by them.

import { useLanguage, useLocale, useStrings } from "../catalog/port.ts";
import { noticeText, type SizeNotice } from "./size-notices.ts";
import { FIELD_ERROR } from "./styles.ts";

export type SizeLinesProps = {
  /** What did not go because it was too large: an answer, a Submit or a refused command. */
  readonly notice?: SizeNotice | undefined;
  /** The board page left this question's work out of the draft it mirrors. */
  readonly draftLeftOut?: boolean;
};

export const SizeLines = ({ notice, draftLeftOut = false }: SizeLinesProps) => {
  const language = useLanguage();
  const locale = useLocale();
  const text = useStrings();
  return (
    <>
      {notice === undefined ? null : (
        <p role="status" className={FIELD_ERROR}>
          {noticeText(notice, language, locale)}
        </p>
      )}
      {draftLeftOut ? (
        <p role="status" className={FIELD_ERROR}>
          {text("draft.tooLarge")}
        </p>
      ) : null}
    </>
  );
};
