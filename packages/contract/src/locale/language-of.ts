// The language and locale a board shows (settings-languages design decision 7): ask-core writes
// both into every revision's board document; a document without them, of an earlier minor or an
// older Snapshot, reads as en-US (AD-12, FR-34).

import type { Locale } from "./tables.ts";

export type BoardLanguage = { readonly language: Locale; readonly locale: Locale };

/** A board document's language and locale; the locale follows the language when it is absent. */
export const languageOf = (document: {
  readonly language?: Locale;
  readonly locale?: Locale;
}): BoardLanguage => {
  const language = document.language ?? "en-US";
  return { language, locale: document.locale ?? language };
};
