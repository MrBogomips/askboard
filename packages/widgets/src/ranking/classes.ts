// The Ranking's classes (DESIGN.md: Ranking, Widget frame, Button, Change highlight, Focus ring),
// from the design tokens as the Tree's are. Every class is written out in full, so that Tailwind
// finds it in the chunk's own sources, and no element takes a `style` attribute (AD-8). The root
// font is 13px, so the measures DESIGN.md gives in pixels are written in pixels.

/** The bordered frame around the toolbar row and the list. */
export const FRAME = "flex flex-col rounded-md border border-border bg-card";

/** The toolbar row on `muted`, `spacing.toolbar-row` high, above the list. */
export const TOOLBAR =
  "flex h-[32px] items-center gap-2 rounded-t-md border-b border-border bg-muted px-2";

export const TOOLS = "flex shrink-0 items-center gap-[4px]";

/** A tool: `button-secondary`, with the focus ring; a disabled tool takes `button-disabled`'s look. */
export const TOOL =
  "h-[28px] shrink-0 rounded-md border border-border bg-muted px-[12px] text-control " +
  "text-foreground not-aria-disabled:hover:bg-card focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring aria-disabled:text-muted-foreground " +
  "aria-disabled:opacity-50";

/** The counter, at the toolbar row's right: the change dot, then its text, cut before it overprints a tool. */
export const COUNTER =
  "ml-auto flex min-w-0 items-center gap-[6px] text-control text-foreground-secondary";

export const COUNTER_TEXT = "min-w-0 truncate";

/** The change dot, `{colors.change}`. */
export const CHANGE_DOT = "size-[8px] shrink-0 rounded-full bg-change";

/** The list of rows. */
export const LIST = "flex flex-col";

/**
 * A row: the handle, the position, the label and its description, on a rule; the current row takes
 * the `primary-subtle` fill with a 2px `primary` bar on its left edge, and the focus ring when it
 * has the keyboard.
 */
export const ROW =
  "group/row flex items-start gap-2 border-t border-border px-2 py-[6px] text-body text-foreground " +
  "first:border-t-0 aria-selected:bg-accent aria-[current=true]:bg-primary-subtle " +
  "aria-[current=true]:shadow-[inset_2px_0_0_0_var(--primary)] focus-visible:outline-2 " +
  "focus-visible:-outline-offset-2 focus-visible:outline-ring";

/** The drop indicator (DESIGN.md, Ranking): the Tree's line above or below the row, in `primary`. */
export const DROP_BEFORE = "shadow-[inset_0_2px_0_0_var(--primary)]";

export const DROP_AFTER = "shadow-[inset_0_-2px_0_0_var(--primary)]";

/** The row being dragged, dimmed. */
export const DRAGGED_ROW = "opacity-50";

/** The grip, in `muted-foreground`, with no text selection. */
export const HANDLE =
  "mt-[2px] inline-flex size-[14px] shrink-0 select-none items-center justify-center text-muted-foreground";

/** The position number, in `typography.code`; a moved row's takes the change highlight. */
export const POSITION =
  "mt-[1px] min-w-[24px] shrink-0 rounded-md border border-transparent px-[4px] text-center font-mono text-code text-muted-foreground";

export const POSITION_MOVED =
  "mt-[1px] min-w-[24px] shrink-0 rounded-md border border-change bg-change-subtle px-[4px] text-center font-mono text-code text-change-text";

export const TEXT = "flex min-w-0 flex-col";

export const LABEL = "min-w-0 break-words";

/** The description, in `muted-foreground`. */
export const DESCRIPTION = "min-w-0 break-words text-muted-foreground";
