// The chart's geometry (design decision 9): rows and axis of the density's height, 32px compact and
// 40px comfortable (review F-23), so that each lines up with its grid row; a row with a field
// error under it, taller by one line; bars of 14px centred in their row's first line, spanning their calendar days; in a plan, the
// baseline, a 4px bar under its task's bar; finish-to-start elbow arrows and their arrowheads'
// IDs; and the axis's span, from the plan's start to two weeks past the last finish, room to drag
// a task later. Plain numbers, which the chart writes as SVG attributes.

import { dateOfDay, dayNumber, LAST_DAY } from "../../shared/time/date.ts";
import { PIXELS_PER_DAY, xOf, type Zoom } from "../../shared/time/scale.ts";

/** The compact density's `header-row` token, which a row and the axis take (DESIGN, density). */
export const AXIS_HEIGHT = 32;
export const ROW_HEIGHT = 32;
/** The line a field error takes under its row. */
export const NOTE_HEIGHT = 20;
export const BAR_HEIGHT = 14;
/** A plan's baseline: 4px high (proposal, open question 7). */
export const BASELINE_HEIGHT = 4;
/** From the bottom of its task's bar to its top: clear of the change outline, which ends 3px under. */
export const BASELINE_GAP = 4;
/** Calendar days the axis runs past the last finish. */
export const AXIS_TAIL_DAYS = 14;

export type RowBox = {
  readonly top: number;
  readonly height: number;
  /** The middle of the row's first line, where its bar sits. */
  readonly middle: number;
};

export type RowBoxes = {
  readonly boxes: readonly RowBox[];
  readonly height: number;
  /** The axis's height: the same as a row's. */
  readonly axis: number;
};

export type BarBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Each row's box under the axis, by whether a note sits under it; and the chart's height. The rows
 * and the axis are `unit` high: the density's `header-row`.
 */
export const rowBoxes = (notes: readonly boolean[], unit: number = ROW_HEIGHT): RowBoxes => {
  let top = unit;
  const boxes = notes.map((note) => {
    const height = unit + (note ? NOTE_HEIGHT : 0);
    const box = Object.freeze({ top, height, middle: top + unit / 2 });
    top += height;
    return box;
  });
  return Object.freeze({ boxes: Object.freeze(boxes), height: top, axis: unit });
};

/**
 * A task's bar, from its start to its finish, both included, in its row; a milestone, which finishes
 * before it starts, is as wide as nothing.
 */
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
    width: Math.max(0, dayNumber(finish) - dayNumber(start) + 1) * PIXELS_PER_DAY[zoom],
    height: BAR_HEIGHT,
  });

/** A plan's baseline, the agent's dates for its task, under the task's bar in its row. */
export const baselineBox = (
  start: string,
  finish: string,
  origin: string,
  zoom: Zoom,
  row: RowBox,
): BarBox => {
  const bar = barBox(start, finish, origin, zoom, row);
  return Object.freeze({
    x: bar.x,
    y: bar.y + BAR_HEIGHT + BASELINE_GAP,
    width: bar.width,
    height: BASELINE_HEIGHT,
  });
};

// An arrow leaves its predecessor's end by a stub, runs in the channel under (or over) that bar,
// clear of the row's rule, and enters its successor from the left at mid-height after a stub
// (review F-13): never along a row's rule, and no bracket shape.
const STUB = 8;
/** From the predecessor's bar to the channel: the rule is 11px from the bar, so 6px clear of it. */
const CHANNEL_GAP = 5;

/** The path of the arrow from a predecessor's end to its successor's start. */
export const arrowPath = (from: BarBox, to: BarBox): string => {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  if (y1 === y2) return `M${x1},${y1} H${x2}`;
  const channel = y2 > y1 ? from.y + from.height + CHANNEL_GAP : from.y - CHANNEL_GAP;
  return `M${x1},${y1} h${STUB} V${channel} H${x2 - STUB} V${y2} H${x2}`;
};

/**
 * The ID of an item's arrowhead marker, plain or critical, unique on the board: the item's ID
 * between two dots, which no ID holds, so that no item's marker takes another's ID.
 */
export const arrowMarkerId = (itemId: string, critical: boolean): string =>
  `gantt.${itemId}.${critical ? "critical-arrow" : "arrow"}`;

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
