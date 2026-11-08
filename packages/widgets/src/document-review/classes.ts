// The Document review's classes (DESIGN.md: Document review, Annotation pin), from the design
// tokens. Every class is written out in full, so that Tailwind finds it in the chunk's own
// sources, and no element takes a `style` attribute (AD-8): marks are set through classes (F-36).
// Every element holding agent or user text wraps a long word.

const MARK_LINE = "bg-change-subtle decoration-change decoration-2 underline-offset-2";

/** A commented passage: `change-subtle` with a `change` underline. */
export const MARK = `${MARK_LINE} underline`;

/**
 * The passage of a suggested edit: struck through, in the same colours. Both are
 * `text-decoration-line` utilities, so only one can stand on an element.
 */
export const MARK_SUGGESTED = `${MARK_LINE} line-through`;

/** What follows a passage: the replacement text and the pin's slot, inline. */
export const AFTER = "inline text-change-text break-words [overflow-wrap:anywhere]";

/** The replacement of a suggested edit, in `change-text` on `change-subtle`. */
export const REPLACEMENT = "rounded-sm bg-change-subtle text-change-text no-underline";

/** The element a pin is drawn into: inline, after the passage. */
export const PIN_SLOT = "ml-0.5 inline-block align-baseline";

// The frame, from the Ranking's (DESIGN.md: Document review, Widget frame). The title, the toolbar
// row, the document and the detached list are ordered by `order-*` classes, since the document comes
// first in the document order: the document is one Tab stop and the toolbar the next (EXPERIENCE,
// Accessibility Floor).

/** The bordered frame around the title, the toolbar row, the document and the detached list. */
export const FRAME = "flex min-w-0 flex-col rounded-md border border-border bg-card";

/** The title, heading the frame in `typography.label`; it wraps a long word. */
export const TITLE =
  "order-1 m-0 min-w-0 break-words px-sm pt-sm text-label font-semibold text-foreground";

/** The toolbar row on `muted`: the tools, the counter and, beside them, the refusal's message. */
export const TOOLBAR_ROW =
  "order-2 flex min-h-[32px] min-w-0 flex-wrap items-center gap-2 border-b border-border bg-muted px-2 py-1";

/** The tools, one Tab stop. */
export const TOOLS = "flex shrink-0 items-center gap-[4px]";

/** A tool: `button-secondary`, with the focus ring. */
export const TOOL =
  "h-[28px] shrink-0 rounded-md border border-border bg-muted px-[12px] text-control " +
  "text-foreground hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring";

/** The counter, at the row's right. */
export const COUNTER = "ml-auto min-w-0 break-words text-control text-foreground-secondary";

/** The message about a refused passage, beside the tools, in `muted-foreground`. */
export const MESSAGE = "m-0 min-w-0 break-words text-control text-muted-foreground";

/** The document: in the `body-lg` type, wrapping long words. */
export const DOCUMENT = "order-3 min-w-0 break-words p-sm text-body-lg! focus-visible:outline-none";

/** The detached annotations under the document. */
export const DETACHED = "order-4 min-w-0 p-sm";

/** A block of the document the keyboard can stand on: it takes the focus ring when it has it. */
export const BLOCK =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
