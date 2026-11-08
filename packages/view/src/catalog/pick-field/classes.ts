// The PickField's classes (DESIGN.md, Option and Input atoms), on the token utilities only, each
// written out in full so that Tailwind finds it in this chunk's own sources; no element takes a
// `style` attribute (AD-8). The rows are the Choice atom's, with the wrapping an agent's long label
// or description needs: a run with no spaces breaks inside the card.

/** The options, one under another. */
export const OPTIONS = "flex min-w-0 flex-col gap-sm";

/** A bordered row on the card colour; its border turns primary once it is checked. */
export const ROW =
  "group flex w-full min-w-0 items-start gap-sm rounded-md border border-border bg-card p-sm text-left " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "enabled:hover:bg-accent data-[state=checked]:border-primary " +
  "group-data-[askboard-ended]/board:data-[disabled]:bg-muted " +
  "group-data-[askboard-ended]/board:data-[disabled]:opacity-50";

/** The empty mark, ringed in the input colour and in primary once checked. */
export const MARK =
  "mt-0.5 flex size-4 shrink-0 items-center justify-center border border-input bg-card " +
  "group-data-[state=checked]:border-primary";

/** The option's label and description, beside its mark. */
export const OPTION_TEXT = "flex min-w-0 flex-col gap-0.5";
export const OPTION_LABEL = "min-w-0 break-words text-body-lg text-foreground";
export const OPTION_DESCRIPTION = "min-w-0 break-words text-body text-foreground-secondary";

/** What shows when the filter matches no option. */
export const NO_MATCH = "m-0 text-body text-muted-foreground";

/** The "Clear" `button-link` under a single pick, on its own line. */
export const CLEAR = "self-start";
