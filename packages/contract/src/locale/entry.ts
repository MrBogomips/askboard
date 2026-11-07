// Number and date entry in the ask's locale (settings-languages design decision 8; EXPERIENCE,
// Input atoms): a widget reads what the user typed in a text input, never the browser's number or
// date input, and echoes the value it read. An ambiguous or malformed entry is refused with the
// first rule it breaks, in the order a reader would fix it, in the ask's language. In it-IT the
// rules are the en-US ones with the two marks swapped.

import { isRealDay } from "./calendar.ts";
import { formatLongDate } from "./dates.ts";
import {
  type DateRefusalCode,
  dateRefusalText,
  type NumberRefusalCode,
  numberRefusalText,
} from "./entry-texts.ts";
import { plainText } from "./numbers.ts";
import { type Locale, tableOf } from "./tables.ts";

export type { DateRefusalCode, NumberRefusalCode } from "./entry-texts.ts";

export type NumberEntry =
  | { readonly kind: "number"; readonly value: number }
  /** Nothing typed: the field is empty. */
  | { readonly kind: "empty" }
  | { readonly kind: "refused"; readonly code: NumberRefusalCode; readonly reason: string };

export type DateEntry =
  /** An RFC 3339 `full-date`, the form answers carry (AD-7). */
  | { readonly kind: "date"; readonly date: string }
  | { readonly kind: "empty" }
  | { readonly kind: "refused"; readonly code: DateRefusalCode; readonly reason: string };

const EMPTY = Object.freeze({ kind: "empty" as const });

const OTHER = /[^0-9,.+-]/;
const EXPONENT = /^[+-]?[0-9,.]+e[+-]?[0-9]+$/i;
const ONE_LEADING_SIGN = /^[+-]?[^+-]*$/;

// The first rule an entry breaks, with the character it is about when that is the rule. Exported
// for the amount entry (atoms, design decision 2), which applies the same rules to the text.
export const numberProblem = (
  text: string,
  decimal: string,
  group: string,
): { code: NumberRefusalCode; character?: string } | undefined => {
  if (EXPONENT.test(text)) return { code: "exponent" };
  const other = OTHER.exec(text);
  if (other !== null) return { code: "character", character: other[0] };
  if (!ONE_LEADING_SIGN.test(text)) return { code: "sign" };
  if (!/[0-9]/.test(text)) return { code: "no-digits" };
  const [whole = "", ...decimals] = text.replace(/^[+-]/, "").split(decimal);
  if (decimals.length > 1) return { code: "decimal-marks" };
  if (whole === "" || decimals[0] === "") return { code: "decimal-sides" };
  // The group mark is `,` or `.`, escaped so a dot stands for itself.
  const grouped = new RegExp(`^[1-9][0-9]{0,2}(\\${group}[0-9]{3})+$`);
  if (decimals[0]?.includes(group) || (whole.includes(group) && !grouped.test(whole))) {
    return { code: "grouping" };
  }
  return undefined;
};

export const numberRefusal = (
  code: NumberRefusalCode,
  locale: Locale,
  language: Locale,
  character = "",
): NumberEntry => {
  const { decimal, group } = tableOf(locale);
  const example = `1${group}234${decimal}5`;
  const reason = numberRefusalText(code, language, {
    decimal,
    example,
    half: `0${decimal}5`,
    character,
  });
  return Object.freeze({ kind: "refused", code, reason });
};

/**
 * Reads a number typed in `locale`: a number, an empty field, or a refusal whose reason is in
 * `language`, the ask's language, which is the locale's unless the ask sets them apart.
 */
export const parseNumber = (
  input: string,
  locale: Locale,
  language: Locale = locale,
): NumberEntry => {
  const { decimal, group } = tableOf(locale);
  tableOf(language);
  const text = input.trim();
  if (text === "") return EMPTY;
  const problem = numberProblem(text, decimal, group);
  if (problem !== undefined)
    return numberRefusal(problem.code, locale, language, problem.character);
  const value = Number(text.replaceAll(group, "").replace(decimal, "."));
  if (!Number.isFinite(value)) return numberRefusal("too-large", locale, language);
  // Minus zero is zero: the two are one JSON number.
  return Object.freeze({ kind: "number", value: value === 0 ? 0 : value });
};

/** A number as the parser reads it back in `locale`: no grouping and no exponent, as in 1234,5. */
export const plainNumber = (value: number, locale: Locale): string => {
  const { decimal } = tableOf(locale);
  return plainText(value).replace(".", decimal);
};

/** The echo beside a number field: the value it holds, as in "= 1234.5" or "= 1234,5". */
export const numberEcho = (value: number, locale: Locale): string =>
  `= ${plainNumber(value, locale)}`;

const SLASHED = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NO_YEAR = /^\d{1,2}\/\d{1,2}$/;

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

const dateRefusal = (
  code: DateRefusalCode,
  locale: Locale,
  language: Locale,
  [year, month, day]: readonly number[] = [],
): DateEntry => {
  const slots = { locale, year: year ?? 0, month: month ?? 0, day: day ?? 0 };
  return Object.freeze({ kind: "refused", code, reason: dateRefusalText(code, language, slots) });
};

// Year, month and day as typed: month/day/year in en-US, day/month/year in it-IT, or year-month-day.
const typedParts = (entry: string, locale: Locale): readonly number[] | undefined => {
  const slashed = SLASHED.exec(entry);
  if (slashed !== null) {
    const [first, second, year] = slashed.slice(1).map(Number) as [number, number, number];
    return tableOf(locale).dayFirst ? [year, second, first] : [year, first, second];
  }
  return ISO_DATE.exec(entry)?.slice(1).map(Number);
};

/**
 * Reads a calendar date typed in `locale`: a `full-date`, an empty field, or a refusal in
 * `language`. The day and the month take one or two digits and the year four; year-month-day takes
 * exactly two for the month and the day. Surrounding spaces are ignored.
 */
export const parseDate = (input: string, locale: Locale, language: Locale = locale): DateEntry => {
  tableOf(locale);
  tableOf(language);
  const entry = input.trim();
  if (entry === "") return EMPTY;
  if (NO_YEAR.test(entry)) return dateRefusal("no-year", locale, language);
  const parts = typedParts(entry, locale);
  if (parts === undefined) return dateRefusal("format", locale, language);
  const [year = 0, month = 0, day = 0] = parts;
  if (month < 1 || month > 12) return dateRefusal("month", locale, language, parts);
  if (!isRealDay(year, month, day)) return dateRefusal("day", locale, language, parts);
  return Object.freeze({ kind: "date", date: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` });
};

/** The echo beside a date field: the weekday and the day, as in "= mer 9 dic 2026". */
export const dateEcho = (date: string, locale: Locale): string =>
  `= ${formatLongDate(date, locale)}`;
