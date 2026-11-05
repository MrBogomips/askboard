// Calendar dates and times in a locale (settings-languages design decision 8). A calendar date is
// split from its `full-date` text and never meets a time zone (AD-7); a time is an RFC 3339 instant
// shown at the offset it is given, which the view takes from the viewer's time zone.

import { instantAt, parseFullDate } from "./calendar.ts";
import { type AxisZoom, type Locale, tableOf } from "./tables.ts";

/** A `full-date`: `10/27/2026` in en-US, `27/10/2026` in it-IT. */
export const formatDate = (date: string, locale: Locale): string =>
  tableOf(locale).date(parseFullDate(date));

/** A `full-date` with its weekday: `Tue, Oct 27, 2026` in en-US, `mar 27 ott 2026` in it-IT. */
export const formatLongDate = (date: string, locale: Locale): string =>
  tableOf(locale).longDate(parseFullDate(date));

/** A Gantt axis label at a zoom: `Mon 2`, `Nov 2` or `Nov 2026` in en-US. */
export const formatAxisLabel = (date: string, zoom: AxisZoom, locale: Locale): string =>
  tableOf(locale).axis[zoom](parseFullDate(date));

/**
 * The time of an instant at an offset in minutes east of UTC (`+01:00` is 60): `4:12 PM` in
 * en-US, `16:12` in it-IT.
 */
export const formatTime = (instant: string, offsetMinutes: number, locale: Locale): string => {
  const table = tableOf(locale);
  return table.time(instantAt(instant, offsetMinutes));
};

/** The day and time of an instant at an offset: `Oct 28, 2026, 4:12 PM`, `28 ott 2026, 16:12`. */
export const formatDateTime = (instant: string, offsetMinutes: number, locale: Locale): string => {
  const table = tableOf(locale);
  return table.dateTime(instantAt(instant, offsetMinutes));
};
