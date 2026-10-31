// The Gantt's dates as the user types and reads them, in en-US (EXPERIENCE, Input atoms): a start
// typed as month/day/year, or as year-month-day, read into an RFC 3339 `full-date`, the format the
// contract carries (AD-7); the grid's form, `12/9/2026`, and the echo beside the field,
// `= Wed, Dec 9, 2026`; and day numbers, which the time scale and drags count calendar days with.
// Plain arithmetic on the calendar, with no `Date`, time zone or locale (AD-13). The range is the
// contract's. Dates are the Gantt's: this module moves to `shared/` when a second widget needs it.

import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "@askboard/contract";

export type DateEntry =
  | { readonly kind: "date"; readonly date: string }
  | { readonly kind: "empty" }
  | { readonly kind: "refused"; readonly reason: string };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_AND_DAY = /^\d{1,2}\/\d{1,2}$/;

const EXAMPLE = "month/day/year, as in 12/9/2026";
const FORMAT = `Write the date as ${EXAMPLE}`;
const NO_YEAR = `Write the year too: ${EXAMPLE}`;

const isLeap = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysIn = (year: number, month: number): number =>
  month === 2 ? (isLeap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

const fullDate = (year: number, month: number, day: number): string =>
  `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;

/** Year, month and day of a `full-date` the Gantt may name, or undefined for anything else. */
const realParts = (date: string): readonly [number, number, number] | undefined => {
  const match = ISO_DATE.exec(date);
  if (match === null) return undefined;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const real = month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
  const inRange = date >= GANTT_FIRST_DATE && date <= GANTT_LAST_DATE;
  return real && inRange ? [year, month, day] : undefined;
};

const outOfRange = (what: string): RangeError =>
  new RangeError(`${what} is no date from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`);

/** Year, month and day of a `full-date` the Gantt may name; a `RangeError` for anything else. */
const partsOf = (date: string): readonly [number, number, number] => {
  const parts = realParts(date);
  if (parts === undefined) throw outOfRange(JSON.stringify(date));
  return parts;
};

/** Whether a value is a `full-date` the Gantt may name: a day that exists, in the contract's range. */
export const isGanttDate = (date: unknown): date is string =>
  typeof date === "string" && realParts(date) !== undefined;

/** The grid's form of a `full-date`: month/day/year, with no leading zeros. */
export const gridDate = (date: string): string => {
  const [year, month, day] = partsOf(date);
  return `${month}/${day}/${year}`;
};

// Howard Hinnant's days_from_civil and civil_from_days, proleptic Gregorian: days from 1970-01-01.
const daysFromCivil = (year: number, month: number, day: number): number => {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
};

const civilFromDays = (days: number): readonly [number, number, number] => {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shifted = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shifted + 2) / 5) + 1;
  const month = shifted < 10 ? shifted + 3 : shifted - 9;
  return [yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day];
};

/** A `full-date` the Gantt may name as its day number, the days from 1970-01-01. */
export const dayNumber = (date: string): number => daysFromCivil(...partsOf(date));

/** The day numbers of the contract's first and last dates. */
export const FIRST_DAY = dayNumber(GANTT_FIRST_DATE);
export const LAST_DAY = dayNumber(GANTT_LAST_DATE);

/** The `full-date` of a day number; a `RangeError` for one the Gantt may not name. */
export const dateOfDay = (day: number): string => {
  if (!Number.isInteger(day) || day < FIRST_DAY || day > LAST_DAY) throw outOfRange(`day ${day}`);
  return fullDate(...civilFromDays(day));
};

export type CalendarDay = {
  readonly year: number;
  /** From 1, January. */
  readonly month: number;
  readonly day: number;
  /** From 0, Sunday. */
  readonly weekday: number;
  readonly daysInMonth: number;
  /** The en-US abbreviations, as in `Nov` and `Mon`. */
  readonly monthName: string;
  readonly weekdayName: string;
};

/** A `full-date` the Gantt may name, spelled out. 1970-01-01 was a Thursday. */
export const calendarDay = (date: string): CalendarDay => {
  const [year, month, day] = partsOf(date);
  const weekday = (((daysFromCivil(year, month, day) + 4) % 7) + 7) % 7;
  return Object.freeze({
    year,
    month,
    day,
    weekday,
    daysInMonth: daysIn(year, month),
    monthName: (MONTHS[month - 1] as string).slice(0, 3),
    weekdayName: WEEKDAYS[weekday] as string,
  });
};

/** The echo beside a date field: the weekday and the day, spelled out. */
export const echoDate = (date: string): string => {
  const { year, day, monthName, weekdayName } = calendarDay(date);
  return `= ${weekdayName}, ${monthName} ${day}, ${year}`;
};

const refused = (reason: string): DateEntry => ({ kind: "refused", reason });

/**
 * What the user typed in a date field: a `full-date`, an empty field, or a refusal saying why.
 * Month/day/year takes one or two digits for the month and the day and four for the year;
 * year-month-day takes exactly two for the month and the day. Surrounding spaces are ignored.
 */
export const parseDateEntry = (text: string): DateEntry => {
  const entry = text.trim();
  if (entry === "") return { kind: "empty" };
  if (MONTH_AND_DAY.test(entry)) return refused(NO_YEAR);
  const us = US_DATE.exec(entry);
  const iso = ISO_DATE.exec(entry);
  const parts = us !== null ? [us[3], us[1], us[2]] : iso !== null ? iso.slice(1) : undefined;
  if (parts === undefined) return refused(FORMAT);
  const [year, month, day] = parts.map(Number) as [number, number, number];
  if (month < 1 || month > 12) return refused(`${month} is not a month: write ${EXAMPLE}`);
  if (day < 1 || day > daysIn(year, month)) {
    return refused(`${MONTHS[month - 1]} ${year} has no day ${day}`);
  }
  const date = fullDate(year, month, day);
  if (!isGanttDate(date)) {
    return refused(`Pick a day from ${gridDate(GANTT_FIRST_DATE)} to ${gridDate(GANTT_LAST_DATE)}`);
  }
  return { kind: "date", date };
};
