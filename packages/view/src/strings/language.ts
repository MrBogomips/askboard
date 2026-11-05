// The board's language (settings-languages design decisions 7 and 9): the board document's,
// fixed when the ask was accepted, and the `lang` attribute it gives the board page and the view.
// Apart from the catalogue, so that `assemble` takes it without the string tables.

import type { Locale } from "@askboard/contract";

/** The board's language: its document's, en-US when it holds none (an earlier minor's) or none came. */
export const languageOf = (document: { readonly language?: Locale } | undefined): Locale =>
  document?.language ?? "en-US";

/** A language as a document's `lang` attribute: `en` or `it`. */
export const htmlLang = (language: Locale): "en" | "it" => (language === "it-IT" ? "it" : "en");

/** The board's locale, for the values it shows: its document's, else its language (decision 7). */
export const localeOf = (
  document: { readonly language?: Locale; readonly locale?: Locale } | undefined,
): Locale => document?.locale ?? languageOf(document);
