// The LaTeX's classes (DESIGN.md: LaTeX, Input atoms, Field error, Change highlight, Focus ring),
// from the design tokens as the Tree's are. Every class is written out in full, so that Tailwind
// finds it in the chunk's own sources, and no element takes a `style` attribute (AD-8). The root
// font is 13px, so the measures DESIGN.md gives in pixels are written in pixels.

/** The block: the source field, its error, the preview and the counter, one under the other. */
export const BLOCK = "flex min-w-0 flex-col gap-1";

/**
 * The source field, `{typography.code}` with the input atoms' look and the focus ring; its border
 * is `field-error`'s while the expression does not render and `{colors.change}` while it differs from
 * the agent's; read-only it takes the read-only look, `muted` with no input border.
 */
export const SOURCE =
  "min-h-[64px] w-full min-w-0 resize-y rounded-md border border-input bg-card px-1.5 py-1 " +
  "font-mono text-code text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring aria-invalid:border-destructive read-only:border-transparent " +
  "read-only:bg-muted";

/** The source field's border while it differs from the agent's expression. */
export const SOURCE_EDITED = "border-change";

/** The `field-error` line under the field (DESIGN.md, Field error): the message as text, wrapping. */
export const FIELD_ERROR = "break-words text-body text-destructive-text";

/**
 * The preview, under the field on `{colors.card}`: a preview wider than the frame scrolls sideways,
 * and one taller than 400px scrolls inside its box. KaTeX's `maxSize` caps a size upward (about
 * 358px) and no negative one, so a raise downward would else make the box millions of pixels tall
 * and push "Answer" out of reach (latex-kanban-timeline, security review X-1).
 */
export const PREVIEW =
  "max-h-[400px] min-h-[32px] overflow-x-auto overflow-y-auto rounded-md border border-border bg-card px-2 " +
  "text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The counter under the preview: the change dot, then its text, in `muted-foreground`. */
export const COUNTER = "flex min-w-0 items-center gap-[6px] text-control text-muted-foreground";

/** The change dot, `{colors.change}`. */
export const CHANGE_DOT = "size-[8px] shrink-0 rounded-full bg-change";
