// The Scale's classes (DESIGN.md: Scale, Toggle group, Input atoms, Focus ring), from the design
// tokens as the Tree's are. Every class is written out in full, so that Tailwind finds it in the
// chunk's own sources, and no element takes a `style` attribute (AD-8). The root font is 13px, so
// the measures DESIGN.md gives in pixels are written in pixels.

/** The Scale: the value label above, the control, the labels of its two ends below. */
export const SCALE = "flex flex-col gap-1";

/** The value, in `typography.code`; "Not set" takes `muted-foreground` where the value goes. */
export const VALUE = "font-mono text-code text-foreground";

export const VALUE_UNSET = "font-mono text-code text-muted-foreground";

/** The slider's box: Radix's root, and the wrapper that stands for it while nothing is set. */
export const ROOT =
  "relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-50";

/**
 * The unset slider, a focusable track with no thumb: keyboard focus rings the track (DESIGN.md,
 * Scale; provisional), and a disabled one takes the disabled look.
 */
export const UNSET =
  "relative flex h-5 w-full cursor-pointer touch-none select-none items-center rounded-md " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** The track on `muted`, the range and the thumb in `primary`. */
export const TRACK = "relative h-[4px] grow rounded-full bg-muted";

export const RANGE = "absolute h-full rounded-full bg-primary";

export const THUMB =
  "block size-4 rounded-full border border-primary bg-card focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The minimum and maximum labels at the ends, in `muted-foreground`. */
export const ENDS = "flex items-baseline justify-between gap-2 text-body text-muted-foreground";

/** The rating: the labels at the ends of a row of joined toggles, one per step. */
export const RATING = "flex items-center gap-2";

export const RATING_LABEL = "shrink-0 text-body text-muted-foreground";

export const TOGGLES = "inline-flex min-w-0 flex-wrap items-center";

/** A step: a toggle in the segmented control's look, joined to its neighbours; pressed it takes the pressed fill. */
export const TOGGLE =
  "-ml-px inline-flex h-[28px] min-w-[32px] items-center justify-center border border-border bg-muted " +
  "px-[8px] font-mono text-code text-foreground first:ml-0 first:rounded-l-md last:rounded-r-md " +
  "not-disabled:hover:bg-card focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 " +
  "data-[state=on]:z-10 data-[state=on]:border-primary data-[state=on]:bg-primary-subtle";
