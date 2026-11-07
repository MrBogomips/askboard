// The Gantt's en-US lookup and date format, for tests and for callers with no language of their own;
// the model takes both as parameters, so that it names no runtime import of the catalogue.

import type { Locale } from "@askboard/contract";
import { say } from "@askboard/view/catalog";
import type { DateFormat } from "../shared/time/date.ts";
import type { Say } from "../shared/time/say.ts";

/** The catalogue's en-US strings. */
export const EN_US_SAY: Say = (key, slots) => say("en-US", key, slots);

/** Dates typed and shown in en-US, refused in en-US. */
export const EN_US_FORMAT: DateFormat = Object.freeze({
  locale: "en-US",
  language: "en-US",
  text: EN_US_SAY,
});

/** Dates typed and shown in `locale`, refused in `language`. */
export const formatFor = (locale: Locale, language: Locale): DateFormat =>
  Object.freeze({ locale, language, text: (key, slots) => say(language, key, slots) });
