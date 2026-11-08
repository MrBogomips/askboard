// The Document review's classes (DESIGN.md: Document review, Annotation pin), from the design
// tokens. Every class is written out in full, so that Tailwind finds it in the chunk's own
// sources, and no element takes a `style` attribute (AD-8): marks are set through classes (F-36).
// Every element holding agent or user text wraps a long word.

/** A commented passage: `change-subtle` with a `change` underline (a suggestion adds its strike). */
export const MARK = "bg-change-subtle underline decoration-change decoration-2 underline-offset-2";

/** The passage of a suggested edit: struck through under the same mark. */
export const MARK_SUGGESTED = `${MARK} line-through`;

/** What follows a passage: the replacement text and the pin's slot, inline. */
export const AFTER = "inline text-change-text break-words [overflow-wrap:anywhere]";

/** The replacement of a suggested edit, in `change-text` on `change-subtle`. */
export const REPLACEMENT = "rounded-sm bg-change-subtle text-change-text no-underline";

/** The element a pin is drawn into: inline, after the passage. */
export const PIN_SLOT = "ml-0.5 inline-block align-baseline";

/** The current block, from the keyboard: the focus ring. */
export const BLOCK_CURRENT =
  "outline-2 outline-offset-2 outline-ring rounded-sm focus-visible:outline-2";
