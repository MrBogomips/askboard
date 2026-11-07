// The Chart's classes (DESIGN.md: Chart, Focus ring), from the design tokens as the Scale's are.
// Every class is written out in full, so that Tailwind finds it in the chunk's own sources, and no
// element takes a `style` attribute (AD-8): the canvas and its sizes are the chart library's, set
// through the CSSOM. The ring a highlighted point wears is drawn on the canvas, not here.

/** The title, the plot and the counter, one under the other. */
export const CHART = "flex min-w-0 flex-col gap-2";

/** The title above the chart, in `typography.label`. */
export const TITLE = "text-label text-foreground";

/** The plot: 320px high and as wide as the widget frame, the one Tab stop, with the focus ring. */
export const PLOT =
  "relative h-[320px] w-full min-w-0 overflow-hidden rounded-md " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The counter under the plot, in `typography.body` and `muted-foreground`. */
export const COUNTER = "text-body text-muted-foreground";

/** The keyboard hint and the live region: read aloud, never shown. */
export const HIDDEN = "sr-only";
