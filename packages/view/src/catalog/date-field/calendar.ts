// What the DateField's calendar takes from AskBoard's own tables (atoms, design decision 7;
// view-and-widgets spec: The DateField's calendar): react-day-picker is given the item's range, the
// week's first day, and formatters and labels written from the contract's month and weekday names
// and the view's strings, so that it never reaches the runtime's `Intl` or `toLocale*`, and a day
// picked is the day the calendar shows, whatever the viewer's time zone: a full-date and a calendar
// day are converted by year, month and day alone, the day taken at noon so that no daylight-saving
// gap swallows it. Plain functions, tested without a DOM.

import {
  type DateFieldProps,
  formatLongDate,
  GANTT_FIRST_DATE,
  GANTT_LAST_DATE,
  type Locale,
  tableOf,
} from "@askboard/contract";
import { say } from "../port.ts";

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day a full-date names: its own year, month and day, at noon in the viewer's zone. */
export const dayOf = (fullDate: string): Date => {
  const parts = FULL_DATE.exec(fullDate);
  if (parts === null) throw new RangeError(`${JSON.stringify(fullDate)} is no full-date`);
  const [year, month, day] = parts.slice(1).map(Number) as [number, number, number];
  return new Date(year, month - 1, day, 12);
};

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

/** The full-date of a calendar day: its local year, month and day, whatever the time of day. */
export const fullDateOf = (day: Date): string =>
  `${pad(day.getFullYear(), 4)}-${pad(day.getMonth() + 1, 2)}-${pad(day.getDate(), 2)}`;

/** The days the item takes: its `min` and `max`, else the Gantt's first and last days. */
export const rangeOf = (
  props: DateFieldProps,
): { readonly first: string; readonly last: string } => ({
  first: props.min ?? GANTT_FIRST_DATE,
  last: props.max ?? GANTT_LAST_DATE,
});

/** The months the calendar may show: those of the first and the last day. */
export const monthRangeOf = (
  props: DateFieldProps,
): { readonly start: Date; readonly end: Date } => {
  const { first, last } = rangeOf(props);
  return { start: dayOf(first), end: dayOf(last) };
};

/** The days outside the range, which the calendar draws disabled. */
export const disabledOf = (props: DateFieldProps) => {
  const { first, last } = rangeOf(props);
  return [{ before: dayOf(first) }, { after: dayOf(last) }];
};

/** The week's first day: Monday (1) where a date is written day first, Sunday (0) otherwise. */
export const weekStartOf = (locale: Locale): 0 | 1 => (tableOf(locale).dayFirst ? 1 : 0);

const captionOf = (month: Date, locale: Locale): string =>
  `${tableOf(locale).months[month.getMonth()] ?? ""} ${month.getFullYear()}`;

const weekdayOf = (day: Date, locale: Locale): string =>
  tableOf(locale).weekdays[day.getDay()] ?? "";

const longDateOf = (day: Date, locale: Locale): string => formatLongDate(fullDateOf(day), locale);

/** The formatters react-day-picker draws the caption and the weekday header with. */
export const calendarFormatters = (locale: Locale) => ({
  formatCaption: (month: Date): string => captionOf(month, locale),
  formatWeekdayName: (day: Date): string => weekdayOf(day, locale),
});

/**
 * The labels react-day-picker names its parts with: the grid by the caption, a day by its long
 * date, a weekday by its short name, and the navigation by the view's strings in the ask's language.
 */
export const calendarLabels = (locale: Locale, language: Locale) => ({
  labelNav: (): string => say(language, "date.nav"),
  labelPrevious: (): string => say(language, "date.previous"),
  labelNext: (): string => say(language, "date.next"),
  labelGrid: (month: Date): string => captionOf(month, locale),
  labelGridcell: (day: Date): string => longDateOf(day, locale),
  labelDayButton: (day: Date): string => longDateOf(day, locale),
  labelWeekday: (day: Date): string => weekdayOf(day, locale),
});

/** What a day picked in the calendar does: the draft's result, the typed text forgotten, the popover closed. */
export type PickSinks = {
  readonly result: (date: string) => void;
  readonly remember: (text: string | undefined) => void;
  readonly close: () => void;
};

/**
 * The handler of the calendar's pick: the day becomes the item's result by its own year, month and
 * day, so that the field then shows it written in the locale's form, and the calendar closes.
 */
export const pickedDay =
  ({ result, remember, close }: PickSinks) =>
  (day: Date): void => {
    result(fullDateOf(day));
    remember(undefined);
    close();
  };
