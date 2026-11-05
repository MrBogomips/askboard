// The ask's language and locale (settings-languages design decision 7): fixed when the ask is
// created, from the ask, else the default language in effect, the locale following the language,
// and kept for the whole ask (FR-34, AD-7).

import type { BoardLanguage, LifecycleAskInput } from "@askboard/contract";

/** The ask's language, else `defaultLanguage`; its locale, else that language. */
export const askLanguage = (
  input: Pick<LifecycleAskInput, "language" | "locale">,
  defaultLanguage: BoardLanguage["language"],
): BoardLanguage => {
  const language = input.language ?? defaultLanguage;
  return { language, locale: input.locale ?? language };
};
