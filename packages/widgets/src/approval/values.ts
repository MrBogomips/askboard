// A value in the Approval's summary (view-and-widgets spec: The Approval summary; design decision
// 8): numbers, money, full-dates, booleans and nothing in the ask's locale with the contract's
// formatters, anything else as JSON, cut at 80 characters with "…". Pure: the words for on, off
// and nothing come from the caller, who takes them from the view's string tables.

import { formatDate, formatMoney, formatNumber, type Locale } from "@askboard/contract";

/** A value is cut at this many characters. */
export const SUMMARY_VALUE_MAX_CHARS = 80;

/** The words a boolean and an empty value show as. */
export type ValueWords = {
  readonly on: string;
  readonly off: string;
  readonly none: string;
};

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Cut by code point, so that a pair of surrogates is never split.
const cut = (text: string): string => {
  const points = Array.from(text);
  return points.length <= SUMMARY_VALUE_MAX_CHARS
    ? text
    : `${points.slice(0, SUMMARY_VALUE_MAX_CHARS).join("")}…`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The formatter's text, or undefined when it refuses the value: a summary never throws on content.
const attempt = (format: () => string): string | undefined => {
  try {
    return format();
  } catch {
    return undefined;
  }
};

const moneyOf = (value: Record<string, unknown>, locale: Locale): string | undefined =>
  typeof value.amount === "string" && typeof value.currency === "string"
    ? attempt(() => formatMoney(value.amount as string, value.currency as string, locale))
    : undefined;

/** `value` as the summary shows it in `locale`. */
export const formatValue = (value: unknown, locale: Locale, words: ValueWords): string => {
  if (value === null || value === undefined) return words.none;
  if (typeof value === "boolean") return value ? words.on : words.off;
  if (typeof value === "number") return attempt(() => formatNumber(value, locale)) ?? String(value);
  if (typeof value === "string") {
    const date = FULL_DATE.test(value) ? attempt(() => formatDate(value, locale)) : undefined;
    return date ?? cut(value);
  }
  const money = isRecord(value) ? moneyOf(value, locale) : undefined;
  return money ?? cut(JSON.stringify(value) ?? words.none);
};
