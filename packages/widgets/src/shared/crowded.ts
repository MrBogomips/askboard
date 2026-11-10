// A toolbar's overflow (the Tree's, review F-16, spec "Tree toolbar overflow"; the Ranking's, spec
// "Ranking at the keyboard"): the counter gives way first, by truncating, down to a minimum; when
// the tools alone no longer leave it that, a widget's tools go into a "More" menu. Pure: the toolbar
// measures (`use-crowded.ts`), this decides.

/** The width, in px, the counter keeps before the tools are given up for "More". */
export const COUNTER_MIN = 96;

/** The toolbar row's horizontal padding and the gap between the tools and the counter, in px. */
export const ROW_PADDING = 24;

/**
 * Whether the row is too narrow for all the tools and the counter's minimum, from the row's width
 * and the tools' width with all of them shown; tools not measured yet (0) are never crowded.
 */
export const isCrowded = (rowWidth: number, toolsWidth: number): boolean =>
  toolsWidth > 0 && toolsWidth + COUNTER_MIN + ROW_PADDING > rowWidth;
