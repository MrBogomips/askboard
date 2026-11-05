import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatAxisLabel,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatTime,
  LOCALES,
} from "../src/index.ts";
import { FORMAT_CASES } from "./locale/cases.ts";

// AskBoard's own en-US and it-IT formats (settings-languages design decision 8; contract spec,
// "Locale formats"): tables and pure functions, the same text whatever the runtime's locale and
// time zone. Calendar dates never pass through a time zone; a time shows at the offset it is given.

describe("the locales", () => {
  test("are en-US and it-IT", () => {
    expect(LOCALES).toEqual(["en-US", "it-IT"]);
  });
});

describe.each(LOCALES)("formats in %s", (locale) => {
  test.each(FORMAT_CASES.map((entry) => [entry.name, entry] as const))("%s", (_, entry) => {
    expect(entry.format(locale)).toBe(entry[locale]);
  });
});

describe("the fixtures", () => {
  test("name each case once", () => {
    const names = FORMAT_CASES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("values a format refuses", () => {
  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "a number that is not finite: %p",
    (value) => {
      expect(() => formatNumber(value, "en-US")).toThrow(RangeError);
      expect(() => formatPercent(value, "it-IT")).toThrow(RangeError);
    },
  );

  test.each([
    { minFraction: -1 },
    { maxFraction: 1.5 },
    { minFraction: 3, maxFraction: 2 },
    { maxFraction: 101 },
  ])("fraction digits out of range: %p", (options) => {
    expect(() => formatNumber(1, "en-US", options)).toThrow(RangeError);
  });

  test.each(["12,480", "1e3", "", "-", ".5", "5.", "+5", " 5", "five"])(
    "an amount that is not a decimal string: %p",
    (amount) => {
      expect(() => formatMoney(amount, "EUR", "en-US")).toThrow(RangeError);
    },
  );

  test.each(["eur", "EURO", "", "€"])("a currency that is not an ISO 4217 code: %p", (code) => {
    expect(() => formatMoney("1", code, "en-US")).toThrow(RangeError);
  });

  test.each(["2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "26-1-1", "2026-1-01", ""])(
    "a calendar date that does not exist: %p",
    (date) => {
      expect(() => formatDate(date, "en-US")).toThrow(RangeError);
      expect(() => formatLongDate(date, "it-IT")).toThrow(RangeError);
      expect(() => formatAxisLabel(date, "day", "en-US")).toThrow(RangeError);
    },
  );

  test.each([
    "2026-10-28",
    "2026-02-30T00:00:00Z",
    "2026-10-28T24:00:00Z",
    "2026-10-28T15:60:00Z",
    "2026-10-28T15:12:00",
    "2026-10-28 15:12:00Z",
    "2026-10-28T15:12:00+25:00",
  ])("an instant that is not RFC 3339: %p", (instant) => {
    expect(() => formatTime(instant, 0, "en-US")).toThrow(RangeError);
    expect(() => formatDateTime(instant, 0, "it-IT")).toThrow(RangeError);
  });

  test.each([1.5, Number.NaN, 1440, -1440])("an offset that is not one: %p", (offset) => {
    expect(() => formatTime("2026-10-28T15:12:00Z", offset, "en-US")).toThrow(RangeError);
  });

  test("a locale outside the two", () => {
    expect(() => formatNumber(1, "fr-FR" as never)).toThrow(RangeError);
    expect(() => formatDate("2026-10-27", "de-DE" as never)).toThrow(RangeError);
  });
});

describe("the sources", () => {
  const folder = join(import.meta.dir, "../src/locale");
  const sources = readdirSync(folder).map((name) => [
    name,
    readFileSync(join(folder, name), "utf8"),
  ]);

  test.each(sources)("%s uses no Intl, toLocale* or Date", (_, text) => {
    expect(text).not.toMatch(/\bIntl\b|toLocale|\bDate\b/);
  });
});
