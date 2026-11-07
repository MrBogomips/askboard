// The Gantt's pointer edits (design decision 8; EXPERIENCE Widgets, Gantt): what a bar's move or
// its end's resize gives from the pointer's horizontal travel. A move lands on the nearest day,
// then on the first working day from it, never before the earliest start the predecessors allow;
// landing on the earliest start clears the request. A resize lasts the working days from the start
// to the nearest day under the bar's end, from 1. A travel under the threshold is a click and
// changes nothing. The working-day calendar is `compute`'s; day arithmetic is on day numbers.

import { firstWorkingDateFrom, isWorkingDate, workingDaysBetween } from "@askboard/compute";
import { GANTT_MAX_DURATION, GANTT_MIN_DURATION } from "@askboard/contract";
import { dateOfDay, dayNumber, FIRST_DAY, LAST_DAY } from "../../shared/time/date.ts";
import { PIXELS_PER_DAY, type Zoom } from "../../shared/time/scale.ts";

/** Pixels the pointer travels before a press on a bar becomes a drag. */
export const DRAG_THRESHOLD = 3;

export type Click = { readonly kind: "click" };

export type Move =
  | Click
  /** The task asks to start on `start`. */
  | { readonly kind: "request"; readonly start: string }
  /** The task lands on its earliest start, `start`, and holds no request. */
  | { readonly kind: "clear"; readonly start: string };

export type Resize = Click | { readonly kind: "duration"; readonly duration: number };

const CLICK: Click = Object.freeze({ kind: "click" });

const isClick = (dx: number): boolean => Math.abs(dx) < DRAG_THRESHOLD;

/** Whole calendar days under a travel, the nearest. */
const daysUnder = (dx: number, zoom: Zoom): number => Math.round(dx / PIXELS_PER_DAY[zoom]);

/** A day number within the days a Gantt may name. */
const clampDay = (day: number): number => Math.min(LAST_DAY, Math.max(FIRST_DAY, day));

/**
 * Where a bar starting on `start` lands after a travel of `dx` pixels, its task's earliest start
 * being `earliest`, a working day.
 */
export const moveDrop = (drag: {
  readonly start: string;
  readonly earliest: string;
  readonly dx: number;
  readonly zoom: Zoom;
}): Move => {
  if (isClick(drag.dx)) return CLICK;
  const nearest = dateOfDay(clampDay(dayNumber(drag.start) + daysUnder(drag.dx, drag.zoom)));
  const working = firstWorkingDateFrom(nearest);
  // Full-dates of four-digit years compare as their days do.
  if (working <= drag.earliest) return Object.freeze({ kind: "clear", start: drag.earliest });
  return Object.freeze({ kind: "request", start: working });
};

/** The duration of a bar from `start` to `finish` after its end travels `dx` pixels. */
export const resizeDrop = (drag: {
  readonly start: string;
  readonly finish: string;
  readonly dx: number;
  readonly zoom: Zoom;
}): Resize => {
  if (isClick(drag.dx)) return CLICK;
  const end = dayNumber(drag.finish) + daysUnder(drag.dx, drag.zoom);
  let duration = GANTT_MIN_DURATION;
  if (end >= dayNumber(drag.start)) {
    const last = dateOfDay(Math.min(LAST_DAY, end));
    const days = workingDaysBetween(drag.start, last) + (isWorkingDate(last) ? 1 : 0);
    duration = Math.min(GANTT_MAX_DURATION, Math.max(GANTT_MIN_DURATION, days));
  }
  return Object.freeze({ kind: "duration", duration });
};
