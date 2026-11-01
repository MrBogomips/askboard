// Calendar arithmetic for the formats (AD-7, AD-13): a `full-date` is split from its text and its
// weekday computed, and an RFC 3339 instant is moved to an offset by counting minutes, so nothing
// depends on the runtime's time zone or locale. Proleptic Gregorian calendar.

export type CalendarParts = {
  readonly year: number;
  /** From 1, January. */
  readonly month: number;
  readonly day: number;
  /** From 0, Sunday. */
  readonly weekday: number;
};

export type ClockParts = CalendarParts & { readonly hour: number; readonly minute: number };

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;
const MINUTES_PER_DAY = 1_440;

export const isLeap = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const daysIn = (year: number, month: number): number =>
  month === 2 ? (isLeap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

// Howard Hinnant's days_from_civil and civil_from_days: days from 1970-01-01.
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

/** Whether a year, month and day name a day that exists. */
export const isRealDay = (year: number, month: number, day: number): boolean =>
  month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);

/** A day's parts with its weekday; 1970-01-01 was a Thursday. */
export const partsOfDay = (year: number, month: number, day: number): CalendarParts => ({
  year,
  month,
  day,
  weekday: (((daysFromCivil(year, month, day) + 4) % 7) + 7) % 7,
});

/** The parts of an RFC 3339 `full-date`; a `RangeError` for any text that names no real day. */
export const parseFullDate = (date: string): CalendarParts => {
  const match = FULL_DATE.exec(date);
  const [year, month, day] = (match?.slice(1) ?? []).map(Number) as [number, number, number];
  if (match === null || !isRealDay(year, month, day)) {
    throw new RangeError(`${JSON.stringify(date)} is not a full-date that exists`);
  }
  return partsOfDay(year, month, day);
};

/** Checks an offset in minutes east of UTC, as RFC 3339 writes one. */
const checkOffset = (offsetMinutes: number): void => {
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) >= MINUTES_PER_DAY) {
    throw new RangeError(`${offsetMinutes} is not an offset in whole minutes under a day`);
  }
};

/**
 * The calendar day and the clock of an RFC 3339 instant at an offset in minutes east of UTC, so
 * `+01:00` is 60; seconds are dropped. A `RangeError` for anything else.
 */
export const instantAt = (instant: string, offsetMinutes: number): ClockParts => {
  checkOffset(offsetMinutes);
  const match = INSTANT.exec(instant);
  const [year, month, day, hour, minute, second] = (match?.slice(1, 7) ?? []).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const [, , , , , , , sign, offsetHour = "0", offsetMinute = "0"] = match ?? [];
  const own = (sign === "-" ? -1 : 1) * (Number(offsetHour) * 60 + Number(offsetMinute));
  const valid =
    match !== null &&
    isRealDay(year, month, day) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 60 &&
    Number(offsetHour) <= 23 &&
    Number(offsetMinute) <= 59;
  if (!valid) throw new RangeError(`${JSON.stringify(instant)} is not an RFC 3339 instant`);
  const total =
    daysFromCivil(year, month, day) * MINUTES_PER_DAY + hour * 60 + minute - own + offsetMinutes;
  const days = Math.floor(total / MINUTES_PER_DAY);
  const ofDay = total - days * MINUTES_PER_DAY;
  return {
    ...partsOfDay(...civilFromDays(days)),
    hour: Math.floor(ofDay / 60),
    minute: ofDay % 60,
  };
};
