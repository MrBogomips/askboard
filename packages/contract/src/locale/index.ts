// AskBoard's own formats in en-US and it-IT (settings-languages design decision 8, open question
// A6): tables and pure functions in `contract`, which `view` and `widgets` both import (AD-1).
// Nothing goes through the runtime's formatting API, locale or time zone (AD-13).

export {
  formatAxisLabel,
  formatDate,
  formatDateTime,
  formatGridDate,
  formatLongDate,
  formatShortDate,
  formatTime,
} from "./dates.ts";
export {
  type DateEntry,
  type DateRefusalCode,
  dateEcho,
  type NumberEntry,
  type NumberRefusalCode,
  numberEcho,
  parseDate,
  parseNumber,
  plainNumber,
} from "./entry.ts";
export { type BoardLanguage, languageOf } from "./language-of.ts";
export { type FractionDigits, formatMoney, formatNumber, formatPercent } from "./numbers.ts";
export { type AxisZoom, LOCALES, type Locale, type LocaleTable, tableOf } from "./tables.ts";

// The amount entry (atoms, design decision 2): the MoneyField's parser, echo and comparison.

export {
  AMOUNT_MAX_INTEGER_DIGITS,
  AMOUNT_PATTERN,
  type AmountEntry,
  type AmountRefusalCode,
  amountEcho,
  compareDecimal,
  minorUnitsOf,
  parseAmount,
} from "./amount.ts";
