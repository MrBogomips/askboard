// The Value's classes (DESIGN.md: Primitives, Display atoms), on the token utilities only, each
// written out in full so that Tailwind finds it in the chunk's own sources.

/** The label and the figure side by side: the figure takes what the label leaves and wraps. */
export const VALUE = "m-0 flex min-w-0 items-baseline justify-between gap-md";

/** The label type in the muted colour, as the section labels are. */
export const LABEL = "m-0 shrink-0 text-label text-muted-foreground uppercase";

/**
 * The figure in the code type, right-aligned. `break-all` lets a number the contract bounds but a
 * line cannot hold, such as 5e-324 written out in 326 digits, wrap inside the card (review 1.8, U-3).
 */
export const FIGURE = "m-0 min-w-0 break-all text-right font-mono text-code text-foreground";
