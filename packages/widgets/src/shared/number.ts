// AskBoard's number entry in the ask's locale (EXPERIENCE, Input atoms; settings-languages design
// decision 8): a widget reads a number typed in a text input, never the browser's number input, with
// an optional sign, digits grouped by threes with the locale's group mark, and an optional decimal
// part with its decimal mark. An ambiguous or malformed entry is refused with a reason in the ask's
// language, which the field error shows, and the parsed value is echoed. The rules and the texts are
// the contract's (`locale/entry.ts`), shared with every widget; this module keeps the Tree's and the
// Gantt's call shapes, with en-US when no locale is given.

import {
  numberEcho as echoNumber,
  type Locale,
  type NumberEntry,
  parseNumber as parseLocaleNumber,
  plainNumber,
} from "@askboard/contract";

export type { NumberEntry };

/** Reads an entry in `locale`: a number, an empty field, or a refusal with its reason in `language`. */
export const parseNumber = (
  input: string,
  locale: Locale = "en-US",
  language: Locale = locale,
): NumberEntry => parseLocaleNumber(input, locale, language);

/** A number as the parser reads it back: no grouping and no exponent, as in 1234.5 or 1234,5. */
export const formatNumber = (value: number, locale: Locale = "en-US"): string =>
  plainNumber(value, locale);

/** The echo beside a number field: the value it holds, as in "= 1234.5" or "= 1234,5". */
export const numberEcho = (value: number, locale: Locale = "en-US"): string =>
  echoNumber(value, locale);
