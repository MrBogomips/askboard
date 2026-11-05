// Numbers, money and percentages in a locale (settings-languages design decision 8): the value is
// read as decimal digits, rounded on those digits half away from zero, grouped by threes and
// written with the locale's marks. Money arrives as a decimal string (AD-7) and is rounded only
// for display, to its currency's minor unit (AD-13).

import {
  CURRENCY_SYMBOLS,
  DEFAULT_MINOR_UNITS,
  type Locale,
  type LocaleTable,
  MINOR_UNITS,
  tableOf,
} from "./tables.ts";

/** How many fraction digits to show: at least `minFraction`, rounding beyond `maxFraction`. */
export type FractionDigits = { readonly minFraction?: number; readonly maxFraction?: number };

/** A value's decimal digits: `whole` has no leading zero but "0", `fraction` may be empty. */
type Digits = { readonly negative: boolean; readonly whole: string; readonly fraction: string };

const SCIENTIFIC = /^(-?)([0-9])(?:\.([0-9]+))?e([+-][0-9]+)$/;
const DECIMAL = /^(-?)([0-9]+)(?:\.([0-9]+))?$/;
const CURRENCY = /^[A-Z]{3}$/;
const MAX_FRACTION = 100;

/** A finite number as the shortest decimal that reads back as it, with no exponent: 1234.5. */
export const plainText = (value: number): string => {
  if (!Number.isFinite(value)) throw new RangeError(`${value} is not a finite number`);
  const text = String(value);
  const scientific = SCIENTIFIC.exec(text);
  if (scientific === null) return text;
  const [, sign = "", first = "", rest = "", exponent = "0"] = scientific;
  const digits = `${first}${rest}`;
  const point = 1 + Number(exponent);
  // `String` writes an exponent only from 1e21 up and below 1e-6: the point is outside the digits.
  return point <= 0
    ? `${sign}0.${"0".repeat(-point)}${digits}`
    : `${sign}${digits}${"0".repeat(point - digits.length)}`;
};

const digitsOfText = (text: string): Digits | undefined => {
  const match = DECIMAL.exec(text);
  if (match === null) return undefined;
  const [, sign, whole = "", fraction = ""] = match;
  return { negative: sign === "-", whole: whole.replace(/^0+(?=[0-9])/, ""), fraction };
};

const digitsOfNumber = (value: number): Digits => digitsOfText(plainText(value)) as Digits;

// Adds one to a string of decimal digits.
const increment = (digits: string): string => {
  const chars = [...digits];
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    if (chars[index] !== "9") {
      chars[index] = String(Number(chars[index]) + 1);
      return chars.join("");
    }
    chars[index] = "0";
  }
  return `1${chars.join("")}`;
};

/** Rounds to `places` fraction digits, half away from zero, on the digits themselves. */
const roundTo = (value: Digits, places: number | undefined): Digits => {
  if (places === undefined || value.fraction.length <= places) return value;
  const kept = `${value.whole}${value.fraction.slice(0, places)}`;
  const rounded = (value.fraction[places] ?? "0") >= "5" ? increment(kept) : kept;
  const split = rounded.length - places;
  return {
    negative: value.negative,
    whole: rounded.slice(0, split).replace(/^0+(?=[0-9])/, ""),
    fraction: rounded.slice(split),
  };
};

/** Multiplies by 100 by moving the point: a percentage, with no binary rounding error. */
const hundredfold = ({ negative, whole, fraction }: Digits): Digits => {
  const padded = fraction.padEnd(2, "0");
  return {
    negative,
    whole: `${whole}${padded.slice(0, 2)}`.replace(/^0+(?=[0-9])/, ""),
    fraction: padded.slice(2),
  };
};

const checkFraction = ({ minFraction = 0, maxFraction }: FractionDigits): void => {
  const valid = (count: number) => Number.isInteger(count) && count >= 0 && count <= MAX_FRACTION;
  const ordered = maxFraction === undefined || minFraction <= maxFraction;
  if (!valid(minFraction) || (maxFraction !== undefined && !valid(maxFraction)) || !ordered) {
    throw new RangeError(`fraction digits ${minFraction} to ${maxFraction} are out of range`);
  }
};

/** The unsigned text, grouped, with at least `minFraction` fraction digits and no trailing zero. */
const unsignedText = ({ whole, fraction }: Digits, table: LocaleTable, minFraction: number) => {
  const grouped = whole.replace(/\B(?=([0-9]{3})+$)/g, table.group);
  const shown = fraction.replace(/0+$/, "").padEnd(minFraction, "0");
  return shown === "" ? grouped : `${grouped}${table.decimal}${shown}`;
};

// A value that rounds to zero shows no sign.
const signOf = ({ negative, whole, fraction }: Digits): string =>
  negative && /[1-9]/.test(`${whole}${fraction}`) ? "-" : "";

const formatDigits = (value: Digits, locale: Locale, options: FractionDigits): string => {
  const table = tableOf(locale);
  checkFraction(options);
  const rounded = roundTo(value, options.maxFraction);
  return `${signOf(rounded)}${unsignedText(rounded, table, options.minFraction ?? 0)}`;
};

/**
 * A number in a locale: `1,234.5` in en-US, `1.234,5` in it-IT. Every digit of the shortest decimal
 * shows unless `maxFraction` rounds it.
 */
export const formatNumber = (value: number, locale: Locale, options: FractionDigits = {}): string =>
  formatDigits(digitsOfNumber(value), locale, options);

/** A ratio as a percentage: 0.185 is `18.5%` in en-US and `18,5%` in it-IT. */
export const formatPercent = (
  ratio: number,
  locale: Locale,
  options: FractionDigits = {},
): string => `${formatDigits(hundredfold(digitsOfNumber(ratio)), locale, options)}%`;

/**
 * An amount, a decimal string as AD-7 carries it, in an ISO 4217 currency: `€12,480.00` in en-US
 * and `€ 12.480,00` in it-IT; a currency with no symbol in the table shows as its code.
 */
export const formatMoney = (amount: string, currency: string, locale: Locale): string => {
  const table = tableOf(locale);
  if (!CURRENCY.test(currency)) {
    throw new RangeError(`${JSON.stringify(currency)} is not an ISO 4217 code`);
  }
  const value = digitsOfText(amount);
  if (value === undefined)
    throw new RangeError(`${JSON.stringify(amount)} is not a decimal string`);
  const minor = Object.hasOwn(MINOR_UNITS, currency) ? MINOR_UNITS[currency] : DEFAULT_MINOR_UNITS;
  const rounded = roundTo(value, minor);
  const symbol = Object.hasOwn(CURRENCY_SYMBOLS, currency) ? CURRENCY_SYMBOLS[currency] : undefined;
  const mark = symbol === undefined ? `${currency} ` : `${symbol}${table.symbolGap}`;
  return `${signOf(rounded)}${mark}${unsignedText(rounded, table, minor ?? DEFAULT_MINOR_UNITS)}`;
};
