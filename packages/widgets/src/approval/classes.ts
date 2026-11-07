// The Approval's classes (DESIGN.md: Approval, Approval summary, Button, Focus ring, Change
// highlight), from the design tokens as the Tree's are. Every class is written out in full, so
// that Tailwind finds it in the chunk's own sources, and no element takes a `style` attribute
// (AD-8). The root font is 13px, so the measures DESIGN.md gives in pixels are written in pixels.

/** The block at the end of its question, above a `border` rule: the decisions left, the summary right. */
export const BLOCK = "flex flex-wrap items-start gap-4 border-t border-border pt-3";

/** The decisions under their section label, on the block's left. */
export const DECISIONS = "flex shrink-0 flex-col gap-1";

/** A section label in `typography.label`, set in uppercase. */
export const SECTION_LABEL = "text-label uppercase text-muted-foreground";

/** The three decisions in a row. */
export const GROUP = "flex flex-wrap items-center gap-[4px]";

/**
 * A decision: `button-decision`, `button-secondary` with a selected state, `spacing.control-height`
 * high, with the focus ring; selected it takes the pressed fill, `primary-subtle` with a `primary`
 * border, and a disabled one `button-disabled`'s look.
 */
export const DECISION =
  "inline-flex h-[28px] shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-[12px] " +
  "text-control text-foreground not-disabled:hover:bg-card focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed " +
  "disabled:text-muted-foreground disabled:opacity-50 data-[state=on]:border-primary " +
  "data-[state=on]:bg-primary-subtle";

/** The selected decision's ✓. */
export const CHECK = "shrink-0";

/** The summary: a bordered block on `card`, on the block's right, which may shrink and wrap. */
export const SUMMARY =
  "flex min-w-[240px] flex-1 flex-col gap-1 rounded-md border border-border bg-card p-2";

/** The summary's title, in `typography.label`; "No changes" in the same place. */
export const SUMMARY_TITLE = "text-label uppercase text-foreground-secondary";

export const LINES = "flex flex-col gap-[2px]";

/** One line: the change dot, the name, then what changed. */
export const LINE = "flex min-w-0 flex-wrap items-baseline gap-x-[6px] text-body text-foreground";

/** The dot, `{colors.change}`, as the Tree's counter has it. */
export const DOT = "size-[8px] shrink-0 self-center rounded-full bg-change";

export const NAME = "min-w-0 break-words";

/** What kind of change an added, removed or moved element is, and the field a value is of. */
export const KIND = "text-muted-foreground";

export const FIELD = "font-mono text-code text-muted-foreground";

/** The previous value, struck through in `muted-foreground`, in the code face. */
export const PREVIOUS = "font-mono text-code text-muted-foreground line-through";

/** The new value, in `change-text` on `change-subtle`, in the code face. */
export const NEXT = "rounded-md bg-change-subtle px-[4px] font-mono text-code text-change-text";

/** The last line past the limit, in `muted-foreground`. */
export const MORE = "text-body text-muted-foreground";
