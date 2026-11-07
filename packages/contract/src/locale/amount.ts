// Amount entry in the ask's locale (atoms, design decision 2; EXPERIENCE, Input atoms): a
// MoneyField reads what the user typed for a currency and gets a decimal string with exactly the
// currency's minor units, which never passes through a binary float. The character, sign, mark
// and grouping rules are the number entry's; then the digits are split as text.
//
// Plain ECMAScript with no Ajv, so a view chunk may import it. Nothing here converts text to a
// numeric type: sums and bounds are compared as strings (`compareDecimal`).

import { type NumberEntry, numberProblem, numberRefusal } from "./entry.ts";
import { type AmountRefusalCode, amountRefusalText } from "./entry-texts.ts";
import { DEFAULT_MINOR_UNITS, type Locale, MINOR_UNITS, tableOf } from "./tables.ts";

/** The most digits before the decimal mark an amount holds. */
export const AMOUNT_MAX_INTEGER_DIGITS = 15;

/**
 * An amount as the schemas carry it (AD-7, Values): a decimal string of at most 15 integer digits
 * and 4 decimals, with no exponent, no leading zero and no plus sign. The currency's minor units
 * are a check, not the pattern's.
 */
export const AMOUNT_PATTERN = /^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$/;

export type { AmountRefusalCode } from "./entry-texts.ts";

export type AmountEntry =
  /** A decimal string with exactly the currency's minor units, as in `1234.50`. */
  | { readonly kind: "amount"; readonly amount: string }
  /** Nothing typed: the field is empty. */
  | { readonly kind: "empty" }
  | {
      readonly kind: "refused";
      readonly code: Extract<NumberEntry, { kind: "refused" }>["code"] | AmountRefusalCode;
      readonly reason: string;
    };

const EMPTY = Object.freeze({ kind: "empty" as const });

/** The decimals a currency takes: its entry in the minor units table, else two. */
export const minorUnitsOf = (currency: string): number =>
  Object.hasOwn(MINOR_UNITS, currency)
    ? (MINOR_UNITS[currency] ?? DEFAULT_MINOR_UNITS)
    : DEFAULT_MINOR_UNITS;

const refusal = (
  code: AmountRefusalCode,
  currency: string,
  locale: Locale,
  language: Locale,
): AmountEntry =>
  Object.freeze({
    kind: "refused",
    code,
    reason: amountRefusalText(code, language, {
      currency,
      places: minorUnitsOf(currency),
      decimal: tableOf(locale).decimal,
      digits: AMOUNT_MAX_INTEGER_DIGITS,
    }),
  });

/**
 * Reads an amount typed in `locale` for `currency`: a decimal string, an empty field, or a refusal
 * whose reason is in `language`, the ask's language (the locale's unless the ask sets them apart).
 * More decimals typed than the currency's minor units, even zeros, and more than 15 integer digits
 * are refused; minus zero is zero.
 */
export const parseAmount = (
  input: string,
  currency: string,
  locale: Locale,
  language: Locale = locale,
): AmountEntry => {
  const { decimal, group } = tableOf(locale);
  tableOf(language);
  const text = input.trim();
  if (text === "") return EMPTY;
  const problem = numberProblem(text, decimal, group);
  if (problem !== undefined) {
    const refused = numberRefusal(problem.code, locale, language, problem.character);
    return refused as AmountEntry;
  }
  const negative = text.startsWith("-");
  const [whole = "", fraction = ""] = text
    .replace(/^[+-]/, "")
    .replaceAll(group, "")
    .split(decimal);
  const places = minorUnitsOf(currency);
  if (fraction.length > places) return refusal("decimals", currency, locale, language);
  const integer = whole.replace(/^0+(?=[0-9])/, "");
  if (integer.length > AMOUNT_MAX_INTEGER_DIGITS) {
    return refusal("too-large", currency, locale, language);
  }
  const digits = `${integer}${fraction.padEnd(places, "0")}`;
  const zero = /^0*$/.test(digits);
  const point = places === 0 ? "" : `.${fraction.padEnd(places, "0")}`;
  return Object.freeze({
    kind: "amount",
    amount: `${negative && !zero ? "-" : ""}${integer}${point}`,
  });
};

/**
 * The echo beside a money field: the amount without grouping and with the currency's minor units,
 * in the locale's decimal mark, then the code, as in "= 1234,50 EUR".
 */
export const amountEcho = (amount: string, currency: string, locale: Locale): string => {
  const sign = amount.startsWith("-") ? "-" : "";
  const [whole = "0", fraction = ""] = amount.replace(/^-/, "").split(".");
  const places = minorUnitsOf(currency);
  const shown = fraction.length >= places ? fraction : fraction.padEnd(places, "0");
  const mark = shown === "" ? "" : tableOf(locale).decimal;
  return `= ${sign}${whole}${mark}${shown} ${currency}`;
};

// A decimal string split into its sign, its integer digits without leading zeros and its fraction
// without trailing zeros; zero has no sign.
const partsOf = (value: string): { sign: 1 | -1; whole: string; fraction: string } => {
  const negative = value.startsWith("-");
  const [whole = "", fraction = ""] = value.replace(/^[+-]/, "").split(".");
  const integer = whole.replace(/^0+/, "");
  const decimals = fraction.replace(/0+$/, "");
  const zero = integer === "" && decimals === "";
  return { sign: negative && !zero ? -1 : 1, whole: integer, fraction: decimals };
};

// -1, 0 or 1 for two digit strings of one length compared from the left, the fractions padded.
const compareText = (a: string, b: string): -1 | 0 | 1 => (a === b ? 0 : a < b ? -1 : 1);

/**
 * Compares two decimal strings as decimals, never as floats: -1, 0 or 1 as `a` is below, equal to
 * or above `b`. Meant for strings that passed the amount pattern; trailing zeros and a negative
 * zero do not matter.
 */
export const compareDecimal = (a: string, b: string): -1 | 0 | 1 => {
  const left = partsOf(a);
  const right = partsOf(b);
  const leftZero = left.whole === "" && left.fraction === "";
  const rightZero = right.whole === "" && right.fraction === "";
  if (leftZero && rightZero) return 0;
  if (left.sign !== right.sign) return left.sign < right.sign ? -1 : 1;
  const width = Math.max(left.fraction.length, right.fraction.length);
  const magnitude =
    left.whole.length === right.whole.length
      ? compareText(
          left.whole + left.fraction.padEnd(width, "0"),
          right.whole + right.fraction.padEnd(width, "0"),
        )
      : left.whole.length < right.whole.length
        ? -1
        : 1;
  if (magnitude === 0 || left.sign === 1) return magnitude;
  return magnitude === 1 ? -1 : 1;
};
