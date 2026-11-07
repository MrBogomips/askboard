// AskBoard's own locale tables (settings-languages design decision 8, open questions A6 and A7):
// the separators, the month and weekday names and the patterns of en-US and it-IT, and the
// currencies' symbols and minor units. The formats read only these, never the runtime's locale.

import type { CalendarParts, ClockParts } from "./calendar.ts";

/** The locales AskBoard formats in, which are also the languages it speaks (FR-34). */
export const LOCALES = ["en-US", "it-IT"] as const;

export type Locale = (typeof LOCALES)[number];

/** The Gantt's zoom levels, each with its axis label. */
export type AxisZoom = "day" | "week" | "month";

export type LocaleTable = {
  readonly decimal: string;
  readonly group: string;
  /** Between a currency symbol and the amount; a code is always followed by a space. */
  readonly symbolGap: string;
  /** Full month names, January first, as a sentence spells them. */
  readonly months: readonly string[];
  /** Whether a typed date puts the day before the month, as in 9/12/2026 for December 9. */
  readonly dayFirst: boolean;
  readonly date: (parts: CalendarParts) => string;
  readonly longDate: (parts: CalendarParts) => string;
  /** The Gantt grid's date: the weekday and the day and month, the year only when asked. */
  readonly gridDate: (parts: CalendarParts, withYear: boolean) => string;
  /** The day and month alone. */
  readonly shortDate: (parts: CalendarParts) => string;
  readonly time: (parts: ClockParts) => string;
  readonly dateTime: (parts: ClockParts) => string;
  readonly axis: Readonly<Record<AxisZoom, (parts: CalendarParts) => string>>;
};

const twoDigits = (value: number): string => String(value).padStart(2, "0");
const yearOf = ({ year }: CalendarParts): string => String(year).padStart(4, "0");

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
const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const IT_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;
const IT_SHORT_MONTHS = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
] as const;
const IT_WEEKDAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"] as const;

const enMonth = ({ month }: CalendarParts): string => EN_MONTHS[month - 1]?.slice(0, 3) ?? "";
const enWeekday = ({ weekday }: CalendarParts): string => EN_WEEKDAYS[weekday] ?? "";
const enTime = ({ hour, minute }: ClockParts): string =>
  `${hour % 12 || 12}:${twoDigits(minute)} ${hour < 12 ? "AM" : "PM"}`;

const itMonth = ({ month }: CalendarParts): string => IT_SHORT_MONTHS[month - 1] ?? "";
const itWeekday = ({ weekday }: CalendarParts): string => IT_WEEKDAYS[weekday] ?? "";
const itTime = ({ hour, minute }: ClockParts): string => `${twoDigits(hour)}:${twoDigits(minute)}`;

const TABLES: Readonly<Record<Locale, LocaleTable>> = {
  "en-US": {
    decimal: ".",
    group: ",",
    symbolGap: "",
    months: EN_MONTHS,
    dayFirst: false,
    date: (p) => `${p.month}/${p.day}/${yearOf(p)}`,
    longDate: (p) => `${enWeekday(p)}, ${enMonth(p)} ${p.day}, ${yearOf(p)}`,
    gridDate: (p, withYear) =>
      `${enWeekday(p)} ${p.month}/${p.day}${withYear ? `/${yearOf(p)}` : ""}`,
    shortDate: (p) => `${p.month}/${p.day}`,
    time: enTime,
    dateTime: (p) => `${enMonth(p)} ${p.day}, ${yearOf(p)}, ${enTime(p)}`,
    axis: {
      day: (p) => `${enWeekday(p)} ${p.day}`,
      week: (p) => `${enMonth(p)} ${p.day}`,
      month: (p) => `${enMonth(p)} ${yearOf(p)}`,
    },
  },
  "it-IT": {
    decimal: ",",
    group: ".",
    symbolGap: " ",
    months: IT_MONTHS,
    dayFirst: true,
    date: (p) => `${twoDigits(p.day)}/${twoDigits(p.month)}/${yearOf(p)}`,
    longDate: (p) => `${itWeekday(p)} ${p.day} ${itMonth(p)} ${yearOf(p)}`,
    gridDate: (p, withYear) =>
      `${itWeekday(p)} ${p.day}/${p.month}${withYear ? `/${yearOf(p)}` : ""}`,
    shortDate: (p) => `${p.day}/${p.month}`,
    time: itTime,
    dateTime: (p) => `${p.day} ${itMonth(p)} ${yearOf(p)}, ${itTime(p)}`,
    axis: {
      day: (p) => `${itWeekday(p)} ${p.day}`,
      week: (p) => `${p.day} ${itMonth(p)}`,
      month: (p) => `${itMonth(p)} ${yearOf(p)}`,
    },
  },
};

/** A locale's table; a `RangeError` for a locale AskBoard does not format in. */
export const tableOf = (locale: Locale): LocaleTable => {
  if (!Object.hasOwn(TABLES, locale)) {
    throw new RangeError(`${JSON.stringify(locale)} is not one of ${LOCALES.join(", ")}`);
  }
  return TABLES[locale];
};

/** The symbols AskBoard writes; any other ISO 4217 code shows as the code. */
export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { EUR: "€", USD: "$", GBP: "£" };

/**
 * The minor units of the ISO 4217 currencies whose are not 2, which amounts follow: the amount
 * parser, the MoneyField's checks, the echo and the formatting (AD-13; atoms, review 2.3 and 4.4
 * S-3). Zero decimals: BIF, CLP, DJF, GNF, ISK, JPY, KMF, KRW, PYG, RWF, UGX, UYI, VND, VUV, XAF,
 * XOF and XPF. Three: BHD, IQD, JOD, KWD, LYD, OMR and TND. Four: CLF and UYW.
 */
export const MINOR_UNITS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
};

export const DEFAULT_MINOR_UNITS = 2;
