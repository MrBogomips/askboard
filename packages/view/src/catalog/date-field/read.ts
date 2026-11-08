// A DateField's text read in the ask's locale (atoms, design decision 3; view-and-widgets spec:
// Number, amount and date entry in the fields, An entry blocks Answer): the contract's parser reads
// it, the contract's check against the item's props decides whether the day stands, and the view's
// words say which end of the range it broke. A date within the range is the item's result, an empty
// text is none, anything else is an entry with its reason. Plain functions, tested without a DOM.

import {
  type DateFieldProps,
  dateEcho,
  dateFieldBound,
  dateFieldResultProblems,
  dateFieldResultShape,
  ENTRY_MAX_CHARS,
  formatDate,
  GANTT_FIRST_DATE,
  type Locale,
  parseDate,
} from "@askboard/contract";
import { cutCodePoints } from "../fields/text.ts";
import { say } from "../port.ts";
import { rangeOf } from "./calendar.ts";

export type DateReading =
  | { readonly kind: "empty" }
  | { readonly kind: "value"; readonly date: string }
  | {
      readonly kind: "entry";
      /** The parser's reason, or the end of the range the day broke, in the ask's language. */
      readonly error: string;
      /** The day the text reads as, when it reads as one: "= Wed, Dec 9, 2026". */
      readonly echo: string | undefined;
    };

/** What the text reads as against the item's props: a result, none, or an entry with its error. */
export const readDate = (
  text: string,
  props: DateFieldProps,
  locale: Locale,
  language: Locale,
): DateReading => {
  const parsed = parseDate(text, locale, language);
  if (parsed.kind === "empty") return { kind: "empty" };
  if (parsed.kind === "refused") return { kind: "entry", error: parsed.reason, echo: undefined };
  const { date } = parsed;
  if (dateFieldResultShape(date) && dateFieldResultProblems(date, props).length === 0) {
    return { kind: "value", date };
  }
  // A day before the range is before `min`, or, with none, before the Gantt's first day.
  const bound = dateFieldBound(date, props);
  const before = bound === "min" || (bound === undefined && date < GANTT_FIRST_DATE);
  const { first, last } = rangeOf(props);
  const error = before
    ? say(language, "field.onOrAfter", { date: formatDate(first, locale) })
    : say(language, "field.onOrBefore", { date: formatDate(last, locale) });
  return { kind: "entry", error, echo: dateEcho(date, locale) };
};

/** Where a change of the text goes: a result into the draft, or an entry. */
export type DateSinks = {
  readonly result: (result: string | undefined) => void;
  readonly entry: (entry: string | undefined) => void;
};

/**
 * A change of the text: cut at `ENTRY_MAX_CHARS` code points, read, and put into the draft: a date as
 * the result (which takes the entry out), an empty text as neither, anything else as the entry
 * (which takes the result out), so that an item holds one or the other, never both.
 */
export const changeDate = (
  typed: string,
  props: DateFieldProps,
  locale: Locale,
  language: Locale,
  put: DateSinks,
): void => {
  const text = cutCodePoints(typed, ENTRY_MAX_CHARS);
  const reading = readDate(text, props, locale, language);
  if (reading.kind === "value") put.result(reading.date);
  else if (reading.kind === "empty") {
    put.result(undefined);
    put.entry(undefined);
  } else put.entry(text);
};

/** What a text handler needs: the item's props, the locale and language, and where results go. */
export type DateHandling = {
  readonly props: DateFieldProps;
  readonly locale: Locale;
  readonly language: Locale;
  readonly put: DateSinks;
  /** Remembers the text as typed, so that `shownDate` can keep it while it still reads as the result. */
  readonly remember: (text: string) => void;
};

/** The handler of the field's typed text: it remembers the text, then changes the draft by it. */
export const dateTextHandler =
  ({ props, locale, language, put, remember }: DateHandling) =>
  (typed: string): void => {
    const text = cutCodePoints(typed, ENTRY_MAX_CHARS);
    remember(text);
    changeDate(text, props, locale, language, put);
  };

/**
 * The text the field shows: the entry while one is held, else the text as typed while it still reads
 * as the result, else the result written in the locale's own form; empty when there is none.
 */
export const shownDate = ({
  entry,
  result,
  typed,
  locale,
}: {
  readonly entry: string | undefined;
  readonly result: unknown;
  readonly typed: string | undefined;
  readonly locale: Locale;
}): string => {
  if (entry !== undefined) return entry;
  if (typeof result !== "string" || !dateFieldResultShape(result)) return "";
  if (typed !== undefined) {
    const read = parseDate(typed, locale);
    if (read.kind === "date" && read.date === result) return typed;
  }
  return formatDate(result, locale);
};
