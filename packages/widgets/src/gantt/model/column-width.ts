// The width of the Gantt grid's TASK column (design decision 7; view spec, "Gantt task column
// resize"): view state, never part of a draft, an answer or a change. The width stays between
// 120 px and 60% of the widget's width; the edge's keys step it by 16 px, or 64 with Shift, Home
// and End take the limits, and a fit takes the longest visible name. Plain ECMAScript.

/** The narrowest the column goes, in px. */
export const COLUMN_MIN = 120;

/** The width the column opens at, in px. */
export const COLUMN_DEFAULT = 160;

/** The share of the widget the column may take at most. */
const MAX_SHARE = 0.6;

/** An arrow key's step, and Shift's, in px. */
export const STEP = 16;
export const BIG_STEP = 64;

/** A cell's horizontal padding on both sides, which a fitted name needs besides its text. */
const CELL_PADDING = 16;

/** The widest the column goes in a widget `widget` px wide: never under the narrowest. */
export const maxWidth = (widget: number): number =>
  Math.max(COLUMN_MIN, Math.floor(widget * MAX_SHARE));

/** A width held to the limits; a value that is no number takes the default. */
export const clampWidth = (width: number, widget: number): number =>
  Math.min(maxWidth(widget), Math.max(COLUMN_MIN, Number.isFinite(width) ? width : COLUMN_DEFAULT));

/** The width a key on the focused edge asks for, or undefined when the key is not the edge's. */
export const keyWidth = (
  width: number,
  key: string,
  shift: boolean,
  widget: number,
): number | undefined => {
  const step = shift ? BIG_STEP : STEP;
  if (key === "ArrowRight") return clampWidth(width + step, widget);
  if (key === "ArrowLeft") return clampWidth(width - step, widget);
  if (key === "Home") return COLUMN_MIN;
  if (key === "End") return maxWidth(widget);
  return undefined;
};

/** The width that shows the longest of the visible names whole, within the limits. */
export const fitWidth = (nameWidths: readonly number[], widget: number): number =>
  nameWidths.length === 0
    ? clampWidth(COLUMN_DEFAULT, widget)
    : clampWidth(Math.max(...nameWidths) + CELL_PADDING, widget);
