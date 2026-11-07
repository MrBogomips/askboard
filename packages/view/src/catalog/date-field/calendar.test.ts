import { describe, expect, test } from "bun:test";
import {
  calendarFormatters,
  calendarLabels,
  dayOf,
  disabledOf,
  fullDateOf,
  monthRangeOf,
  rangeOf,
  weekStartOf,
} from "./calendar.ts";

// What the DateField's calendar needs of AskBoard's tables (atoms, task 5.5; view-and-widgets spec:
// The DateField's calendar; design decision 7): a full-date and a local day in both directions, the
// item's range, the week's first day, and the captions, weekday names and labels in the ask's
// language, so that react-day-picker never reaches the runtime's `Intl`. Plain functions.

describe("a full-date and a day of the calendar", () => {
  test("a day round-trips for every day of two years, a leap one included, in the runtime's time zone", () => {
    for (const year of [2024, 2026]) {
      for (let month = 1; month <= 12; month += 1) {
        for (let day = 1; day <= 31; day += 1) {
          const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const real = new Date(Date.UTC(year, month - 1, day));
          if (real.getUTCMonth() !== month - 1) continue;
          expect(fullDateOf(dayOf(date)), date).toBe(date);
        }
      }
    }
  });

  test("a day is the date's own year, month and day at noon, so no time zone moves it", () => {
    const day = dayOf("2026-12-09");
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()]).toEqual([
      2026, 11, 9, 12,
    ]);
  });

  test("any time of the day reads as the same full-date", () => {
    expect(fullDateOf(new Date(2026, 11, 9, 0, 0, 0))).toBe("2026-12-09");
    expect(fullDateOf(new Date(2026, 11, 9, 23, 59, 59))).toBe("2026-12-09");
  });

  test("a year below 1000 and a one-digit month and day are zero-padded", () => {
    expect(fullDateOf(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("the item's range", () => {
  test("min and max, else the Gantt's first and last days", () => {
    expect(rangeOf({ label: "L", min: "2026-03-01", max: "2026-06-30" })).toEqual({
      first: "2026-03-01",
      last: "2026-06-30",
    });
    const open = rangeOf({ label: "L" });
    expect(open.first < "2026-01-01").toBe(true);
    expect(open.last > "2030-01-01").toBe(true);
  });

  test("the months a calendar shows are those of the first and the last day", () => {
    const { start, end } = monthRangeOf({ label: "L", min: "2026-03-15", max: "2026-06-30" });
    expect(fullDateOf(start).slice(0, 7)).toBe("2026-03");
    expect(fullDateOf(end).slice(0, 7)).toBe("2026-06");
  });

  test("days before the first and after the last are disabled", () => {
    const [before, after] = disabledOf({ label: "L", min: "2026-03-15", max: "2026-06-30" }) as [
      { before: Date },
      { after: Date },
    ];
    expect(fullDateOf(before.before)).toBe("2026-03-15");
    expect(fullDateOf(after.after)).toBe("2026-06-30");
  });
});

describe("the week", () => {
  test("starts on Sunday in en-US and on Monday in it-IT", () => {
    expect(weekStartOf("en-US")).toBe(0);
    expect(weekStartOf("it-IT")).toBe(1);
  });
});

describe("the captions, weekday names and labels", () => {
  const December = dayOf("2026-12-09");

  test("the caption is the month's full name and the year, from the tables", () => {
    expect(calendarFormatters("en-US").formatCaption(December)).toBe("December 2026");
    expect(calendarFormatters("it-IT").formatCaption(December)).toBe("dicembre 2026");
  });

  test("a weekday's name is the table's short one", () => {
    expect(calendarFormatters("en-US").formatWeekdayName(December)).toBe("Wed");
    expect(calendarFormatters("it-IT").formatWeekdayName(December)).toBe("mer");
  });

  test("a day's accessible name is its long date, and the grid's name the caption", () => {
    const en = calendarLabels("en-US", "en-US");
    expect(en.labelDayButton(December)).toBe("Wed, Dec 9, 2026");
    expect(en.labelGridcell(December)).toBe("Wed, Dec 9, 2026");
    expect(en.labelGrid(December)).toBe("December 2026");
    expect(en.labelWeekday(December)).toBe("Wed");
    const it = calendarLabels("it-IT", "it-IT");
    expect(it.labelDayButton(December)).toBe("mer 9 dic 2026");
    expect(it.labelGrid(December)).toBe("dicembre 2026");
  });

  test("the navigation words come from the view's strings, in the ask's language", () => {
    expect(calendarLabels("en-US", "en-US").labelPrevious()).toBe("Previous month");
    expect(calendarLabels("en-US", "en-US").labelNext()).toBe("Next month");
    expect(calendarLabels("it-IT", "it-IT").labelPrevious()).toBe("Mese precedente");
    expect(calendarLabels("it-IT", "it-IT").labelNext()).toBe("Mese successivo");
    expect(calendarLabels("en-US", "it-IT").labelNext()).toBe("Mese successivo");
    expect(calendarLabels("en-US", "en-US").labelNav()).toBe("Month navigation");
    expect(calendarLabels("it-IT", "it-IT").labelNav()).toBe("Navigazione tra i mesi");
  });

  test("no formatter or label touches Intl or toLocale*", () => {
    const { DateTimeFormat, NumberFormat } = Intl;
    const toLocale = Date.prototype.toLocaleDateString;
    const stub = () => {
      throw new Error("the runtime's formatting was used");
    };
    Object.assign(Intl, { DateTimeFormat: stub, NumberFormat: stub });
    Date.prototype.toLocaleDateString = stub;
    try {
      const f = calendarFormatters("it-IT");
      const l = calendarLabels("it-IT", "it-IT");
      expect(f.formatCaption(December)).toBe("dicembre 2026");
      expect(l.labelDayButton(December)).toBe("mer 9 dic 2026");
    } finally {
      Object.assign(Intl, { DateTimeFormat, NumberFormat });
      Date.prototype.toLocaleDateString = toLocale;
    }
  });
});
