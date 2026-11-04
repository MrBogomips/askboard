// The view chrome's shared classes (DESIGN.md, Components and Base controls): the buttons, the
// chips, badges and pills, the focus ring and the section label, on the token utilities only.
// Class strings live here whole, so that Tailwind finds each utility in the shell's sources.

/** `{components.focus-ring}` on keyboard focus (L28). */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** `button-secondary`, with `button-disabled`. */
export const BUTTON_SECONDARY =
  `inline-flex h-control-height shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted px-md text-control text-foreground enabled:hover:bg-card ${FOCUS_RING} ` +
  "disabled:text-muted-foreground disabled:opacity-50";

/** `button-link`: link weight, no fill or border (F-77). */
export const BUTTON_LINK =
  `inline-flex shrink-0 items-center rounded-md text-control text-primary-text enabled:hover:underline ${FOCUS_RING} ` +
  "disabled:text-muted-foreground disabled:opacity-50";

/** `button-answer` on a board with Submit: an outline button, never a second filled primary. */
export const BUTTON_ANSWER =
  `inline-flex h-control-height items-center gap-1.5 rounded-md border border-primary bg-card px-md text-control text-primary-text enabled:hover:bg-primary-subtle ${FOCUS_RING} ` +
  "aria-pressed:bg-primary-subtle disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50";

/** `button-primary`: Submit, the bottom action bar's only primary, and a dialog's confirmation. */
export const BUTTON_PRIMARY =
  `inline-flex h-control-height shrink-0 items-center rounded-md bg-primary px-md text-control text-primary-foreground enabled:hover:bg-primary-hover ${FOCUS_RING} ` +
  "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50";

/** `button-answer` on a single-question board: the board's only primary (L168). */
export const BUTTON_ANSWER_PRIMARY =
  `inline-flex h-control-height items-center rounded-md bg-primary px-md text-control text-primary-foreground enabled:hover:bg-primary-hover ${FOCUS_RING} ` +
  "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50";

/** `header-chip`. */
export const CHIP =
  "self-start rounded-md border border-border bg-muted px-1.5 py-0.5 text-badge text-foreground-secondary";

/** `section-label`. */
export const SECTION_LABEL = "text-label text-muted-foreground uppercase";

/** `new-question-badge` and `unread-reply-marker`: info colours. */
export const INFO_BADGE =
  "shrink-0 rounded-md bg-info-subtle px-1.5 py-0.5 text-badge text-info-text";

/** A 1px separator in a toolbar row. */
export const SEPARATOR = "h-4 w-px shrink-0 bg-border";

/** A multi-line text field: the open prompt and the notes. */
export const TEXT_FIELD =
  `w-full rounded-md border border-input bg-card p-sm text-body text-foreground ${FOCUS_RING} ` +
  "read-only:border-border read-only:bg-muted";

/** One segment of a segmented control: the pressed one is underlined (Delivery, context placement). */
export const SEGMENT = `h-6 rounded-sm border-b-2 border-transparent px-2 text-control text-muted-foreground aria-pressed:border-primary aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground disabled:opacity-50 ${FOCUS_RING}`;

/** The frame of a segmented control. */
export const SEGMENTS = "flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5";
