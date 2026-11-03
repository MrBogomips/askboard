// Dates as Excel serials (1900 system: serial 0 is 1899-12-30), converted with integer calendar
// arithmetic and no `Date`, so no time zone or locale can reach a derived value (AD-13). Serials
// before 61 (1900-03-01) are refused: Excel's fictitious 1900-02-29 shifts them.

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Days from 1970-01-01 back to 1899-12-30. */
const EPOCH_OFFSET = -25_569;
/** 1900-03-01. */
export const MIN_SERIAL = 61;
/** 9999-12-31, Excel's last date. */
export const MAX_SERIAL = 2_958_465;

// Howard Hinnant's days_from_civil and civil_from_days, proleptic Gregorian.
const daysFromCivil = (y: number, m: number, d: number): number => {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
};

const civilFromDays = (z0: number): [number, number, number] => {
  const z = z0 + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
};

/** A `full-date` as a serial, or undefined when it is no real day from 1900-03-01 to 9999-12-31. */
export const serialOf = (text: string): number | undefined => {
  const match = FULL_DATE.exec(text);
  if (match === null) return undefined;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const days = daysFromCivil(y, m, d);
  const [ry, rm, rd] = civilFromDays(days);
  if (ry !== y || rm !== m || rd !== d) return undefined;
  const serial = days - EPOCH_OFFSET;
  return serial >= MIN_SERIAL && serial <= MAX_SERIAL ? serial : undefined;
};

/** A serial's day as a `full-date`, or undefined out of range; the fraction of a day is dropped. */
export const fullDateOf = (serial: number): string | undefined => {
  const day = Math.floor(serial);
  if (!Number.isFinite(day) || day < MIN_SERIAL || day > MAX_SERIAL) return undefined;
  const [y, m, d] = civilFromDays(day + EPOCH_OFFSET);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** 0 is Sunday; serial 0, 1899-12-30, was a Saturday. */
const weekday = (serial: number): number => (((serial + 6) % 7) + 7) % 7;

const isWorkingDay = (serial: number): boolean => {
  const day = weekday(serial);
  return day !== 0 && day !== 6;
};

/** The first working day on or after a serial's day. */
export const firstWorkingDay = (serial: number): number => workday(Math.floor(serial) - 1, 1);

/**
 * The working days from `from` up to, not including, `to`: negative when `to` comes first. From a
 * working day, `workday(from, countWorkingDays(from, to))` is `to` for every working day `to`.
 */
export const countWorkingDays = (from: number, to: number): number => {
  const [start, end] = [Math.floor(from), Math.floor(to)];
  // `0 - n`, not `-n`: no working day between them is 0, never -0.
  if (end < start) return 0 - countWorkingDays(end, start);
  // Any seven consecutive days hold exactly five working days.
  const weeks = Math.floor((end - start) / 7);
  let count = 5 * weeks;
  for (let day = start + 7 * weeks; day < end; day++) if (isWorkingDay(day)) count++;
  return count;
};

/** Excel's WORKDAY without holidays: n truncated toward zero; n = 0 gives the date itself. */
export const workday = (start: number, n: number): number => {
  let day = Math.floor(start);
  const step = n < 0 ? -1 : 1;
  let remaining = Math.abs(Math.trunc(n));
  if (remaining === 0) return day;
  // Any seven consecutive days hold exactly five working days.
  const weeks = Math.floor((remaining - 1) / 5);
  day += 7 * weeks * step;
  remaining -= 5 * weeks;
  while (remaining > 0) {
    day += step;
    if (isWorkingDay(day)) remaining--;
  }
  return day;
};

// The calendar on `full-date` strings, for the view: whether a day is a working day, and working-day
// arithmetic, by AD-7's default calendar, Monday to Friday with no holidays. A date outside the
// graph's range, or no date, is refused with a `RangeError` naming it.

const serialFrom = (date: string): number => {
  const serial = serialOf(date);
  if (serial === undefined) {
    throw new RangeError(`${JSON.stringify(date)} is not a date from 1900-03-01 to 9999-12-31`);
  }
  return serial;
};

const dateFrom = (serial: number): string => {
  const date = fullDateOf(serial);
  if (date === undefined) {
    throw new RangeError("the day falls outside the dates from 1900-03-01 to 9999-12-31");
  }
  return date;
};

/** Whether a day is a working day. */
export const isWorkingDate = (date: string): boolean => isWorkingDay(serialFrom(date));

/** The first working day on or after a day: the day itself when it is one. */
export const firstWorkingDateFrom = (date: string): string =>
  dateFrom(firstWorkingDay(serialFrom(date)));

/** The day `n` working days after `date`, before it when `n` is negative: Excel's WORKDAY. */
export const addWorkingDays = (date: string, n: number): string => {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${n} is not a whole number of working days`);
  // As the engine's WORKDAY: no count past the graph's last serial reaches a day it holds, and a
  // larger one would step past 2^53, where adding a day no longer changes the number.
  if (Math.abs(n) > MAX_SERIAL) throw new RangeError(`${n} working days reach no date`);
  return dateFrom(workday(serialFrom(date), n));
};

/** The working days from `from` up to, not including, `to`; negative when `to` comes first. */
export const workingDaysBetween = (from: string, to: string): number =>
  countWorkingDays(serialFrom(from), serialFrom(to));
