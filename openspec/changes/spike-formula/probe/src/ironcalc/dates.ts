// full-date <-> Excel serial (1900 system, serial 0 = 1899-12-30) with Date.UTC arithmetic
// only: no local time, so neither TZ nor the locale can reach it. Serials before 61
// (1900-03-01) are refused, as in the own evaluator: Excel's fictitious 1900-02-29 shifts them.

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;
const EPOCH_MS = Date.UTC(1899, 11, 30);
const MIN_SERIAL = 61;
/** 9999-12-31. */
const MAX_SERIAL = 2958465;

export function fullDateToSerial(text: string): number | null {
  const m = FULL_DATE.exec(text);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const serial = Math.round((ms - EPOCH_MS) / DAY_MS);
  return serial >= MIN_SERIAL && serial <= MAX_SERIAL ? serial : null;
}

export function serialToFullDate(serial: number): string | null {
  const s = Math.floor(serial);
  if (!Number.isFinite(s) || s < MIN_SERIAL || s > MAX_SERIAL) return null;
  return new Date(EPOCH_MS + s * DAY_MS).toISOString().slice(0, 10);
}
