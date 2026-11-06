// What every option row of the Choice atom holds (DESIGN.md, Option): the mark, then the label in
// the body-lg type with the "Recommended" badge beside it, and its description under it. Labels,
// descriptions, previews and annotations are agent text, rendered as text only (AD-8). The row is
// the radio or checkbox itself, so the focus ring sits on the row and a click anywhere on it
// selects; what belongs to the option beside the row (the agent's annotation, "Show preview", the
// user's note) sits under it, in `OptionDetails`.

import type { ChoiceOption } from "@askboard/contract";
import { useStrings } from "../port.ts";
import { optionDescriptionId, optionLabelId } from "./selection.ts";

/** A bordered row on the card colour; its border turns primary once it is checked. */
export const ROW =
  "group flex w-full items-start gap-sm rounded-md border border-border bg-card p-sm text-left " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "enabled:hover:bg-accent data-[state=checked]:border-primary " +
  // On a closed or discarded ask, which the board marks, a row looks disabled (review F-18).
  "group-data-[askboard-ended]/board:data-[disabled]:bg-muted " +
  "group-data-[askboard-ended]/board:data-[disabled]:opacity-50";

/** The empty mark, ringed in the input colour and in primary once checked. */
export const MARK =
  "mt-0.5 flex size-4 shrink-0 items-center justify-center border border-input bg-card " +
  "group-data-[state=checked]:border-primary";

/** `recommended-badge`: the agent's alias colours (L61). */
const RECOMMENDED =
  "shrink-0 rounded-md border border-recommended bg-recommended-subtle px-1.5 py-0.5 text-badge text-recommended";

/** The ARIA attributes that name a row by its label and describe it by its description. */
export const optionAria = (itemId: string, index: number, option: ChoiceOption) => ({
  "aria-labelledby": optionLabelId(itemId, index),
  "aria-describedby":
    option.description === undefined ? undefined : optionDescriptionId(itemId, index),
});

export const OptionText = ({
  itemId,
  index,
  option,
}: {
  readonly itemId: string;
  readonly index: number;
  readonly option: ChoiceOption;
}) => {
  const text = useStrings();
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-sm">
        <span id={optionLabelId(itemId, index)} className="text-body-lg text-foreground">
          {option.label}
        </span>
        {option.recommended === true ? (
          <span className={RECOMMENDED}>{text("question.recommended")}</span>
        ) : null}
      </span>
      {option.description === undefined ? null : (
        <span
          id={optionDescriptionId(itemId, index)}
          className="text-body text-foreground-secondary"
        >
          {option.description}
        </span>
      )}
    </span>
  );
};
