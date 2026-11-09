// The Kanban's classes (DESIGN.md: Kanban, Widget frame, Change highlight, Focus ring), from the
// design tokens as the Ranking's are. Every class is written out in full, so that Tailwind finds it
// in the chunk's own sources, and no element takes a `style` attribute (AD-8). The root font is
// 13px, so the measures DESIGN.md gives in pixels are written in pixels. The frame and the toolbar
// are the shared ones (`shared/move-classes.ts`).

/** The columns side by side, a board wider than the frame scrolling sideways. */
export const COLUMNS = "flex items-start gap-2 overflow-x-auto p-2";

/** A column on `muted`, wide enough for a card's text, tall enough to take a drop while empty. */
export const COLUMN =
  "m-0 flex min-h-[72px] w-[220px] min-w-0 shrink-0 flex-col gap-2 rounded-md border-0 bg-muted p-2";

/** The drop indicator (DESIGN.md, Kanban): the Tree's "into" outline, in `primary`, on the column. */
export const COLUMN_INTO = "outline-2 -outline-offset-2 outline-primary";

/** A column's head: its name in `typography.label` and its count of cards. */
export const COLUMN_HEAD = "flex items-center justify-between gap-2 text-label text-foreground";

export const COLUMN_NAME = "min-w-0 break-words";

export const COLUMN_COUNT =
  "shrink-0 rounded-md border border-transparent px-[4px] text-center font-mono text-code text-muted-foreground";

/**
 * A card on `card` with a `border` border and `rounded-md`, titled in `typography.body`; the
 * current card takes the `primary-subtle` fill with a 2px `primary` bar on its left edge, and the
 * focus ring when it has the keyboard.
 */
export const CARD =
  "flex flex-col gap-[2px] rounded-md border border-border bg-card px-2 py-[6px] text-body " +
  "text-foreground aria-[current=true]:bg-primary-subtle " +
  "aria-[current=true]:shadow-[inset_2px_0_0_0_var(--primary)] focus-visible:outline-2 " +
  "focus-visible:-outline-offset-2 focus-visible:outline-ring";

/** A card dragged by the pointer: the grab cursor while the Kanban can change. */
export const CARD_GRAB = "cursor-grab";

/** A moved card: the change highlight, `change-subtle` with a `change` border. */
export const CARD_MOVED = "border-change bg-change-subtle";

/**
 * The drop line (DESIGN.md, Kanban): the Ranking's line in `primary`, inside the card's top or
 * bottom edge, where the dragged card would land.
 */
export const CARD_LINE_BEFORE = "shadow-[inset_0_2px_0_0_var(--primary)]";

export const CARD_LINE_AFTER = "shadow-[inset_0_-2px_0_0_var(--primary)]";

/** The card being dragged, dimmed. */
export const CARD_DRAGGED = "opacity-50";

export const CARD_LABEL = "min-w-0 break-words";

/** The description, in `muted-foreground`, under the title. */
export const CARD_DESCRIPTION = "min-w-0 break-words text-muted-foreground";
