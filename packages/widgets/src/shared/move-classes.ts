// The classes of the toolbar the Kanban and the Timeline share (DESIGN.md: Kanban, Timeline, Widget
// frame, Button, Change highlight, Focus ring), from the design tokens as the Ranking's are. Every
// class is written out in full, so that Tailwind finds it in the chunk's own sources, and no element
// takes a `style` attribute (AD-8). The root font is 13px, so the measures DESIGN.md gives in pixels
// are written in pixels.

/** The bordered frame around the toolbar row and the widget's body. */
export const FRAME = "flex min-w-0 flex-col rounded-md border border-border bg-card";

/** The toolbar row on `muted`, `spacing.toolbar-row` high, above the body. */
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

/** A menu on `popover` with `shadow-md` (DESIGN.md: the Kanban "Move to…" menu) and its items. */
export const MENU =
  "z-20 flex min-w-36 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-control text-foreground shadow-md";

export const MENU_ITEM =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 outline-none select-none " +
  "data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground data-[disabled]:opacity-50";
