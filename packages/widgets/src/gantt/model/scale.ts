// The Gantt's time scale (design decision 8): calendar days, weekends unmarked (proposal, open
// question 8), at a width per zoom; the axis ticks and their labels in the ask's locale; and the conversion
// between a day and its x position from the axis's origin. A plan zooms; a standalone Gantt shows
// the week scale (proposal, open question 5). Day arithmetic is on day numbers, with no `Date`.
// A start up to 9999-12-31 is valid, so an axis may span millennia: it draws at most about 2,000
// ticks, and finds them by counting its days, Mondays or months, never by walking them.

import { formatAxisLabel, type Locale } from "@askboard/contract";
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

/**
 * The most ticks an axis draws: a span that would draw more keeps every n-th tick of its zoom, the
 * smallest n that stays within it, each labelled, so that the labels thin with the ticks.
 */
export const MAX_TICKS = 2_000;

/** A tick on the axis: its day, its x from the origin and its label. */
export type Tick = { readonly date: string; readonly x: number; readonly label: string };

/** The x of a day's left edge, from the origin's. */
export const xOf = (date: string, origin: string, zoom: Zoom): number =>
  (dayNumber(date) - dayNumber(origin)) * PIXELS_PER_DAY[zoom];

/** The day nearest to an x position, from the origin. */
export const dateAt = (x: number, origin: string, zoom: Zoom): string =>
  dateOfDay(dayNumber(origin) + Math.round(x / PIXELS_PER_DAY[zoom]));

/**
 * A tick's label by zoom, in the locale: `Mon 2` each day, `Nov 2` each Monday and `Nov 2026` each
 * month in en-US; `lun 2`, `2 nov` and `nov 2026` in it-IT.
 */
const label = (date: string, zoom: Zoom, locale: Locale): string =>
  formatAxisLabel(date, zoom, locale);

/** An axis's ticks before thinning: how many, and the day number of each by its index. */
type TickDays = { readonly count: number; readonly dayOf: (index: number) => number };

/** A day's month, counted from year 0's January. */
const monthOf = (day: number): number => {
  const { year, month } = calendarDay(dateOfDay(day));
  return year * 12 + month - 1;
};

/** The day number of a month's first day, the month counted as `monthOf` counts it. */
const firstDayOf = (month: number): number => {
  const year = String(Math.floor(month / 12)).padStart(4, "0");
  return dayNumber(`${year}-${String((month % 12) + 1).padStart(2, "0")}-01`);
};

/**
 * Each day, each Monday, or each month's first day, from the first on or after the origin to the
 * last day: counted, never walked, so that a span of millennia costs no more than a week's.
 */
const tickDays = (origin: number, end: number, zoom: Zoom): TickDays => {
  if (zoom === "day") return { count: end - origin + 1, dayOf: (index) => origin + index };
  const { weekday, day } = calendarDay(dateOfDay(origin));
  if (zoom === "week") {
    const monday = origin + ((8 - weekday) % 7);
    return { count: Math.floor((end - monday) / 7) + 1, dayOf: (index) => monday + 7 * index };
  }
  const first = monthOf(origin) + (day === 1 ? 0 : 1);
  return { count: monthOf(end) - first + 1, dayOf: (index) => firstDayOf(first + index) };
};

/**
 * The ticks of an axis from its origin to its last day, both included: every tick of its zoom, or
 * over a span that would draw more than `MAX_TICKS`, every n-th from the first.
 */
export const ticks = (
  origin: string,
  last: string,
  zoom: Zoom,
  locale: Locale = "en-US",
): readonly Tick[] => {
  const { count, dayOf } = tickDays(dayNumber(origin), dayNumber(last), zoom);
  const every = Math.max(1, Math.ceil(count / MAX_TICKS));
  const kept = Math.max(0, Math.ceil(count / every));
  const out = Array.from({ length: kept }, (_, index) => {
    const date = dateOfDay(dayOf(index * every));
    return Object.freeze({ date, x: xOf(date, origin, zoom), label: label(date, zoom, locale) });
  });
  return Object.freeze(out);
};

/**
 * The lines an axis label is drawn in: at day zoom, whose column is 32px, the weekday over the day
 * (`mer` over `11`), since both side by side run into the next label; one line at the others,
 * whose columns hold theirs.
 */
export const labelLines = (text: string, zoom: Zoom): readonly string[] => {
  const space = text.lastIndexOf(" ");
  return zoom === "day" && space > 0 ? [text.slice(0, space), text.slice(space + 1)] : [text];
};
