import { describe, expect, test } from "bun:test";
import { calendarDay, dateOfDay, dayNumber } from "./date.ts";
import {
  dateAt,
  isZoom,
  MAX_TICKS,
  PIXELS_PER_DAY,
  type Tick,
  ticks,
  xOf,
  ZOOMS,
  type Zoom,
} from "./scale.ts";

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

  test("gives no tick when the zoom's first one would fall past the last day a Gantt may name", () => {
    // 9999-12-31 is a Friday: the next Monday and the next month's first day are out of range.
    expect(ticks("9999-12-28", "9999-12-31", "week")).toEqual([]);
    expect(ticks("9999-12-15", "9999-12-31", "month")).toEqual([]);
  });
});

/** Each tick's place in its zoom's units: its day, its Monday's week from day 0, or its month. */
const unitOf = (tick: Tick, zoom: Zoom): number => {
  const day = dayNumber(tick.date);
  if (zoom === "day") return day;
  if (zoom === "week") return Math.floor(day / 7);
  const { year, month } = calendarDay(tick.date);
  return year * 12 + month;
};

/** The label a tick takes in its zoom (the tests above spell each form out). */
const labelOf = (date: string, zoom: Zoom): string => {
  const { year, day, monthName, weekdayName } = calendarDay(date);
  if (zoom === "day") return `${weekdayName} ${day}`;
  return zoom === "week" ? `${monthName} ${day}` : `${monthName} ${year}`;
};

describe("the axis of a far plan (design decision 8)", () => {
  // Every tick from 2026-11-02 to 9999-12-31: each day, each Monday to 9999-12-27, and each
  // month's first day from 2026-12-01 to 9999-12-01.
  const FAR = "9999-12-31";
  const UNTHINNED: Readonly<Record<Zoom, number>> = {
    day: 2_912_138,
    week: 416_020,
    month: 95_677,
  };
  const FIRST: Readonly<Record<Zoom, string>> = {
    day: "2026-11-02",
    week: "2026-11-02",
    month: "2026-12-01",
  };

  test("draws at most about 2,000 ticks", () => {
    expect(MAX_TICKS).toBe(2_000);
  });

  test.each([...ZOOMS])(
    "keeps every n-th tick at %s zoom to 9999-12-31, the smallest n within the bound",
    (zoom) => {
      const axis = ticks(ORIGIN, FAR, zoom);
      const every = Math.ceil(UNTHINNED[zoom] / MAX_TICKS);
      // The smallest n: every (n - 1)-th tick would draw more than the bound.
      expect(Math.ceil(UNTHINNED[zoom] / (every - 1))).toBeGreaterThan(MAX_TICKS);
      expect(axis.length).toBeLessThanOrEqual(MAX_TICKS);
      // All of them, from the zoom's first tick on or after the origin to the last within the span.
      expect(axis).toHaveLength(Math.ceil(UNTHINNED[zoom] / every));
      expect(axis[0]?.date).toBe(FIRST[zoom]);
      const units = axis.map((tick) => unitOf(tick, zoom));
      expect(units.slice(1).every((unit, index) => unit - (units[index] as number) === every)).toBe(
        true,
      );
      const days = axis.map((tick) => calendarDay(tick.date));
      if (zoom === "week") expect(days.every((day) => day.weekday === 1)).toBe(true);
      if (zoom === "month") expect(days.every((day) => day.day === 1)).toBe(true);
      expect((axis.at(-1)?.date ?? "") <= FAR).toBe(true);
      for (const tick of axis) {
        expect(tick.label).toBe(labelOf(tick.date, zoom));
        expect(tick.x).toBe(xOf(tick.date, ORIGIN, zoom));
      }
      expect(Object.isFrozen(axis)).toBe(true);
      expect(axis.every((tick) => Object.isFrozen(tick))).toBe(true);
    },
  );

  test.each([...ZOOMS])(
    "counts the ticks at %s zoom to 9999-12-31 without walking them",
    (zoom) => {
      const from = performance.now();
      ticks(ORIGIN, FAR, zoom);
      const took = performance.now() - from;
      // A bound far above what this machine gives (about 2 ms): it catches a walk over every
      // day of the span (about 3 s at day zoom, 400 ms at week, 100 ms at month), not a busy
      // machine.
      expect(took).toBeLessThan(50);
    },
  );

  test.each([
    ["day", "2032-04-23", "2032-04-24"],
    ["week", "2065-02-23", "2065-03-02"],
    ["month", "2193-07-01", "2193-08-01"],
  ] as const)(
    "keeps all 2,000 ticks at %s zoom to %s, and every second one a tick later",
    (zoom, within, past) => {
      const all = ticks(ORIGIN, within, zoom);
      expect(all).toHaveLength(MAX_TICKS);
      expect(all[0]?.date).toBe(FIRST[zoom]);
      expect(all.at(-1)?.date).toBe(within);
      const units = all.map((tick) => unitOf(tick, zoom));
      expect(units.slice(1).every((unit, index) => unit - (units[index] as number) === 1)).toBe(
        true,
      );
      const thinned = ticks(ORIGIN, past, zoom);
      expect(thinned).toHaveLength(MAX_TICKS / 2 + 1);
      expect(thinned).toEqual(all.filter((_, index) => index % 2 === 0).concat(thinned.slice(-1)));
      expect(thinned.at(-1)?.date).toBe(past);
    },
  );
});
