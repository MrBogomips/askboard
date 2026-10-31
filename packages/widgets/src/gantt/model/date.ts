// The Gantt's dates as the user types and reads them, in en-US (EXPERIENCE, Input atoms): a start
// typed as month/day/year, or as year-month-day, read into an RFC 3339 `full-date`, the format the
// contract carries (AD-7); the grid's form, `12/9/2026`, and the echo beside the field,
// `= Wed, Dec 9, 2026`. Plain arithmetic on the calendar, with no time zone or locale (AD-13).
// Dates are the Gantt's: this module moves to `shared/` when a second widget needs it.

/** The days a Gantt may name, as the contract's `GANTT_FIRST_DATE` and `GANTT_LAST_DATE`. */
const FIRST_DATE = "1900-03-02";
const LAST_DATE = "9999-12-31";

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

/** Year, month and day of a `full-date` the Gantt may name; a `RangeError` for anything else. */
const partsOf = (date: string): readonly [number, number, number] => {
  const match = ISO_DATE.exec(date);
  const [year, month, day] = match === null ? [0, 0, 0] : match.slice(1).map(Number);
  const real =
    match !== null &&
    (month as number) >= 1 &&
    (month as number) <= 12 &&
    (day as number) >= 1 &&
    (day as number) <= daysIn(year as number, month as number);
  if (!real || date < FIRST_DATE || date > LAST_DATE) {
    throw new RangeError(`${JSON.stringify(date)} is no date from ${FIRST_DATE} to ${LAST_DATE}`);
  }
  return [year as number, month as number, day as number];
};

/** The grid's form of a `full-date`: month/day/year, with no leading zeros. */
export const gridDate = (date: string): string => {
  const [year, month, day] = partsOf(date);
  return `${month}/${day}/${year}`;
};

/** Days from 1970-01-01 (Howard Hinnant's days_from_civil, proleptic Gregorian). */
const daysFromCivil = (year: number, month: number, day: number): number => {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
};

/** The echo beside a date field: the weekday and the day, spelled out. 1970-01-01 was a Thursday. */
export const echoDate = (date: string): string => {
  const [year, month, day] = partsOf(date);
  const weekday = WEEKDAYS[(((daysFromCivil(year, month, day) + 4) % 7) + 7) % 7];
  return `= ${weekday}, ${MONTHS[month - 1]?.slice(0, 3)} ${day}, ${year}`;
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
  if (date < FIRST_DATE || date > LAST_DATE) {
    return refused(`Pick a day from ${gridDate(FIRST_DATE)} to ${gridDate(LAST_DATE)}`);
  }
  return { kind: "date", date };
};
