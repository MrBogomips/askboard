// The Gantt's time scale (design decision 8): calendar days, weekends unmarked (proposal, open
// question 8), at a width per zoom; the axis ticks and their en-US labels; and the conversion
// between a day and its x position from the axis's origin. A plan zooms; a standalone Gantt shows
// the week scale (proposal, open question 5). Day arithmetic is on day numbers, with no `Date`.

import { calendarDay, dateOfDay, dayNumber } from "./date.ts";

export const ZOOMS = Object.freeze(["day", "week", "month"] as const);

export type Zoom = (typeof ZOOMS)[number];

/** Whether a text names a zoom: a toggle group turned off gives the empty text. */
export const isZoom = (text: string): text is Zoom => (ZOOMS as readonly string[]).includes(text);

/** Pixels per calendar day: the week's matches the UJ-2 mock. */
export const PIXELS_PER_DAY: Readonly<Record<Zoom, number>> = Object.freeze({
  day: 32,
  week: 15,
  month: 4,
});

/** A tick on the axis: its day, its x from the origin and its label. */
export type Tick = { readonly date: string; readonly x: number; readonly label: string };

/** The x of a day's left edge, from the origin's. */
export const xOf = (date: string, origin: string, zoom: Zoom): number =>
  (dayNumber(date) - dayNumber(origin)) * PIXELS_PER_DAY[zoom];

/** The day nearest to an x position, from the origin. */
export const dateAt = (x: number, origin: string, zoom: Zoom): string =>
  dateOfDay(dayNumber(origin) + Math.round(x / PIXELS_PER_DAY[zoom]));

/** A tick's label by zoom: `Mon 2` each day, `Nov 2` each Monday, `Nov 2026` each month. */
const label = (date: string, zoom: Zoom): string => {
  const { year, day, monthName, weekdayName } = calendarDay(date);
  if (zoom === "day") return `${weekdayName} ${day}`;
  return zoom === "week" ? `${monthName} ${day}` : `${monthName} ${year}`;
};

/** The day number of the first tick on or after a day, and the days to the one after a tick. */
const firstTick = (day: number, zoom: Zoom): number => {
  if (zoom === "day") return day;
  const { weekday, day: dayOfMonth, daysInMonth } = calendarDay(dateOfDay(day));
  if (zoom === "week") return day + ((8 - weekday) % 7);
  return dayOfMonth === 1 ? day : day + daysInMonth - dayOfMonth + 1;
};

const step = (day: number, zoom: Zoom): number => {
  if (zoom === "day") return 1;
  return zoom === "week" ? 7 : calendarDay(dateOfDay(day)).daysInMonth;
};

/** The ticks of an axis from its origin to its last day, both included. */
export const ticks = (origin: string, last: string, zoom: Zoom): readonly Tick[] => {
  const end = dayNumber(last);
  const out: Tick[] = [];
  for (let day = firstTick(dayNumber(origin), zoom); day <= end; day += step(day, zoom)) {
    const date = dateOfDay(day);
    out.push(Object.freeze({ date, x: xOf(date, origin, zoom), label: label(date, zoom) }));
  }
  return Object.freeze(out);
};
