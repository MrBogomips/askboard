// The shared annotation pieces' classes (DESIGN.md: Annotation pin, Comment card), on the token
// utilities only, each written out in full so that Tailwind finds it in the chunk that imports the
// piece; no element takes a `style` attribute (AD-8). Every element that shows agent or user text
// wraps a word longer than its line.

/** The pin: a numbered `rounded-full` pin in `change`, with a hit region wider than it shows. */
export const PIN =
  "relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-change " +
  "text-badge font-semibold text-change-foreground before:absolute before:-inset-1 before:content-[''] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The card the pin opens: `change-subtle` with a `change` border, `rounded-md` and `shadow-md`. */
export const CARD =
  "z-50 flex w-[320px] max-w-[calc(100vw-32px)] flex-col gap-sm rounded-md border border-change " +
  "bg-change-subtle p-sm text-body text-foreground shadow-md focus-visible:outline-none";

/** The header: the label at the left, the actions at the right. */
export const HEADER = "flex items-start justify-between gap-sm";

/** The header's label, in `change-text`, semibold. */
export const HEADER_LABEL = "min-w-0 break-words text-label font-semibold text-change-text";

/** The header's actions. */
export const ACTIONS = "flex shrink-0 items-center gap-sm";

/** `button-link`: "Edit" and "Delete". */
export const BUTTON_LINK =
  "rounded-md text-control text-primary-text hover:underline focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The close control: a bare mark that shows the focus ring. */
export const CLOSE =
  "inline-flex size-[18px] items-center justify-center rounded-md text-foreground-secondary " +
  "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** A field: its label above its textarea. */
export const FIELD = "flex min-w-0 flex-col gap-xs";

/** A field's label. */
export const FIELD_LABEL = "min-w-0 break-words text-label text-foreground";

/** A textarea, as the input atoms' are: `input` border on `card`. */
export const TEXTAREA =
  "min-h-[64px] w-full min-w-0 resize-y break-words rounded-md border border-input bg-card p-sm " +
  "text-body text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring";

/** What the user wrote, read in the card: its words wrap and its line feeds stay. */
export const TEXT = "min-w-0 whitespace-pre-wrap break-words text-body text-foreground";

/** The "Done" button: `button-secondary`. */
export const DONE =
  "self-start rounded-md border border-border bg-muted px-sm py-xs text-control text-foreground " +
  "hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The list: a block on `muted`, its entries one under the other. */
export const LIST = "flex min-w-0 flex-col gap-sm rounded-md bg-muted p-sm";

/** The list's heading. */
export const LIST_HEADING = "min-w-0 break-words text-label font-semibold text-foreground";

/** The list's note under the heading. */
export const LIST_NOTE = "min-w-0 break-words text-body text-muted-foreground";

/** The entries. */
export const ENTRIES = "m-0 flex list-none flex-col gap-sm p-0";

/** One entry. */
export const ENTRY = "flex min-w-0 flex-col gap-xs";

/** An entry's label and its delete beside it. */
export const ENTRY_HEAD = "flex items-start justify-between gap-sm";

/** An entry's label, in `change-text`. */
export const ENTRY_LABEL = "min-w-0 break-words text-label font-semibold text-change-text";

/** An entry's excerpt, the passage it was made on, in `muted-foreground`. */
export const EXCERPT =
  "m-0 min-w-0 whitespace-pre-wrap break-words text-body text-muted-foreground";
