// The context column (DESIGN.md, Context column; EXPERIENCE.md, Board anatomy): the question's
// excerpts then references under the title "Excerpt and references", with the "Beside | Inline"
// control in the title row while the card could split. Beside, the column is `{spacing.context-column}`
// wide beside the question, set off by a `{colors.border}` rule; inline, the same content sits under
// the question text. The items are the card's children: they render through the shell like any
// item (AD-9).

import type { ReactNode } from "react";
import type { ContextPlacement } from "./board-draft.ts";
import { SECTION_LABEL, SEGMENT, SEGMENTS } from "./styles.ts";

const TITLE = "Excerpt and references";

export const contextTitleId = (questionId: string): string => `${questionId}:context`;

type ColumnProps = {
  readonly questionId: string;
  /** Where the context sits now. */
  readonly placement: ContextPlacement;
  /** Whether the control shows: at least one excerpt is resolved or written. */
  readonly placeable: boolean;
  readonly onPlace: (placement: ContextPlacement) => void;
  readonly children: ReactNode;
};

const PLACEMENTS: readonly { readonly placement: ContextPlacement; readonly label: string }[] = [
  { placement: "beside", label: "Beside" },
  { placement: "inline", label: "Inline" },
];

export const ContextColumn = ({
  questionId,
  placement,
  placeable,
  onPlace,
  children,
}: ColumnProps) => (
  <fieldset
    aria-labelledby={contextTitleId(questionId)}
    data-askboard-context={placement}
    className={
      placement === "beside"
        ? "flex w-[360px] min-w-0 flex-col gap-3 border-l border-border pl-4"
        : "flex min-w-0 flex-col gap-2"
    }
  >
    <div className="flex items-center justify-between gap-2">
      <p id={contextTitleId(questionId)} className={SECTION_LABEL}>
        {TITLE}
      </p>
      {placeable ? (
        <fieldset aria-label="Context placement" className={SEGMENTS}>
          {PLACEMENTS.map((each) => (
            <button
              key={each.placement}
              type="button"
              className={SEGMENT}
              aria-pressed={placement === each.placement}
              onClick={() => onPlace(each.placement)}
            >
              {each.label}
            </button>
          ))}
        </fieldset>
      ) : null}
    </div>
    {children}
  </fieldset>
);
