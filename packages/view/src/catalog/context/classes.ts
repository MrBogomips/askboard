// The context components' classes (DESIGN.md: Excerpt, Reference, Agent-written labels, Focus
// ring), on the token utilities only, each written out in full so that Tailwind finds it in the
// chunk's own sources; no element takes a `style` attribute (AD-8). The view's root font is 13px,
// so the measures DESIGN.md gives in pixels are written in pixels.

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** A marked control's escape (`marks.ts`): code type in `{colors.muted-foreground}`. */
export const MARK = "text-muted-foreground";

/** The excerpt: a bordered card on `{colors.card}`, `{rounded.md}`. */
export const EXCERPT = "min-w-0 overflow-hidden rounded-md border border-border bg-card";

/** The caption on the sunken fill, with a bottom border. */
export const CAPTION =
  "flex min-w-0 flex-col gap-[2px] border-b border-border bg-muted px-[8px] py-[6px]";

/** The caption's title, semibold. */
export const TITLE = "block min-w-0 truncate text-body font-semibold text-foreground";

/** The source line: path, anchor and line range in `{typography.code}`, muted. */
export const SOURCE = "block min-w-0 truncate font-mono text-code text-muted-foreground";

/**
 * The body: capped at `{spacing.excerpt-max-height}` and scrolling inside, focusable so that a
 * keyboard can scroll it.
 */
export const BODY = `max-h-[320px] overflow-auto py-[4px] ${FOCUS_RING}`;

/**
 * The lines as a grid of two columns, the numbers' as wide as the widest number. Markdown fits the
 * card and wraps; code takes its longest line's width and scrolls sideways.
 */
export const LINES_WRAP =
  "m-0 grid list-none grid-cols-[max-content_minmax(0,1fr)] p-0 font-mono text-code text-foreground";
export const LINES_CODE =
  "m-0 grid w-max min-w-full list-none grid-cols-[max-content_1fr] p-0 font-mono text-code text-foreground";

/** A line spans both columns and shares them, so its number stays on its own source line. */
export const LINE = "col-span-2 grid grid-cols-subgrid";

/** A line number: right-aligned in `{colors.muted-foreground}`, left out of a selection. */
export const NUMBER = "select-none pr-[12px] pl-[8px] text-right text-muted-foreground";

/** Markdown's text: wraps, its continuation lines under the text, a hanging indent. */
export const TEXT_WRAP = "min-w-0 pr-[8px] whitespace-pre-wrap wrap-break-word";

/** Code's text: never wraps. */
export const TEXT_CODE = "pr-[8px] whitespace-pre";

/** "Unresolved" and the pointer, in place of an excerpt's body or an image. */
export const UNRESOLVED_ROW = "flex min-w-0 items-baseline gap-[8px] px-[8px] py-[6px]";

/** The "Unresolved" chip. */
export const UNRESOLVED =
  "shrink-0 rounded-md border border-border bg-muted px-[6px] py-[1px] text-badge text-foreground-secondary";

/** An unresolved item's pointer, in `{typography.code}`. */
export const POINTER = "block min-w-0 truncate font-mono text-code text-muted-foreground";

/** An unresolved image: a bordered card, its pointer then its alt text. */
export const IMAGE_UNRESOLVED = "min-w-0 rounded-md border border-border bg-card";

/** An unresolved image's alt text. */
export const ALT = "px-[8px] pb-[6px] text-body text-foreground-secondary";

/** A shown image: the column's width at most, its own height. */
export const IMAGE = "block h-auto max-w-full rounded-md border border-border";

/** The reference: a bordered chip on two lines. */
export const REFERENCE = `flex w-full min-w-0 flex-col gap-[2px] rounded-md border border-border bg-card px-[8px] py-[6px] text-left hover:bg-muted ${FOCUS_RING}`;

/** A FILE reference in a Snapshot: the chip's look, no hover or focus, since it does nothing. */
export const REFERENCE_STATIC =
  "flex w-full min-w-0 flex-col gap-[2px] rounded-md border border-border bg-card px-[8px] py-[6px] text-left";

/** The reference's first line: its kind label, then its path or title. */
export const REFERENCE_ROW = "flex min-w-0 items-baseline gap-[8px]";

/** The kind label (FILE, GITHUB, WEB) in `{typography.label}`. */
export const LABEL = "shrink-0 text-label text-muted-foreground uppercase";

/** The path or title in `{typography.code}` and `{colors.primary-text}`, cut with an ellipsis. */
export const PATH = "block min-w-0 truncate font-mono text-code text-primary-text";

/** The hint, right-aligned under them. */
export const HINT = "self-end text-badge text-muted-foreground";
