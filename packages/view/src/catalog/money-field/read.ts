// A MoneyField's amount read in the ask's locale for a currency (atoms, design decisions 2, 3 and 7;
// view-and-widgets spec: Number, amount and date entry in the fields, An entry blocks Answer): the
// contract's amount parser reads it as text, never through a float, `moneyFieldBound` names the
// bound it breaks, and the contract's check against the item's props has the last word. A readable
// amount before a currency is picked is an entry with "Pick a currency."; an amount in a currency is
// the item's result; an empty text is none. Plain functions, tested without a DOM.

import {
  amountEcho,
  ENTRY_MAX_CHARS,
  formatMoney,
  type Locale,
  type MoneyFieldProps,
  type MoneyFieldResult,
  moneyFieldBound,
  moneyFieldResultProblems,
  parseAmount,
  parseNumber,
  plainNumber,
} from "@askboard/contract";
import { cutCodePoints } from "../fields/text.ts";
import { say } from "../port.ts";

export type MoneyReading =
  | { readonly kind: "empty" }
  | { readonly kind: "value"; readonly result: MoneyFieldResult }
  | {
      readonly kind: "entry";
      /** The parser's reason, the bound broken or "Pick a currency.", in the ask's language. */
      readonly error: string;
      /** The amount the text reads as, with its currency: "= 1234,50 EUR". */
      readonly echo: string | undefined;
    };

const entry = (error: string, echo?: string): MoneyReading => ({ kind: "entry", error, echo });

/** What the text reads as in `currency`, against the item's props; with no currency, what it would. */
export const readMoney = (
  text: string,
  currency: string | undefined,
  props: MoneyFieldProps,
  locale: Locale,
  language: Locale,
): MoneyReading => {
  if (currency === undefined) {
    const read = parseNumber(text, locale, language);
    if (read.kind === "empty") return { kind: "empty" };
    return entry(read.kind === "refused" ? read.reason : say(language, "field.pickCurrency"));
  }
  const parsed = parseAmount(text, currency, locale, language);
  if (parsed.kind === "empty") return { kind: "empty" };
  if (parsed.kind === "refused") return entry(parsed.reason);
  const { amount } = parsed;
  const echo = amountEcho(amount, currency, locale);
  const bound = moneyFieldBound(amount, props);
  if (bound === "min") {
    return entry(
      say(language, "field.atLeast", { min: formatMoney(props.min ?? amount, currency, locale) }),
      echo,
    );
  }
  if (bound === "max") {
    return entry(
      say(language, "field.atMost", { max: formatMoney(props.max ?? amount, currency, locale) }),
      echo,
    );
  }
  const result = { amount, currency };
  // What is left for the contract to refuse is a currency the item does not offer.
  if (moneyFieldResultProblems(result, props).length > 0) {
    return entry(say(language, "field.pickCurrency"), echo);
  }
  return { kind: "value", result };
};

/** Where a change goes: a result into the draft, or an entry. */
export type MoneySinks = {
  readonly result: (result: MoneyFieldResult | undefined) => void;
  readonly entry: (entry: string | undefined) => void;
};

const apply = (reading: MoneyReading, text: string, put: MoneySinks): void => {
  if (reading.kind === "value") put.result(reading.result);
  else if (reading.kind === "empty") {
    put.result(undefined);
    put.entry(undefined);
  } else put.entry(text);
};

/**
 * A change of the text: cut at `ENTRY_MAX_CHARS` code points, read for the currency, and put into
 * the draft: an amount in a currency as the result (which takes the entry out), an empty text as
 * neither, anything else as the entry (which takes the result out).
 */
export const changeMoney = (
  typed: string,
  currency: string | undefined,
  props: MoneyFieldProps,
  locale: Locale,
  language: Locale,
  put: MoneySinks,
): void => {
  const text = cutCodePoints(typed, ENTRY_MAX_CHARS);
  apply(readMoney(text, currency, props, locale, language), text, put);
};

/**
 * The user picks a currency: the text the field shows is read again for it, so an amount waiting as an
 * entry becomes the result, and one the currency cannot take stays an entry. An empty text puts
 * nothing: a currency alone is no answer.
 */
export const pickCurrency = (
  currency: string,
  text: string,
  props: MoneyFieldProps,
  locale: Locale,
  language: Locale,
  put: MoneySinks,
): void => {
  const reading = readMoney(text, currency, props, locale, language);
  if (reading.kind !== "empty") apply(reading, text, put);
};

// The locale's decimal mark, read off the number entry's own writing of one half: `0.5` or `0,5`.
const decimalMark = (locale: Locale): string => plainNumber(0.5, locale).charAt(1);

const isAmount = (result: unknown): result is MoneyFieldResult =>
  typeof result === "object" &&
  result !== null &&
  "amount" in result &&
  typeof result.amount === "string" &&
  "currency" in result &&
  typeof result.currency === "string";

/**
 * The text the field shows: the entry while one is held, else the text as typed while it still reads
 * as the result's amount in its currency, else the amount with the locale's decimal mark; empty when
 * there is no result.
 */
export const shownMoney = ({
  entry: held,
  result,
  typed,
  locale,
}: {
  readonly entry: string | undefined;
  readonly result: unknown;
  readonly typed: string | undefined;
  readonly locale: Locale;
}): string => {
  if (held !== undefined) return held;
  if (!isAmount(result)) return "";
  if (typed !== undefined) {
    const read = parseAmount(typed, result.currency, locale);
    if (read.kind === "amount" && read.amount === result.amount) return typed;
  }
  return result.amount.replace(".", decimalMark(locale));
};

/** What the handlers need: the item's props, the locale and language, and where results go. */
export type MoneyHandling = {
  readonly props: MoneyFieldProps;
  readonly locale: Locale;
  readonly language: Locale;
  readonly put: MoneySinks;
  /** The currency the amount is read in: the item's, the result's or the one picked. */
  readonly currency: string | undefined;
  /** The text the field shows now, which a pick reads again. */
  readonly text: string;
  readonly remember: (text: string) => void;
  readonly picked: (currency: string) => void;
};

/** The handler of the field's typed text: it remembers the text, then changes the draft by it. */
export const moneyTextHandler =
  ({ props, locale, language, put, currency, remember }: MoneyHandling) =>
  (typed: string): void => {
    const text = cutCodePoints(typed, ENTRY_MAX_CHARS);
    remember(text);
    changeMoney(text, currency, props, locale, language, put);
  };

/**
 * The handler of the currency control: the pick is remembered (a currency alone is no answer, so it
 * is the component's, until an amount is read), then the text is read again for it. An empty value,
 * which a pressed item gives when it is pressed again, keeps the pick.
 */
export const moneyPickHandler =
  ({ props, locale, language, put, text, picked }: MoneyHandling) =>
  (code: string): void => {
    if (code === "") return;
    picked(code);
    pickCurrency(code, text, props, locale, language, put);
  };
