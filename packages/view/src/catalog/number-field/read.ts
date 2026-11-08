// A NumberField's text read in the ask's locale (atoms, design decision 3; view-and-widgets spec:
// Number, amount and date entry in the fields, An entry blocks Answer): the contract's parser reads
// it, the contract's check against the item's props decides whether the value stands, and the view's
// words say which bound a value broke. A value within bounds is the item's result, an empty text
// is none, anything else is an entry with its reason. Plain functions, tested without a DOM.

import {
  ATOM_NUMBER_BOUND,
  ENTRY_MAX_CHARS,
  formatNumber,
  type Locale,
  type NumberFieldProps,
  numberEcho,
  numberFieldBound,
  numberFieldResultProblems,
  numberFieldResultShape,
  parseNumber,
  plainNumber,
} from "@askboard/contract";
import { cutCodePoints } from "../fields/text.ts";
import { say } from "../port.ts";

export type NumberReading =
  | { readonly kind: "empty" }
  | { readonly kind: "value"; readonly value: number }
  | {
      readonly kind: "entry";
      /** The parser's reason, or the bound the value broke, in the ask's language. */
      readonly error: string;
      /** The value the text reads as, when it reads as one: "= 21". */
      readonly echo: string | undefined;
    };

// The words for the bound a value breaks: the contract's code (`numberFieldBound`) names it, in the
// order a user can act on them (a fraction where only whole numbers go, below the minimum, past the
// maximum, off the step), and this reader says it. A bound the item does not set is the contract's
// own, one quadrillion either way; props the code cannot read give the step's words, as before.
const boundError = (
  value: number,
  props: NumberFieldProps,
  locale: Locale,
  language: Locale,
): string => {
  switch (numberFieldBound(value, props)) {
    case "whole":
      return say(language, "field.whole");
    case "min":
      return say(language, "field.atLeast", {
        min: formatNumber(props.min ?? -ATOM_NUMBER_BOUND, locale),
      });
    case "max":
      return say(language, "field.atMost", {
        max: formatNumber(props.max ?? ATOM_NUMBER_BOUND, locale),
      });
    default:
      return say(language, "field.step", {
        step: formatNumber(props.step ?? 1, locale),
        base: formatNumber(props.min ?? 0, locale),
      });
  }
};

/** What the text reads as against the item's props: a result, none, or an entry with its error. */
export const readNumber = (
  text: string,
  props: NumberFieldProps,
  locale: Locale,
  language: Locale,
): NumberReading => {
  const parsed = parseNumber(text, locale, language);
  if (parsed.kind === "empty") return { kind: "empty" };
  if (parsed.kind === "refused") return { kind: "entry", error: parsed.reason, echo: undefined };
  if (
    numberFieldResultShape(parsed.value) &&
    numberFieldResultProblems(parsed.value, props).length === 0
  ) {
    return { kind: "value", value: parsed.value };
  }
  return {
    kind: "entry",
    error: boundError(parsed.value, props, locale, language),
    echo: numberEcho(parsed.value, locale),
  };
};

/** Where a change of the text goes: a result into the draft, or an entry. */
export type NumberSinks = {
  readonly result: (result: number | undefined) => void;
  readonly entry: (entry: string | undefined) => void;
};

/**
 * A change of the text: cut at `ENTRY_MAX_CHARS` code points, read, and put into the draft: a value
 * as the result (which takes the entry out), an empty text as neither, anything else as the entry
 * (which takes the result out), so that an item holds one or the other, never both.
 */
export const changeNumber = (
  typed: string,
  props: NumberFieldProps,
  locale: Locale,
  language: Locale,
  put: NumberSinks,
): void => {
  const text = cutCodePoints(typed, ENTRY_MAX_CHARS);
  const reading = readNumber(text, props, locale, language);
  if (reading.kind === "value") put.result(reading.value);
  else if (reading.kind === "empty") {
    put.result(undefined);
    put.entry(undefined);
  } else put.entry(text);
};

/**
 * The text the field shows: the entry while one is held, else the text as typed while it still reads
 * as the result (so a trailing zero is not lost mid-typing), else the result as the parser reads it
 * back; empty when there is none.
 */
export const shownNumber = ({
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
  if (typeof result !== "number") return "";
  if (typed !== undefined) {
    const read = parseNumber(typed, locale);
    if (read.kind === "number" && read.value === result) return typed;
  }
  return plainNumber(result, locale);
};

/** What a text handler needs: the item's props, the locale and language, and where results go. */
export type NumberHandling = {
  readonly props: NumberFieldProps;
  readonly locale: Locale;
  readonly language: Locale;
  readonly put: NumberSinks;
  /** Remembers the text as typed, so that `shownNumber` can keep it while it still reads as the result. */
  readonly remember: (text: string) => void;
};

/** The handler of the field's typed text: it remembers the text, then changes the draft by it. */
export const numberTextHandler =
  ({ props, locale, language, put, remember }: NumberHandling) =>
  (typed: string): void => {
    const text = cutCodePoints(typed, ENTRY_MAX_CHARS);
    remember(text);
    changeNumber(text, props, locale, language, put);
  };
