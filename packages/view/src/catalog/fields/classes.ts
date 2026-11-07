// The input atoms' shared classes (DESIGN.md: Input atoms, Focus ring, Field error), on the token
// utilities only, each written out in full so that Tailwind finds it in each field chunk's own
// sources; no element takes a `style` attribute (AD-8). The root font is 13px, so the measures
// DESIGN.md gives in pixels are written in pixels.

/** A field: its label, description and control stacked, taking the width the card gives. */
export const FIELD = "flex min-w-0 flex-col gap-xs";

/** The label, always visible, above the control. */
export const LABEL = "text-body font-semibold text-foreground";

/** The description under the label, in `muted-foreground`. */
export const DESCRIPTION = "m-0 text-body text-muted-foreground";

/**
 * A text input or textarea: `{colors.input}` border on `card`; answered or locked it takes the
 * read-only look of a reopened answer, `muted` with no border (DESIGN.md, Snapshot view).
 */
export const INPUT =
  "w-full min-w-0 rounded-md border border-input bg-card p-sm text-body text-foreground " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "read-only:border-transparent read-only:bg-muted";

/** The textarea adds a minimum height and keeps its width. */
export const TEXTAREA = `${INPUT} min-h-[64px] resize-y`;

/** `button-link`: the "Clear" beside a set Toggle. */
export const BUTTON_LINK =
  "rounded-md text-control text-primary-text hover:underline focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring";
