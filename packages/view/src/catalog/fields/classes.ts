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

/** The input and its unit or currency affix as one group. */
export const GROUP = "flex min-w-0 items-stretch";

/** An input inside a group: it takes the width the affix leaves and squares its trailing corners. */
export const GROUP_INPUT = `${INPUT} min-w-0 flex-1 aria-invalid:border-destructive has-[~span]:rounded-r-none`;

/** The affix after the input: the unit or the currency code, in the code type on `muted`. */
export const AFFIX =
  "flex shrink-0 items-center rounded-r-md border border-l-0 border-input bg-muted px-sm font-mono text-code text-muted-foreground";

/** The line under the control holding the echo and the field error. */
export const NOTES = "flex min-w-0 flex-wrap items-baseline gap-x-sm gap-y-xs";

/** The echo of the value the text reads as, in the code type and `muted-foreground`. */
export const ECHO = "break-all font-mono text-code text-muted-foreground";

/** The one-line message under a refused field (DESIGN.md, Field error). */
export const FIELD_ERROR = "m-0 text-body text-destructive-text";

/** A segmented control of choices after a field: joined toggles, the pressed one on the pressed fill. */
export const SEGMENTS = "inline-flex min-w-0 flex-wrap items-center";

export const SEGMENT =
  "-ml-px inline-flex h-[28px] min-w-[40px] items-center justify-center border border-border bg-muted " +
  "px-[8px] font-mono text-code text-foreground first:ml-0 first:rounded-l-md last:rounded-r-md " +
  "not-disabled:hover:bg-card focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring data-[state=on]:border-primary data-[state=on]:bg-primary-subtle";
