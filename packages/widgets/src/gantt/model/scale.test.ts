import { describe, expect, test } from "bun:test";
import { dateOfDay, dayNumber } from "./date.ts";
import { dateAt, isZoom, PIXELS_PER_DAY, ticks, xOf, ZOOMS } from "./scale.ts";

const ORIGIN = "2026-11-02";

describe("the Gantt's time scale", () => {
  test("draws 32, 15 and 4 pixels per calendar day at day, week and month zoom", () => {
    expect(ZOOMS).toEqual(["day", "week", "month"]);
    expect(PIXELS_PER_DAY).toEqual({ day: 32, week: 15, month: 4 });
  });

  test("tells a zoom from any other text, such as the empty value of a toggle turned off", () => {
    expect(ZOOMS.filter(isZoom)).toEqual([...ZOOMS]);
    for (const text of ["", "Week", "year", "toString", "__proto__"])
      expect(isZoom(text)).toBe(false);
  });

  test.each([
    ["2026-11-02", "week", 0],
    ["2026-11-09", "week", 105],
    ["2026-11-09", "day", 224],
    ["2026-11-09", "month", 28],
    ["2026-10-31", "week", -30],
    ["2027-01-01", "month", 240],
  ] as const)("puts %s at x %i in %s zoom", (date, zoom, x) => {
    expect(xOf(date, ORIGIN, zoom)).toBe(x);
  });

  test.each([
    [0, "week", "2026-11-02"],
    [105, "week", "2026-11-09"],
    [112, "week", "2026-11-09"],
    [113, "week", "2026-11-10"],
    [-15, "week", "2026-11-01"],
    [-22, "week", "2026-11-01"],
    [15.9, "day", "2026-11-02"],
    [16, "day", "2026-11-03"],
    [6, "month", "2026-11-04"],
  ] as const)("reads x %p in %s zoom as the nearest day, %s", (x, zoom, date) => {
    expect(dateAt(x, ORIGIN, zoom)).toBe(date);
  });

  test("reads every day's x back as that day, in each zoom", () => {
    for (const zoom of ZOOMS) {
      for (let day = -40; day < 400; day++) {
        const date = dateOfDay(dayNumber(ORIGIN) + day);
        expect(dateAt(xOf(date, ORIGIN, zoom), ORIGIN, zoom)).toBe(date);
      }
    }
  });

  test("ticks each day at day zoom, as Mon 2", () => {
    expect(ticks(ORIGIN, "2026-11-08", "day")).toEqual([
      { date: "2026-11-02", x: 0, label: "Mon 2" },
      { date: "2026-11-03", x: 32, label: "Tue 3" },
      { date: "2026-11-04", x: 64, label: "Wed 4" },
      { date: "2026-11-05", x: 96, label: "Thu 5" },
      { date: "2026-11-06", x: 128, label: "Fri 6" },
      { date: "2026-11-07", x: 160, label: "Sat 7" },
      { date: "2026-11-08", x: 192, label: "Sun 8" },
    ]);
  });

  test("ticks each Monday at week zoom, as Nov 2", () => {
    expect(ticks("2026-10-28", "2026-11-30", "week")).toEqual([
      { date: "2026-11-02", x: 75, label: "Nov 2" },
      { date: "2026-11-09", x: 180, label: "Nov 9" },
      { date: "2026-11-16", x: 285, label: "Nov 16" },
      { date: "2026-11-23", x: 390, label: "Nov 23" },
      { date: "2026-11-30", x: 495, label: "Nov 30" },
    ]);
    expect(ticks(ORIGIN, "2026-11-08", "week")).toEqual([
      { date: "2026-11-02", x: 0, label: "Nov 2" },
    ]);
  });

  test("ticks each month's first day at month zoom, as Nov 2026, across a year's end", () => {
    expect(ticks(ORIGIN, "2027-03-01", "month")).toEqual([
      { date: "2026-12-01", x: 116, label: "Dec 2026" },
      { date: "2027-01-01", x: 240, label: "Jan 2027" },
      { date: "2027-02-01", x: 364, label: "Feb 2027" },
      { date: "2027-03-01", x: 476, label: "Mar 2027" },
    ]);
    expect(ticks("2026-11-01", "2026-11-30", "month")).toEqual([
      { date: "2026-11-01", x: 0, label: "Nov 2026" },
    ]);
  });

  test("gives no tick for an axis that ends before it starts, and frozen ticks", () => {
    expect(ticks("2026-11-09", ORIGIN, "day")).toEqual([]);
    const axis = ticks(ORIGIN, "2026-12-31", "week");
    expect(Object.isFrozen(axis)).toBe(true);
    expect(axis.every((tick) => Object.isFrozen(tick))).toBe(true);
  });
});
