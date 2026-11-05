// The string catalogue of the view and the board page (settings-languages design decision 9, open
// question B9): `t` looks a string up in the ask's language and fills its slots as text, so a slot
// never becomes markup and is never read as a template itself (AD-8).

import type { Locale } from "@askboard/contract";
import { EN_US } from "./en-US.ts";
import { IT_IT } from "./it-IT.ts";
import type { StringKey, StringTable, Template } from "./keys.ts";

export type { StringKey, StringTable, Template } from "./keys.ts";
export { htmlLang, languageOf, localeOf } from "./language.ts";

/** One table per language AskBoard speaks. */
export const STRINGS: Readonly<Record<Locale, StringTable>> = { "en-US": EN_US, "it-IT": IT_IT };

/** A slot's value: text, or a number written as its digits; `count` picks a count form. */
export type Slots = Readonly<Record<string, string | number>>;

const SLOT = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** Fills a template's slots in one pass, so a value holding `{name}` stays as it is. */
export const fill = (template: Template, slots: Slots = {}): string => {
  let text: string;
  if (typeof template === "string") text = template;
  else {
    const { count } = slots;
    if (typeof count !== "number") throw new RangeError("a count form needs a number count");
    text = count === 1 ? template.one : template.other;
  }
  return text.replace(SLOT, (_, name: string) => {
    const value = Object.hasOwn(slots, name) ? slots[name] : undefined;
    if (value === undefined) throw new RangeError(`the slot "${name}" has no value`);
    return String(value);
  });
};

/** The string `key` in `language`, its slots filled. */
export const t = (language: Locale, key: StringKey, slots?: Slots): string => {
  if (!Object.hasOwn(STRINGS, language)) {
    throw new RangeError(`${JSON.stringify(language)} is not a language AskBoard speaks`);
  }
  return fill(STRINGS[language][key], slots);
};
