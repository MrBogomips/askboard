// A Table cell's text read in the ask's locale (table-widget, design decision 3; view-and-widgets
// spec: Editing a cell, Cell entries block "Answer"): the contract's parsers read the text, the
// contract's one cell check (`tableCellProblems`, the verdict the agent's props, `ask-core` and this
// reader share, AD-10) decides whether the value stands, and the bound codes of the input atoms
// (`numberFieldBound`, `moneyFieldBound`, `dateFieldBound`) say which bound it broke, in the atoms'
// own words and string keys. A value is the cell's value, an empty text empties it, anything else is
// an entry with its error and, when the text reads as a value, its echo. Plain functions.

import {
  ATOM_NUMBER_BOUND,
  amountEcho,
  dateEcho,
  dateFieldBound,
  ENTRY_MAX_CHARS,
  formatDate,
  formatMoney,
  formatNumber,
  GANTT_FIRST_DATE,
  GANTT_LAST_DATE,
  type Locale,
  moneyFieldBound,
  numberEcho,
  numberFieldBound,
  parseAmount,
  parseDate,
  parseNumber,
  TABLE_TEXT_MAX_CHARS,
  type TableCellValue,
  type TableColumn,
  tableCellProblems,
} from "@askboard/contract";
import { say } from "@askboard/view/catalog";
import { cutCodePoints } from "./text.ts";

export type CellReading =
  | { readonly kind: "empty" }
  | { readonly kind: "value"; readonly value: TableCellValue }
  | {
      readonly kind: "entry";
      /** The text kept as the cell's entry: at most `ENTRY_MAX_CHARS` code points. */
      readonly text: string;
      /** The parser's reason or the bound the value broke, in the ask's language. */
      readonly error: string;
      /** The value the text reads as, when it does: "= 960,00 USD". */
      readonly echo: string | undefined;
    };

const entry = (text: string, error: string, echo?: string): CellReading =>
  Object.freeze({ kind: "entry", text: cutCodePoints(text, ENTRY_MAX_CHARS), error, echo });

// The keys the column's input atom takes, so that the atom's bound code reads the column as it reads
// its own props.
const ATOM_PROPS = ["min", "max", "step", "integer", "currency"] as const;

const propsOf = (column: TableColumn): Record<string, unknown> =>
  Object.fromEntries(
    ATOM_PROPS.filter((key) => column[key] !== undefined).map((key) => [key, column[key]]),
  );

const numberError = (value: number, column: TableColumn, locale: Locale, language: Locale) => {
  switch (numberFieldBound(value, { label: column.label, ...propsOf(column) })) {
    case "whole":
      return say(language, "field.whole");
    case "min":
      return say(language, "field.atLeast", {
        min: formatNumber(Number(column.min ?? -ATOM_NUMBER_BOUND), locale),
      });
    case "max":
      return say(language, "field.atMost", {
        max: formatNumber(Number(column.max ?? ATOM_NUMBER_BOUND), locale),
      });
    default:
      return say(language, "field.step", {
        step: formatNumber(column.step ?? 1, locale),
        base: formatNumber(typeof column.min === "number" ? column.min : 0, locale),
      });
  }
};

const readNumber = (
  text: string,
  column: TableColumn,
  locale: Locale,
  language: Locale,
): CellReading => {
  const parsed = parseNumber(text, locale, language);
  if (parsed.kind === "empty") return { kind: "empty" };
  if (parsed.kind === "refused") return entry(text, parsed.reason);
  if (tableCellProblems(parsed.value, column).length === 0) {
    return { kind: "value", value: parsed.value };
  }
  return entry(
    text,
    numberError(parsed.value, column, locale, language),
    numberEcho(parsed.value, locale),
  );
};

const readMoney = (
  text: string,
  column: TableColumn,
  locale: Locale,
  language: Locale,
): CellReading => {
  const currency = column.currency ?? "";
  const parsed = parseAmount(text, currency, locale, language);
  if (parsed.kind === "empty") return { kind: "empty" };
  if (parsed.kind === "refused") return entry(text, parsed.reason);
  const { amount } = parsed;
  if (tableCellProblems(amount, column).length === 0) return { kind: "value", value: amount };
  const echo = amountEcho(amount, currency, locale);
  const bound = moneyFieldBound(amount, { label: column.label, ...propsOf(column) });
  if (bound === "max") {
    return entry(
      text,
      say(language, "field.atMost", { max: formatMoney(String(column.max), currency, locale) }),
      echo,
    );
  }
  return entry(
    text,
    say(language, "field.atLeast", {
      min: formatMoney(String(column.min ?? amount), currency, locale),
    }),
    echo,
  );
};

const readDate = (
  text: string,
  column: TableColumn,
  locale: Locale,
  language: Locale,
): CellReading => {
  const parsed = parseDate(text, locale, language);
  if (parsed.kind === "empty") return { kind: "empty" };
  if (parsed.kind === "refused") return entry(text, parsed.reason);
  const { date } = parsed;
  if (tableCellProblems(date, column).length === 0) return { kind: "value", value: date };
  // A day before the range is before `min`, or, with none, before the Gantt's first day.
  const bound = dateFieldBound(date, { label: column.label, ...propsOf(column) });
  const before = bound === "min" || (bound === undefined && date < GANTT_FIRST_DATE);
  const error = before
    ? say(language, "field.onOrAfter", {
        date: formatDate(String(column.min ?? GANTT_FIRST_DATE), locale),
      })
    : say(language, "field.onOrBefore", {
        date: formatDate(String(column.max ?? GANTT_LAST_DATE), locale),
      });
  return entry(text, error, dateEcho(date, locale));
};

const readText = (text: string, column: TableColumn, language: Locale): CellReading => {
  if (text === "") return { kind: "empty" };
  if (tableCellProblems(text, column).length === 0) return { kind: "value", value: text };
  const max = Math.min(column.maxLength ?? TABLE_TEXT_MAX_CHARS, TABLE_TEXT_MAX_CHARS);
  return entry(text, say(language, "tree.entry.textTooLong", { max }));
};

/**
 * What the text reads as in the column, in the ask's locale: its value, none (an empty text empties
 * the cell), or an entry. A number, money or date is read from the first `ENTRY_MAX_CHARS` code
 * points; a text is read whole, up to the column's limit. A toggle takes no text, has no editor
 * and holds no entry: whatever text reaches it reads as none (design decision 10).
 */
export const readCell = (
  typed: string,
  column: TableColumn,
  locale: Locale,
  language: Locale,
): CellReading => {
  switch (column.type) {
    case "text":
      return readText(typed, column, language);
    case "number":
      return readNumber(cutCodePoints(typed, ENTRY_MAX_CHARS), column, locale, language);
    case "money":
      return readMoney(cutCodePoints(typed, ENTRY_MAX_CHARS), column, locale, language);
    case "date":
      return readDate(cutCodePoints(typed, ENTRY_MAX_CHARS), column, locale, language);
    case "toggle":
      return { kind: "empty" };
  }
};

/**
 * The echo of what the typed text reads as, while the editor is open ("= 960,00 USD"): the value's
 * own echo, or the one an entry carries; none for a text, a toggle or a text no value is read from.
 */
export const cellEcho = (
  reading: CellReading,
  column: TableColumn,
  locale: Locale,
): string | undefined => {
  if (reading.kind === "entry") return reading.echo;
  if (reading.kind !== "value") return undefined;
  const { value } = reading;
  switch (column.type) {
    case "number":
      return typeof value === "number" ? numberEcho(value, locale) : undefined;
    case "money":
      return typeof value === "string" && column.currency !== undefined
        ? amountEcho(value, column.currency, locale)
        : undefined;
    case "date":
      return typeof value === "string" ? dateEcho(value, locale) : undefined;
    default:
      return undefined;
  }
};
