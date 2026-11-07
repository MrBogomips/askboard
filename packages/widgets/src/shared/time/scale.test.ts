import { describe, expect, test } from "bun:test";
import { calendarDay, dateOfDay, dayNumber } from "./date.ts";
import {
  axisTicks,
  dateAt,
  isZoom,
  labelLines,
  MAX_TICKS,
  openingZoom,
  PIXELS_PER_DAY,
  stretchedLast,
  type Tick,
  ticks,
  weekendDays,
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

describe("the axis in the ask's locale (settings-languages, task 9.2)", () => {
  test("labels the ticks in Italian: lun 2, 2 nov and nov 2026", () => {
    expect(ticks(ORIGIN, "2026-11-03", "day", "it-IT").map((tick) => tick.label)).toEqual([
      "lun 2",
      "mar 3",
    ]);
    expect(ticks(ORIGIN, "2026-11-10", "week", "it-IT").map((tick) => tick.label)).toEqual([
      "2 nov",
      "9 nov",
    ]);
    expect(ticks("2026-11-01", "2026-12-05", "month", "it-IT").map((tick) => tick.label)).toEqual([
      "nov 2026",
      "dic 2026",
    ]);
  });
});

describe("an axis label's lines", () => {
  test("at day zoom, the weekday over the day, as a day's column is too narrow for both side by side", () => {
    expect(labelLines("Mon 2", "day")).toEqual(["Mon", "2"]);
    expect(labelLines("mer 11", "day")).toEqual(["mer", "11"]);
  });

  test("at week and month zoom, one line: their columns hold it", () => {
    expect(labelLines("2 nov", "week")).toEqual(["2 nov"]);
    expect(labelLines("nov 2026", "month")).toEqual(["nov 2026"]);
  });
});

describe("the axis labels its first period (design decision 8; review F-15)", () => {
  test("adds the origin's month at month zoom when the plan starts inside it", () => {
    expect(axisTicks(ORIGIN, "2027-01-20", "month").map((tick) => [tick.x, tick.label])).toEqual([
      [0, "Nov 2026"],
      [116, "Dec 2026"],
      [240, "Jan 2027"],
    ]);
  });

  test("adds the origin's day at week zoom when it is not a Monday", () => {
    expect(
      axisTicks("2026-10-28", "2026-11-17", "week").map((tick) => [tick.x, tick.label]),
    ).toEqual([
      [0, "Oct 28"],
      [75, "Nov 2"],
      [180, "Nov 9"],
      [285, "Nov 16"],
    ]);
  });

  test("adds nothing where the origin is a tick, or the zoom is day", () => {
    expect(axisTicks("2026-11-01", "2026-12-20", "month")).toEqual(
      ticks("2026-11-01", "2026-12-20", "month"),
    );
    expect(axisTicks(ORIGIN, "2026-11-20", "week")).toEqual(ticks(ORIGIN, "2026-11-20", "week"));
    expect(axisTicks("2026-10-28", "2026-11-04", "day")).toEqual(
      ticks("2026-10-28", "2026-11-04", "day"),
    );
  });

  test("skips the first label when the next tick is too close to hold it", () => {
    // Origin Sunday 11/1/2026 is one day before a Monday: 15px at week zoom.
    expect(axisTicks("2026-11-01", "2026-11-17", "week").map((tick) => tick.date)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
    ]);
    // Origin 10/31: the month's first day is one day on, 4px at month zoom.
    expect(axisTicks("2026-10-31", "2027-01-20", "month").map((tick) => tick.date)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ]);
  });

  test("labels in Italian", () => {
    expect(axisTicks(ORIGIN, "2026-12-20", "month", "it-IT")[0]?.label).toBe("nov 2026");
  });
});

describe("the opening zoom (design decision 9; review F-03)", () => {
  test("is the finest zoom at which the whole span fits the width", () => {
    expect(openingZoom(10, 400)).toBe("day");
    expect(openingZoom(61, 1_000)).toBe("week");
    expect(openingZoom(61, 300)).toBe("month");
  });

  test("is month when none fits", () => {
    expect(openingZoom(400, 300)).toBe("month");
    expect(openingZoom(61, 0)).toBe("month");
  });

  test("takes a span that fills the width exactly as fitting", () => {
    expect(openingZoom(20, 300)).toBe("week");
    expect(openingZoom(20, 640)).toBe("day");
  });
});

describe("a short span stretched to the frame's width (review F-15)", () => {
  const span = { origin: ORIGIN, last: "2026-12-01" };

  test("runs the axis on to the day the width needs", () => {
    // 30 days at 4px are 120px: 400px need 100 days, 11/2 to 2/9/2027.
    expect(stretchedLast(span, "month", 400)).toBe("2027-02-09");
  });

  test("stays within a width that is no whole number of days", () => {
    // 717px hold 179 days at 4px (716px), not 180 (720px), which would scroll.
    expect(stretchedLast(span, "month", 717)).toBe("2027-04-29");
  });

  test("leaves a span that already fills the width", () => {
    expect(stretchedLast(span, "week", 300)).toBe("2026-12-01");
    expect(stretchedLast(span, "week", 0)).toBe("2026-12-01");
  });

  test("stops at the last day a Gantt may name", () => {
    expect(stretchedLast({ origin: "9999-12-20", last: "9999-12-25" }, "day", 100_000)).toBe(
      "9999-12-31",
    );
  });
});

describe("the non-working days of a day-zoom axis (review F-15)", () => {
  test("are the Saturdays and Sundays", () => {
    expect(weekendDays(ORIGIN, "2026-11-15")).toEqual([
      "2026-11-07",
      "2026-11-08",
      "2026-11-14",
      "2026-11-15",
    ]);
  });

  test("hold none for an axis of Monday to Friday, or of no days", () => {
    expect(weekendDays(ORIGIN, "2026-11-06")).toEqual([]);
    expect(weekendDays("2026-11-09", ORIGIN)).toEqual([]);
  });

  test("are not listed for a span too long to draw each day", () => {
    expect(weekendDays(ORIGIN, "2036-11-02")).toEqual([]);
  });
});
