import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "@askboard/contract";
import {
  calendarDay,
  dateOfDay,
  dayNumber,
  echoDate,
  FIRST_DAY,
  gridDate,
  isGanttDate,
  LAST_DAY,
  parseDateEntry,
  spansYears,
} from "./date.ts";

describe("the Gantt's en-US date entry", () => {
  test.each([
    ["12/9/2026", "2026-12-09"],
    ["2026-12-09", "2026-12-09"],
    [" 12/09/2026 ", "2026-12-09"],
    ["1/1/2027", "2027-01-01"],
    ["2/29/2028", "2028-02-29"],
    ["3/2/1900", "1900-03-02"],
    ["12/31/9999", "9999-12-31"],
  ])("reads %j as %s", (text, date) => {
    expect(parseDateEntry(text)).toEqual({ kind: "date", date });
  });

  test.each(["", "   "])("reads %j as an empty field", (text) => {
    expect(parseDateEntry(text)).toEqual({ kind: "empty" });
  });

  test.each([
    ["13/1/2026", "13 is not a month: write month/day/year, as in 12/9/2026"],
    ["0/1/2026", "0 is not a month: write month/day/year, as in 12/9/2026"],
    ["2/30/2026", "February 2026 has no day 30"],
    ["2/29/2027", "February 2027 has no day 29"],
    ["2026-02-30", "February 2026 has no day 30"],
    ["12/9", "Write the year too: month/day/year, as in 12/9/2026"],
    ["9.12.2026", "Write the date as month/day/year, as in 12/9/2026"],
    ["12/9/26", "Write the date as month/day/year, as in 12/9/2026"],
    ["2026-12-9", "Write the date as month/day/year, as in 12/9/2026"],
    ["Dec 9", "Write the date as month/day/year, as in 12/9/2026"],
    ["1899-12-31", "Pick a day from 3/2/1900 to 12/31/9999"],
    ["2/28/1900", "Pick a day from 3/2/1900 to 12/31/9999"],
    ["3/1/1900", "Pick a day from 3/2/1900 to 12/31/9999"],
  ])("refuses %j, saying why", (text, reason) => {
    expect(parseDateEntry(text)).toEqual({ kind: "refused", reason });
  });

  test.each([
    ["2026-12-09", "12/9/2026", "= Wed, Dec 9, 2026"],
    ["2026-11-02", "11/2/2026", "= Mon, Nov 2, 2026"],
    ["2028-02-29", "2/29/2028", "= Tue, Feb 29, 2028"],
    ["1900-03-02", "3/2/1900", "= Fri, Mar 2, 1900"],
    ["9999-12-31", "12/31/9999", "= Fri, Dec 31, 9999"],
  ])("shows %s as %s in the grid and echoes %s", (date, grid, echo) => {
    expect(gridDate(date)).toBe(grid);
    expect(echoDate(date)).toBe(echo);
  });

  test("reads back every day it shows, over 800 days of 2027", () => {
    for (let day = 0; day < 800; day++) {
      const month = 1 + (Math.floor(day / 28) % 12);
      const date = `2027-${String(month).padStart(2, "0")}-${String(1 + (day % 28)).padStart(2, "0")}`;
      expect(parseDateEntry(gridDate(date))).toEqual({ kind: "date", date });
    }
  });

  test.each(["2026-02-30", "12/9/2026", "1899-12-31", "1900-03-01"])(
    "refuses to show %s, no date it holds",
    (date) => {
      expect(() => gridDate(date)).toThrow(RangeError);
      expect(() => echoDate(date)).toThrow(RangeError);
    },
  );

  test("gives the same results in any time zone, using no Date", async () => {
    const source = await Bun.file(join(import.meta.dir, "date.ts")).text();
    expect(/\bDate\b/.test(source.replace(/\/\/.*$/gm, ""))).toBe(false);
    const script = `import { echoDate, parseDateEntry } from ${JSON.stringify(join(import.meta.dir, "date.ts"))};
console.log(JSON.stringify(["12/9/2026", "2/29/2028", "1/1/2027"].map((t) => {
  const entry = parseDateEntry(t);
  return entry.kind === "date" ? echoDate(entry.date) : entry;
})));`;
    const run = (tz: string) =>
      Bun.spawnSync(["bun", "-e", script], { env: { ...process.env, TZ: tz } }).stdout.toString();
    const here = run("Pacific/Kiritimati");
    expect(JSON.parse(here)).toEqual([
      "= Wed, Dec 9, 2026",
      "= Tue, Feb 29, 2028",
      "= Fri, Jan 1, 2027",
    ]);
    expect(run("America/Adak")).toBe(here);
  });

  test("takes its range from the contract's GANTT_FIRST_DATE and GANTT_LAST_DATE", () => {
    const range = `Pick a day from ${gridDate(GANTT_FIRST_DATE)} to ${gridDate(GANTT_LAST_DATE)}`;
    expect(parseDateEntry("3/1/1900")).toEqual({ kind: "refused", reason: range });
    expect(parseDateEntry(GANTT_FIRST_DATE)).toEqual({ kind: "date", date: GANTT_FIRST_DATE });
    expect(parseDateEntry(GANTT_LAST_DATE)).toEqual({ kind: "date", date: GANTT_LAST_DATE });
  });

  test.each([
    ["2026-12-09", true],
    ["2028-02-29", true],
    [GANTT_FIRST_DATE, true],
    [GANTT_LAST_DATE, true],
    ["1900-03-01", false],
    ["2026-02-30", false],
    ["2027-02-29", false],
    ["12/9/2026", false],
    ["2026-12-9", false],
    [" 2026-12-09", false],
    ["", false],
  ])("tells whether %j is a full-date the Gantt may name: %p", (date, verdict) => {
    expect(isGanttDate(date)).toBe(verdict);
  });
});

describe("the Gantt's day numbers", () => {
  test.each([
    ["1970-01-01", 0],
    ["1970-01-02", 1],
    ["1969-12-31", -1],
    ["2026-11-02", 20_759],
    [GANTT_FIRST_DATE, -25_507],
    [GANTT_LAST_DATE, 2_932_896],
  ])("counts %s as day %i from 1970-01-01, and back", (date, day) => {
    expect(dayNumber(date)).toBe(day);
    expect(dateOfDay(day)).toBe(date);
  });

  test("holds the range's ends as FIRST_DAY and LAST_DAY", () => {
    expect(FIRST_DAY).toBe(dayNumber(GANTT_FIRST_DATE));
    expect(LAST_DAY).toBe(dayNumber(GANTT_LAST_DATE));
  });

  test("reads back every day over four years, a leap day among them", () => {
    let previous = dayNumber("2026-12-31");
    for (let day = previous + 1; day < previous + 4 * 366; day++) {
      const date = dateOfDay(day);
      expect(dayNumber(date)).toBe(day);
      expect(isGanttDate(date)).toBe(true);
    }
    previous = dayNumber("2028-02-28");
    expect(dateOfDay(previous + 1)).toBe("2028-02-29");
    expect(dateOfDay(previous + 2)).toBe("2028-03-01");
  });

  test.each([FIRST_DAY - 1, LAST_DAY + 1, 0.5, Number.NaN])(
    "refuses day %p, no day the Gantt may name",
    (day) => {
      expect(() => dateOfDay(day)).toThrow(RangeError);
    },
  );

  test("refuses to count a date it cannot hold", () => {
    expect(() => dayNumber("1900-03-01")).toThrow(RangeError);
    expect(() => dayNumber("2026-02-30")).toThrow(RangeError);
  });

  test.each([
    ["2026-11-02", 2026, 11, 2, 1, 30, "Nov", "Mon"],
    ["2026-12-13", 2026, 12, 13, 0, 31, "Dec", "Sun"],
    ["2028-02-29", 2028, 2, 29, 2, 29, "Feb", "Tue"],
    ["2027-02-01", 2027, 2, 1, 1, 28, "Feb", "Mon"],
    ["1900-03-02", 1900, 3, 2, 5, 31, "Mar", "Fri"],
  ])("spells out %s", (date, year, month, day, weekday, daysInMonth, monthName, weekdayName) => {
    expect(calendarDay(date)).toEqual({
      year,
      month,
      day,
      weekday,
      daysInMonth,
      monthName,
      weekdayName,
    });
  });
});

describe("the Gantt's it-IT dates (settings-languages, task 9.2)", () => {
  const italian = { locale: "it-IT", language: "it-IT" } as const;

  test("reads day first and refuses a day outside the range in Italian", () => {
    expect(parseDateEntry("9/12/2026", italian)).toEqual({ kind: "date", date: "2026-12-09" });
    expect(parseDateEntry("2026-12-09", italian)).toEqual({ kind: "date", date: "2026-12-09" });
    const early = parseDateEntry("1/1/1800", italian);
    expect(early).toEqual({
      kind: "refused",
      reason: "Scegli un giorno dal 02/03/1900 al 31/12/9999",
    });
  });

  test("shows the grid's form and the echo in Italian", () => {
    expect(gridDate("2026-12-09", "it-IT")).toBe("09/12/2026");
    expect(gridDate("2026-12-09")).toBe("12/9/2026");
    expect(echoDate("2026-12-09", "it-IT")).toBe("= mer 9 dic 2026");
  });

  test("still refuses a day outside the contract's range, whatever the locale", () => {
    expect(() => gridDate("1899-12-31", "it-IT")).toThrow(RangeError);
    expect(() => echoDate("1899-12-31", "it-IT")).toThrow(RangeError);
  });
});

describe("whether a plan spans two years (review F-21)", () => {
  test("is no when every date is in one year, or there is none", () => {
    expect(spansYears([])).toBe(false);
    expect(spansYears(["2026-11-02", "2026-12-31"])).toBe(false);
  });

  test("is yes when the dates are in two", () => {
    expect(spansYears(["2026-12-31", "2027-01-04"])).toBe(true);
  });
});
