// What a refused entry says (settings-languages design decision 8): in the ask's language, with
// the marks, the order and the example of the ask's locale, which may differ. The en-US sentences
// in en-US are word for word the Tree's (tree-widget, `widgets/src/shared/number.ts`) and the
// Gantt's (gantt-widget, `gantt/model/date.ts`). The Italian ones are provisional (UX draft block 1).

import type { Locale } from "./tables.ts";

export type NumberRefusalCode =
  | "exponent"
  | "character"
  | "sign"
  | "no-digits"
  | "decimal-marks"
  | "decimal-sides"
  | "grouping"
  | "too-large";

export type DateRefusalCode = "format" | "no-year" | "month" | "day";

/** What a number refusal's sentence reads from the locale: its marks and examples. */
type NumberSlots = {
  /** The locale's decimal mark, `.` or `,`. */
  readonly decimal: string;
  /** A grouped example with a decimal part, as in 1,234.5. */
  readonly example: string;
  /** A half, as in 0.5. */
  readonly half: string;
  /** The character an entry may not hold, for `character`. */
  readonly character: string;
};

/** What a date refusal's sentence reads: the locale's order and example, and the day typed. */
type DateSlots = {
  readonly locale: Locale;
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

type NumberTexts = Readonly<Record<NumberRefusalCode, (slots: NumberSlots) => string>>;
type DateTexts = Readonly<Record<DateRefusalCode, (slots: DateSlots) => string>>;

const EXAMPLE_DATES: Readonly<Record<Locale, string>> = {
  "en-US": "12/9/2026",
  "it-IT": "9/12/2026",
};

const EN_ORDER: Readonly<Record<Locale, string>> = {
  "en-US": "month/day/year",
  "it-IT": "day/month/year",
};

const IT_ORDER: Readonly<Record<Locale, string>> = {
  "en-US": "mese/giorno/anno",
  "it-IT": "giorno/mese/anno",
};

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const IT_MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

const enPoint = ({ decimal }: NumberSlots) => (decimal === "." ? "point" : "comma");
const itPoint = ({ decimal }: NumberSlots) =>
  decimal === "." ? "il punto decimale" : "la virgola decimale";

const NUMBER_TEXTS: Readonly<Record<Locale, NumberTexts>> = {
  "en-US": {
    exponent: () => "Write the number in full, without an exponent.",
    character: (s) => `"${s.character}" is not part of a number: use digits, as in ${s.example}.`,
    sign: () => "Put at most one sign, before the digits.",
    "no-digits": (s) => `Type digits, as in ${s.example}.`,
    "decimal-marks": (s) => `Use one decimal ${enPoint(s)} at most.`,
    "decimal-sides": (s) =>
      `Put digits on both sides of the decimal ${enPoint(s)}, as in ${s.half}.`,
    grouping: (s) =>
      `Use ${s.decimal === "." ? "commas" : "periods"} only between groups of three digits, as in ${s.example}.`,
    "too-large": () => "The number is too large.",
  },
  "it-IT": {
    exponent: () => "Scrivi il numero per intero, senza esponente.",
    character: (s) =>
      `"${s.character}" non fa parte di un numero: usa le cifre, come in ${s.example}.`,
    sign: () => "Metti al massimo un segno, prima delle cifre.",
    "no-digits": (s) => `Scrivi delle cifre, come in ${s.example}.`,
    "decimal-marks": (s) =>
      `Usa al massimo ${s.decimal === "." ? "un punto decimale" : "una virgola decimale"}.`,
    "decimal-sides": (s) => `Metti delle cifre prima e dopo ${itPoint(s)}, come in ${s.half}.`,
    grouping: (s) =>
      `Usa ${s.decimal === "." ? "le virgole" : "i punti"} solo tra gruppi di tre cifre, come in ${s.example}.`,
    "too-large": () => "Il numero è troppo grande.",
  },
};

const DATE_TEXTS: Readonly<Record<Locale, DateTexts>> = {
  "en-US": {
    format: (s) => `Write the date as ${EN_ORDER[s.locale]}, as in ${EXAMPLE_DATES[s.locale]}`,
    "no-year": (s) => `Write the year too: ${EN_ORDER[s.locale]}, as in ${EXAMPLE_DATES[s.locale]}`,
    month: (s) =>
      `${s.month} is not a month: write ${EN_ORDER[s.locale]}, as in ${EXAMPLE_DATES[s.locale]}`,
    day: (s) => `${EN_MONTHS[s.month - 1]} ${s.year} has no day ${s.day}`,
  },
  "it-IT": {
    format: (s) => `Scrivi la data come ${IT_ORDER[s.locale]}, come in ${EXAMPLE_DATES[s.locale]}`,
    "no-year": (s) =>
      `Scrivi anche l'anno: ${IT_ORDER[s.locale]}, come in ${EXAMPLE_DATES[s.locale]}`,
    month: (s) =>
      `${s.month} non è un mese: scrivi ${IT_ORDER[s.locale]}, come in ${EXAMPLE_DATES[s.locale]}`,
    day: (s) => `${IT_MONTHS[s.month - 1]} ${s.year} non ha il giorno ${s.day}`,
  },
};

export const numberRefusalText = (
  code: NumberRefusalCode,
  language: Locale,
  slots: NumberSlots,
): string => NUMBER_TEXTS[language][code](slots);

export const dateRefusalText = (
  code: DateRefusalCode,
  language: Locale,
  slots: DateSlots,
): string => DATE_TEXTS[language][code](slots);
