// The chart's geometry (design decision 9; the UJ-2 mock): rows of 36px under an axis of 32px, so
// that each lines up with its grid row; a row with a field error under it, taller by one line;
// bars of 14px centred in their row's first 36px, spanning their calendar days; finish-to-start
// elbow arrows; and the axis's span, from the plan's start to two weeks past the last finish, room
// to drag a task later. Plain numbers, which the chart writes as SVG attributes.

import { dateOfDay, dayNumber, LAST_DAY } from "./date.ts";
import { PIXELS_PER_DAY, xOf, type Zoom } from "./scale.ts";

export const AXIS_HEIGHT = 32;
export const ROW_HEIGHT = 36;
/** The line a field error takes under its row. */
export const NOTE_HEIGHT = 20;
export const BAR_HEIGHT = 14;
/** Calendar days the axis runs past the last finish. */
export const AXIS_TAIL_DAYS = 14;

export type RowBox = {
  readonly top: number;
  readonly height: number;
  /** The middle of the row's first 36px, where its bar sits. */
  readonly middle: number;
};

export type RowBoxes = { readonly boxes: readonly RowBox[]; readonly height: number };

export type BarBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** Each row's box under the axis, by whether a note sits under it; and the chart's height. */
export const rowBoxes = (notes: readonly boolean[]): RowBoxes => {
  let top = AXIS_HEIGHT;
  const boxes = notes.map((note) => {
    const height = ROW_HEIGHT + (note ? NOTE_HEIGHT : 0);
    const box = Object.freeze({ top, height, middle: top + ROW_HEIGHT / 2 });
    top += height;
    return box;
  });
  return Object.freeze({ boxes: Object.freeze(boxes), height: top });
};

/** A task's bar, from its start to its finish, both included, in its row. */
export const barBox = (
  start: string,
  finish: string,
  origin: string,
  zoom: Zoom,
  row: RowBox,
): BarBox =>
  Object.freeze({
    x: xOf(start, origin, zoom),
    y: row.middle - BAR_HEIGHT / 2,
    width: (dayNumber(finish) - dayNumber(start) + 1) * PIXELS_PER_DAY[zoom],
    height: BAR_HEIGHT,
  });

// The mock's elbows: straight on to 16px before a successor that starts well after; else out 5px,
// to 12px from the predecessor's middle, back to 9px before the successor, then to it.
const RUN_IN = 16;
const STEP_OUT = 5;
const STEP_DOWN = 12;
const STEP_BACK = 9;

/** The path of the arrow from a predecessor's end to its successor's start. */
export const arrowPath = (from: BarBox, to: BarBox): string => {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  if (x2 - RUN_IN >= x1 + STEP_OUT) return `M${x1},${y1} H${x2 - RUN_IN} V${y2} H${x2}`;
  const turn = y1 + (y2 >= y1 ? STEP_DOWN : -STEP_DOWN);
  return `M${x1},${y1} h${STEP_OUT} V${turn} H${x2 - STEP_BACK} V${y2} H${x2}`;
};

export type ChartSpan = { readonly origin: string; readonly last: string };

/**
 * The axis's first and last days: from the plan's start, or an earlier start, to two weeks past
 * the last finish, within the days a Gantt may name.
 */
export const chartSpan = (
  start: string,
  finishes: readonly string[],
  starts: readonly string[] = [],
): ChartSpan => {
  // Sorted, full-dates of four-digit years come in the order of their days.
  const origin = [start, ...starts].sort()[0] as string;
  const end = [origin, ...finishes].sort().at(-1) as string;
  const last = dateOfDay(Math.min(LAST_DAY, dayNumber(end) + AXIS_TAIL_DAYS));
  return Object.freeze({ origin, last });
};
