// The locale fixtures (settings-languages design decision 8): each case formats one value in both
// locales, with the text each must give. The formats test checks them here; the determinism test
// re-runs them in subprocesses under other time zones and runtime locales (AD-13).

import {
  formatAxisLabel,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatTime,
  type Locale,
} from "../../src/index.ts";

export type FormatCase = {
  readonly name: string;
  readonly format: (locale: Locale) => string;
  readonly "en-US": string;
  readonly "it-IT": string;
};

const row = (
  name: string,
  format: (locale: Locale) => string,
  enUS: string,
  itIT: string,
): FormatCase => ({ name, format, "en-US": enUS, "it-IT": itIT });

// Design decision 8's table, row by row.
const TABLE: readonly FormatCase[] = [
  row("number", (l) => formatNumber(1234.5, l), "1,234.5", "1.234,5"),
  row("money EUR", (l) => formatMoney("12480", "EUR", l), "€12,480.00", "€ 12.480,00"),
  row("money USD", (l) => formatMoney("12480", "USD", l), "$12,480.00", "$ 12.480,00"),
  row("other currency", (l) => formatMoney("12480", "CHF", l), "CHF 12,480.00", "CHF 12.480,00"),
  row("percent", (l) => formatPercent(0.185, l), "18.5%", "18,5%"),
  row("date", (l) => formatDate("2026-10-27", l), "10/27/2026", "27/10/2026"),
  row("long date", (l) => formatLongDate("2026-10-27", l), "Tue, Oct 27, 2026", "mar 27 ott 2026"),
  row("time", (l) => formatTime("2026-10-28T15:12:00Z", 60, l), "4:12 PM", "16:12"),
  row(
    "date and time",
    (l) => formatDateTime("2026-10-28T15:12:00Z", 60, l),
    "Oct 28, 2026, 4:12 PM",
    "28 ott 2026, 16:12",
  ),
  row("axis day", (l) => formatAxisLabel("2026-11-02", "day", l), "Mon 2", "lun 2"),
  row("axis week", (l) => formatAxisLabel("2026-11-02", "week", l), "Nov 2", "2 nov"),
  row("axis month", (l) => formatAxisLabel("2026-11-02", "month", l), "Nov 2026", "nov 2026"),
];

const NUMBERS: readonly FormatCase[] = [
  row("negative number", (l) => formatNumber(-1234.5, l), "-1,234.5", "-1.234,5"),
  row("zero", (l) => formatNumber(0, l), "0", "0"),
  row("minus zero", (l) => formatNumber(-0, l), "0", "0"),
  row("three digits", (l) => formatNumber(999, l), "999", "999"),
  row("four digits", (l) => formatNumber(1000, l), "1,000", "1.000"),
  row("millions", (l) => formatNumber(1234567.25, l), "1,234,567.25", "1.234.567,25"),
  row("small", (l) => formatNumber(0.05, l), "0.05", "0,05"),
  row(
    "no exponent, large",
    (l) => formatNumber(1e21, l),
    "1,000,000,000,000,000,000,000",
    "1.000.000.000.000.000.000.000",
  ),
  row("no exponent, small", (l) => formatNumber(1.5e-7, l), "0.00000015", "0,00000015"),
  row("padded", (l) => formatNumber(1234.5, l, { minFraction: 2 }), "1,234.50", "1.234,50"),
  row("rounded", (l) => formatNumber(1234.56, l, { maxFraction: 1 }), "1,234.6", "1.234,6"),
  row("half away from zero", (l) => formatNumber(2.5, l, { maxFraction: 0 }), "3", "3"),
  row("negative half", (l) => formatNumber(-2.5, l, { maxFraction: 0 }), "-3", "-3"),
  row("carried", (l) => formatNumber(999.96, l, { maxFraction: 1 }), "1,000", "1.000"),
  row("trailing zeros", (l) => formatNumber(1.999, l, { maxFraction: 2 }), "2", "2"),
  row("rounded to zero", (l) => formatNumber(-0.001, l, { maxFraction: 2 }), "0", "0"),
  row(
    "both bounds",
    (l) => formatNumber(1.999, l, { minFraction: 2, maxFraction: 2 }),
    "2.00",
    "2,00",
  ),
];

const MONEY: readonly FormatCase[] = [
  row("money GBP", (l) => formatMoney("12480", "GBP", l), "£12,480.00", "£ 12.480,00"),
  row("money cents", (l) => formatMoney("12480.5", "EUR", l), "€12,480.50", "€ 12.480,50"),
  row("money rounded up", (l) => formatMoney("12480.005", "EUR", l), "€12,480.01", "€ 12.480,01"),
  row("money rounded down", (l) => formatMoney("12480.004", "EUR", l), "€12,480.00", "€ 12.480,00"),
  row("money carried", (l) => formatMoney("999.995", "USD", l), "$1,000.00", "$ 1.000,00"),
  row("money JPY", (l) => formatMoney("12480.6", "JPY", l), "JPY 12,481", "JPY 12.481"),
  row(
    "money unknown code",
    (l) => formatMoney("12480", "XYZ", l),
    "XYZ 12,480.00",
    "XYZ 12.480,00",
  ),
  row("money negative", (l) => formatMoney("-12480.5", "EUR", l), "-€12,480.50", "-€ 12.480,50"),
  row("money negative code", (l) => formatMoney("-5", "CHF", l), "-CHF 5.00", "-CHF 5,00"),
  row("money zero", (l) => formatMoney("0", "EUR", l), "€0.00", "€ 0,00"),
  row("money rounded to zero", (l) => formatMoney("-0.001", "EUR", l), "€0.00", "€ 0,00"),
  row("money leading zeros", (l) => formatMoney("007.5", "EUR", l), "€7.50", "€ 7,50"),
  row(
    "money beyond a double",
    (l) => formatMoney("12345678901234567890.125", "EUR", l),
    "€12,345,678,901,234,567,890.13",
    "€ 12.345.678.901.234.567.890,13",
  ),
];

const PERCENTS: readonly FormatCase[] = [
  row("percent, no float error", (l) => formatPercent(0.07, l), "7%", "7%"),
  row("percent, whole", (l) => formatPercent(1, l), "100%", "100%"),
  row("percent, negative", (l) => formatPercent(-0.185, l), "-18.5%", "-18,5%"),
  row("percent, zero", (l) => formatPercent(0, l), "0%", "0%"),
  row("percent, grouped", (l) => formatPercent(12.5, l), "1,250%", "1.250%"),
  row("percent, rounded", (l) => formatPercent(0.12345, l, { maxFraction: 1 }), "12.3%", "12,3%"),
  row("percent, small", (l) => formatPercent(0.0005, l), "0.05%", "0,05%"),
];

// A calendar date never passes through a time zone: the same day at every offset and in every run.
const DATES: readonly FormatCase[] = [
  row("first day of a year", (l) => formatDate("2026-01-01", l), "1/1/2026", "01/01/2026"),
  row("last day of a year", (l) => formatDate("2026-12-31", l), "12/31/2026", "31/12/2026"),
  row(
    "long first day",
    (l) => formatLongDate("2026-01-01", l),
    "Thu, Jan 1, 2026",
    "gio 1 gen 2026",
  ),
  row(
    "long last day",
    (l) => formatLongDate("2026-12-31", l),
    "Thu, Dec 31, 2026",
    "gio 31 dic 2026",
  ),
  row("leap day", (l) => formatDate("2028-02-29", l), "2/29/2028", "29/02/2028"),
  row(
    "long leap day",
    (l) => formatLongDate("2028-02-29", l),
    "Tue, Feb 29, 2028",
    "mar 29 feb 2028",
  ),
  row("long Sunday", (l) => formatLongDate("2026-11-01", l), "Sun, Nov 1, 2026", "dom 1 nov 2026"),
  row(
    "long Saturday",
    (l) => formatLongDate("2026-09-12", l),
    "Sat, Sep 12, 2026",
    "sab 12 set 2026",
  ),
  row(
    "before 1970",
    (l) => formatLongDate("1969-07-20", l),
    "Sun, Jul 20, 1969",
    "dom 20 lug 1969",
  ),
  row("a Gantt axis week", (l) => formatAxisLabel("2026-12-09", "week", l), "Dec 9", "9 dic"),
  row(
    "a Gantt axis month",
    (l) => formatAxisLabel("2027-01-04", "month", l),
    "Jan 2027",
    "gen 2027",
  ),
];

// Offsets -10:00, +00:00, +01:00 and +14:00, each a time in minutes east of UTC.
const OFFSETS = [-600, 0, 60, 840] as const;
const instantAt = (instant: string, at: Record<(typeof OFFSETS)[number], [string, string]>) =>
  OFFSETS.map((offset) =>
    row(
      `${instant} at ${offset}`,
      (l) => formatDateTime(instant, offset, l),
      ...(at[offset] as [string, string]),
    ),
  );

const TIMES: readonly FormatCase[] = [
  ...instantAt("2026-10-28T15:12:00Z", {
    [-600]: ["Oct 28, 2026, 5:12 AM", "28 ott 2026, 05:12"],
    0: ["Oct 28, 2026, 3:12 PM", "28 ott 2026, 15:12"],
    60: ["Oct 28, 2026, 4:12 PM", "28 ott 2026, 16:12"],
    840: ["Oct 29, 2026, 5:12 AM", "29 ott 2026, 05:12"],
  }),
  ...instantAt("2026-12-31T23:30:00Z", {
    [-600]: ["Dec 31, 2026, 1:30 PM", "31 dic 2026, 13:30"],
    0: ["Dec 31, 2026, 11:30 PM", "31 dic 2026, 23:30"],
    60: ["Jan 1, 2027, 12:30 AM", "1 gen 2027, 00:30"],
    840: ["Jan 1, 2027, 1:30 PM", "1 gen 2027, 13:30"],
  }),
  ...instantAt("2026-01-01T05:00:00Z", {
    [-600]: ["Dec 31, 2025, 7:00 PM", "31 dic 2025, 19:00"],
    0: ["Jan 1, 2026, 5:00 AM", "1 gen 2026, 05:00"],
    60: ["Jan 1, 2026, 6:00 AM", "1 gen 2026, 06:00"],
    840: ["Jan 1, 2026, 7:00 PM", "1 gen 2026, 19:00"],
  }),
  row("noon", (l) => formatTime("2026-06-15T12:00:00Z", 0, l), "12:00 PM", "12:00"),
  row("past midnight", (l) => formatTime("2026-06-15T00:05:00Z", 0, l), "12:05 AM", "00:05"),
  row("seconds dropped", (l) => formatTime("2026-10-28T15:12:59.999Z", 60, l), "4:12 PM", "16:12"),
  row(
    "an offset in the instant",
    (l) => formatTime("2026-10-28T16:12:00+01:00", 0, l),
    "3:12 PM",
    "15:12",
  ),
  row("a lower-case instant", (l) => formatTime("2026-10-28t15:12:00z", 0, l), "3:12 PM", "15:12"),
  row(
    "a leap year's end",
    (l) => formatDateTime("2028-12-31T22:00:00Z", 120, l),
    "Jan 1, 2029, 12:00 AM",
    "1 gen 2029, 00:00",
  ),
  row("a half-hour offset", (l) => formatTime("2026-10-28T15:12:00Z", 330, l), "8:42 PM", "20:42"),
];

export const FORMAT_CASES: readonly FormatCase[] = [
  ...TABLE,
  ...NUMBERS,
  ...MONEY,
  ...PERCENTS,
  ...DATES,
  ...TIMES,
];

/** Every case's text in both locales, by name: what a run prints and compares. */
export const formatResults = (): Record<string, readonly [string, string]> =>
  Object.fromEntries(
    FORMAT_CASES.map((entry) => [entry.name, [entry.format("en-US"), entry.format("it-IT")]]),
  );
