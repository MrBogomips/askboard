// Dates as Excel serials (1900 system: serial 0 is 1899-12-30) inside the engine. The
// conversion is pure integer calendar arithmetic, so no time zone or locale can reach it.
// Serials before 61 (1900-03-01) are refused: Excel's fictitious 1900-02-29 shifts them.

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Days from 1970-01-01 to 1899-12-30. */
const EPOCH_OFFSET = -25569;
export const MIN_SERIAL = 61;
/** 9999-12-31, Excel's last date. */
export const MAX_SERIAL = 2958465;

// Howard Hinnant's days_from_civil and civil_from_days (proleptic Gregorian).
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z0: number): [number, number, number] {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return [y, m, d];
}

/** `full-date` to serial, or null if the text is not a real calendar date in Excel's range. */
export function fullDateToSerial(text: string): number | null {
  const m = FULL_DATE.exec(text);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const days = daysFromCivil(y, mo, d);
  const [ry, rm, rd] = civilFromDays(days);
  if (ry !== y || rm !== mo || rd !== d) return null;
  const serial = days - EPOCH_OFFSET;
  return serial >= MIN_SERIAL && serial <= MAX_SERIAL ? serial : null;
}

export function serialToFullDate(serial: number): string | null {
  const s = Math.floor(serial);
  if (!Number.isFinite(s) || s < MIN_SERIAL || s > MAX_SERIAL) return null;
  const [y, m, d] = civilFromDays(s + EPOCH_OFFSET);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 0 is Sunday; serial 0 (1899-12-30) was a Saturday. */
function weekday(serial: number): number {
  return (((serial + 6) % 7) + 7) % 7;
}

function isWorkingDay(serial: number): boolean {
  const w = weekday(serial);
  return w !== 0 && w !== 6;
}

/** Excel's WORKDAY without holidays: n truncated toward zero; n = 0 returns the date itself. */
export function workday(start: number, n: number): number {
  let d = Math.floor(start);
  const step = n < 0 ? -1 : 1;
  let remaining = Math.abs(Math.trunc(n));
  if (remaining === 0) return d;
  // Any seven consecutive days hold exactly five working days.
  const weeks = Math.floor((remaining - 1) / 5);
  d += 7 * weeks * step;
  remaining -= 5 * weeks;
  while (remaining > 0) {
    d += step;
    if (isWorkingDay(d)) remaining--;
  }
  return d;
}

/** Excel's NETWORKDAYS without holidays: both ends included, negative when end < start. */
export function networkdays(start: number, end: number): number {
  const a = Math.floor(start);
  const b = Math.floor(end);
  if (a > b) return -networkdays(b, a);
  const days = b - a + 1;
  const weeks = Math.floor(days / 7);
  let count = weeks * 5;
  for (let d = a + weeks * 7; d <= b; d++) if (isWorkingDay(d)) count++;
  return count;
}
