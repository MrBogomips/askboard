// The Timeline's layout (latex-kanban-timeline, task 4.3; view-and-widgets spec: Timeline layout;
// design decision 10): the span of the axis, the zoom it opens at, the lanes as bands of tracks,
// each entry's shape and label, and the lane under a y position.

import { describe, expect, test } from "bun:test";
import { GANTT_FIRST_DATE, type TimelineEntry, type TimelineProps } from "@askboard/contract";
import { TIMELINE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { AXIS_HEIGHT, AXIS_TAIL_DAYS, BAR_HEIGHT } from "../gantt/model/layout.ts";
import { dateOfDay, dayNumber } from "../shared/time/date.ts";
import { PIXELS_PER_DAY, xOf } from "../shared/time/scale.ts";
import {
  LABEL_CHAR_WIDTH,
  LABEL_MAX_WIDTH,
  labelWidth,
  laneAt,
  layoutOf,
  MILESTONE_WIDTH,
  openingZoomOf,
  spanOf,
  TRACK_HEIGHT,
} from "./layout.ts";

const LANES = TIMELINE_FIXTURE_ITEM.props.lanes;
const range = (
  id: string,
  lane: string,
  start: string,
  end: string,
  label = id,
): TimelineEntry => ({
  id,
  label,
  lane,
  start,
  end,
});
const milestone = (id: string, lane: string, date: string, label = id): TimelineEntry => ({
  id,
  label,
  lane,
  date,
});
const props = (...entries: TimelineEntry[]): TimelineProps => ({ lanes: LANES, entries });
const laidOut = (given: TimelineProps, zoom: "day" | "week" | "month" = "day") =>
  layoutOf(given, spanOf(given, given), zoom);
const placed = (given: TimelineProps, id: string, zoom: "day" | "week" | "month" = "day") =>
  laidOut(given, zoom).entries.find((entry) => entry.id === id);

describe("the span", () => {
  test("runs from the first date to the Gantt's tail past the last, as sent", () => {
    const span = spanOf(TIMELINE_FIXTURE_ITEM.props, TIMELINE_FIXTURE_ITEM.props);
    expect(span).toEqual({
      origin: "2026-01-05",
      last: dateOfDay(dayNumber("2026-03-02") + AXIS_TAIL_DAYS),
    });
    expect(AXIS_TAIL_DAYS).toBe(14);
  });

  test("covers every date as shown too, an earlier and a later one alike", () => {
    const sent = props(range("a", "web", "2026-03-02", "2026-03-06"));
    const earlier = props(range("a", "web", "2026-02-02", "2026-02-06"));
    const later = props(range("a", "web", "2026-04-02", "2026-04-06"));
    expect(spanOf(sent, earlier).origin).toBe("2026-02-02");
    expect(spanOf(sent, earlier).last).toBe(dateOfDay(dayNumber("2026-03-06") + AXIS_TAIL_DAYS));
    expect(spanOf(sent, later).origin).toBe("2026-03-02");
    expect(spanOf(sent, later).last).toBe(dateOfDay(dayNumber("2026-04-06") + AXIS_TAIL_DAYS));
  });

  test("reads a milestone's date and a range's start and end alike", () => {
    const sent = props(
      milestone("m", "web", "2026-06-10"),
      range("r", "web", "2026-06-12", "2026-06-20"),
    );
    expect(spanOf(sent, sent)).toEqual({
      origin: "2026-06-10",
      last: dateOfDay(dayNumber("2026-06-20") + AXIS_TAIL_DAYS),
    });
  });

  test("is one day and the tail from the first day when no entry holds a day", () => {
    const empty = props();
    expect(spanOf(empty, empty)).toEqual({
      origin: GANTT_FIRST_DATE,
      last: dateOfDay(dayNumber(GANTT_FIRST_DATE) + AXIS_TAIL_DAYS),
    });
  });

  test("stops at the last day a Gantt may name", () => {
    const sent = props(milestone("m", "web", "9999-12-31"));
    expect(spanOf(sent, sent)).toEqual({ origin: "9999-12-31", last: "9999-12-31" });
  });
});

describe("the opening zoom", () => {
  const year = props(
    range("a", "web", "2026-01-05", "2026-01-09"),
    range("b", "mobile", "2026-12-14", "2026-12-18"),
  );

  test("is month for a span of a year in a frame 900 pixels wide", () => {
    expect(openingZoomOf(year, 900)).toBe("month");
  });

  test("is the finest of day, week and month at which the span, tail included, fits", () => {
    const within = (days: number) =>
      props(
        range(
          "a",
          "web",
          "2026-01-05",
          dateOfDay(dayNumber("2026-01-05") + days - AXIS_TAIL_DAYS - 1),
        ),
      );
    // A span of 20 days, tail included: 20 * 32 = 640 pixels.
    expect(openingZoomOf(within(20), 900)).toBe("day");
    // 28 days: 896 at day zoom, which fits; 29 days: 928, which does not, and 435 at week.
    expect(openingZoomOf(within(28), 900)).toBe("day");
    expect(openingZoomOf(within(29), 900)).toBe("week");
    expect(openingZoomOf(within(60), 900)).toBe("week");
    expect(openingZoomOf(within(61), 900)).toBe("month");
    expect(PIXELS_PER_DAY).toEqual({ day: 32, week: 15, month: 4 });
  });

  test("takes the span of the props as sent, and month when nothing fits", () => {
    expect(openingZoomOf(year, 1)).toBe("month");
  });
});

describe("a label's estimate", () => {
  test("is 7 pixels a character, in code points", () => {
    expect(LABEL_CHAR_WIDTH).toBe(7);
    expect(labelWidth("")).toBe(0);
    expect(labelWidth("Launch")).toBe(42);
    expect(labelWidth("\u{1F600}\u{1F600}")).toBe(14);
  });

  test("is cut at 200 pixels", () => {
    expect(LABEL_MAX_WIDTH).toBe(200);
    expect(labelWidth("x".repeat(28))).toBe(196);
    expect(labelWidth("x".repeat(29))).toBe(200);
    expect(labelWidth("x".repeat(200))).toBe(200);
  });
});

describe("the tracks of a lane", () => {
  const overlapping = props(
    range("a", "web", "2026-01-05", "2026-01-09"),
    range("b", "web", "2026-01-07", "2026-01-12"),
    range("c", "web", "2026-02-02", "2026-02-06"),
  );

  test("hold two overlapping ranges on two tracks, and a third that overlaps neither on the first", () => {
    const tracks = Object.fromEntries(
      laidOut(overlapping).entries.map(({ id, track }) => [id, track]),
    );
    expect(tracks).toEqual({ a: 0, b: 1, c: 0 });
  });

  test("make the lane one row high per track, from the Gantt's row height", () => {
    const { lanes } = laidOut(overlapping);
    expect(TRACK_HEIGHT).toBe(32);
    expect(lanes.map(({ id, tracks, height }) => [id, tracks, height])).toEqual([
      ["web", 2, 64],
      ["mobile", 1, 32],
    ]);
    expect(lanes.map(({ top }) => top)).toEqual([AXIS_HEIGHT, AXIS_HEIGHT + 64]);
  });

  test("take entries in order of start, then of `entries`", () => {
    const given = props(
      range("late", "web", "2026-01-07", "2026-01-12"),
      range("early", "web", "2026-01-05", "2026-01-09"),
    );
    expect(placed(given, "early")?.track).toBe(0);
    expect(placed(given, "late")?.track).toBe(1);
    const tie = props(
      range("first", "web", "2026-01-05", "2026-01-09"),
      range("second", "web", "2026-01-05", "2026-01-09"),
    );
    expect(placed(tie, "first")?.track).toBe(0);
    expect(placed(tie, "second")?.track).toBe(1);
  });

  test("put an entry on the first track where its box overlaps no other", () => {
    const given = props(
      range("a", "web", "2026-01-05", "2026-01-30"),
      range("b", "web", "2026-01-07", "2026-01-12"),
      range("c", "web", "2026-01-14", "2026-01-20"),
      range("d", "web", "2026-01-08", "2026-01-25"),
    );
    const tracks = Object.fromEntries(laidOut(given).entries.map(({ id, track }) => [id, track]));
    // a holds track 0 to the 30th; b is on 1; d, starting the 8th, overlaps b: track 2; c, the 14th, clears b: track 1.
    expect(tracks).toEqual({ a: 0, b: 1, d: 2, c: 1 });
  });

  test("count a label after its shape as part of the box", () => {
    const given = props(
      milestone("m1", "web", "2026-01-05", "A milestone with a long label"),
      milestone("m2", "web", "2026-01-07", "Next"),
      milestone("m3", "web", "2026-01-30", "Far"),
    );
    // m1's label runs 200 pixels, over the five days (160px) between m1 and m3 and past m2.
    const tracks = Object.fromEntries(laidOut(given).entries.map(({ id, track }) => [id, track]));
    expect(tracks).toEqual({ m1: 0, m2: 1, m3: 0 });
  });

  test("count only the shape of a range that holds its label inside", () => {
    const given = props(
      range("r", "web", "2026-01-05", "2026-01-20", "Inside"),
      milestone("m", "web", "2026-01-21", "After"),
    );
    expect(placed(given, "r")?.label.inside).toBe(true);
    expect(placed(given, "m")?.track).toBe(0);
  });

  test("keep entries of different lanes apart", () => {
    const given = props(
      range("a", "web", "2026-01-05", "2026-01-09"),
      range("b", "mobile", "2026-01-05", "2026-01-09"),
    );
    expect(placed(given, "a")?.track).toBe(0);
    expect(placed(given, "b")?.track).toBe(0);
    expect(placed(given, "b")?.lane).toBe(1);
  });
});

describe("an entry's shape and label", () => {
  const given = props(
    range("wide", "web", "2026-01-05", "2026-01-09", "Checkout"),
    range("narrow", "web", "2026-01-15", "2026-01-15", "Release candidate"),
    milestone("launch", "mobile", "2026-01-10", "Launch"),
  );

  test("a range is a bar of its days, centred in its track, from the origin", () => {
    const bar = placed(given, "wide");
    expect(bar).toMatchObject({
      kind: "range",
      x: 0,
      width: 5 * 32,
      height: BAR_HEIGHT,
      y: AXIS_HEIGHT + (TRACK_HEIGHT - BAR_HEIGHT) / 2,
    });
  });

  test("a range shows its label inside when it fits there, padded", () => {
    const bar = placed(given, "wide");
    expect(bar?.label).toEqual({ x: 6, width: labelWidth("Checkout"), inside: true });
    expect(bar?.right).toBe(bar && bar.x + bar.width);
  });

  test("a range too short for its label shows it after the bar", () => {
    const bar = placed(given, "narrow");
    expect(bar?.label.inside).toBe(false);
    expect(bar?.label.x).toBe(bar && bar.x + bar.width + 6);
    expect(bar?.right).toBe(bar && bar.label.x + bar.label.width);
  });

  test("a milestone is a diamond centred in its day, with its label after it", () => {
    const diamond = placed(given, "launch");
    const day = xOf("2026-01-10", "2026-01-05", "day");
    expect(diamond).toMatchObject({
      kind: "milestone",
      x: day + 16 - MILESTONE_WIDTH / 2,
      width: MILESTONE_WIDTH,
      height: BAR_HEIGHT,
      lane: 1,
      track: 0,
    });
    expect(diamond?.label).toEqual({
      x: day + 16 + MILESTONE_WIDTH / 2 + 6,
      width: labelWidth("Launch"),
      inside: false,
    });
    // `web` holds one track, so `mobile` starts a row under the axis and the lane before it.
    expect(diamond?.y).toBe(AXIS_HEIGHT + TRACK_HEIGHT + (TRACK_HEIGHT - BAR_HEIGHT) / 2);
  });

  test("a label past 200 pixels is cut there in the box", () => {
    const long = props(milestone("m", "web", "2026-01-05", "x".repeat(150)));
    const diamond = placed(long, "m");
    expect(diamond?.label.width).toBe(200);
    expect(diamond?.right).toBe(diamond && diamond.label.x + 200);
  });

  test("each zoom takes its own pixels a day", () => {
    for (const zoom of ["day", "week", "month"] as const) {
      expect(placed(given, "wide", zoom)?.width).toBe(5 * PIXELS_PER_DAY[zoom]);
    }
  });
});

describe("the layout as a whole", () => {
  test("is as wide as its span, or as its farthest label if that runs past it", () => {
    const given = props(range("a", "web", "2026-01-05", "2026-01-09"));
    const span = spanOf(given, given);
    const days = dayNumber(span.last) - dayNumber(span.origin) + 1;
    expect(laidOut(given).width).toBe(days * 32);
    // At month zoom the tail is 56 pixels, and a long label runs past it.
    const late = props(milestone("m", "web", "2026-01-19", "x".repeat(150)));
    const out = laidOut(late, "month");
    expect(out.width).toBe(Math.max(...out.entries.map(({ right }) => right)));
    expect(out.width).toBeGreaterThan(15 * 4);
  });

  test("is the axis and the lanes high", () => {
    const given = props(
      range("a", "web", "2026-01-05", "2026-01-09"),
      range("b", "web", "2026-01-07", "2026-01-12"),
    );
    const out = laidOut(given);
    expect(out.axis).toBe(AXIS_HEIGHT);
    expect(out.height).toBe(AXIS_HEIGHT + 64 + 32);
  });

  test("leaves out an entry in no lane of the item, or with no days, which the contract refuses", () => {
    const given = props(
      range("ok", "web", "2026-01-05", "2026-01-09"),
      range("lost", "nowhere", "2026-01-05", "2026-01-09"),
      { id: "empty", label: "E", lane: "web" },
    );
    expect(laidOut(given).entries.map(({ id }) => id)).toEqual(["ok"]);
  });

  test("never has two boxes overlap on a track, whatever the entries (400 seeded layouts)", () => {
    for (let seed = 1; seed <= 400; seed++) {
      let state = seed >>> 0;
      const next = (count: number): number => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        return Math.floor((state / 4_294_967_296) * count);
      };
      const entries = Array.from({ length: 1 + next(25) }, (_, at): TimelineEntry => {
        const start = dateOfDay(dayNumber("2026-01-01") + next(120));
        const lane = LANES[next(2)]?.id as string;
        const label = "x".repeat(next(40));
        return next(2) === 0
          ? milestone(`e${at}`, lane, start, label)
          : range(`e${at}`, lane, start, dateOfDay(dayNumber(start) + next(30)), label);
      });
      const given = props(...entries);
      for (const zoom of ["day", "week", "month"] as const) {
        const out = laidOut(given, zoom);
        const byTrack = Map.groupBy(out.entries, ({ lane, track }) => `${lane}/${track}`);
        for (const [track, list] of byTrack) {
          const sorted = [...list].sort((a, b) => a.x - b.x);
          sorted.slice(1).forEach((entry, at) => {
            const before = sorted[at] as (typeof sorted)[number];
            expect({ seed, zoom, track, clear: before.right <= entry.x }).toEqual({
              seed,
              zoom,
              track,
              clear: true,
            });
          });
        }
        for (const entry of out.entries) {
          const lane = out.lanes[entry.lane];
          expect(entry.track).toBeLessThan(lane?.tracks ?? 0);
          expect(entry.right).toBeLessThanOrEqual(out.width);
        }
        expect(out.lanes.every(({ tracks }) => tracks >= 1)).toBe(true);
      }
    }
  });
});

describe("the lane under a y position", () => {
  const given = props(
    range("a", "web", "2026-01-05", "2026-01-09"),
    range("b", "web", "2026-01-07", "2026-01-12"),
  );
  const out = () => laidOut(given);

  test.each([
    [AXIS_HEIGHT, "web"],
    [AXIS_HEIGHT + 63, "web"],
    [AXIS_HEIGHT + 64, "mobile"],
    [AXIS_HEIGHT + 95, "mobile"],
  ])("y %p is in %s", (y, lane) => {
    expect(laneAt(out(), y)).toBe(lane);
  });

  test.each([-5, 0, AXIS_HEIGHT - 1, AXIS_HEIGHT + 96, 1e9, Number.NaN])(
    "y %p is in no lane",
    (y) => {
      expect(laneAt(out(), y)).toBeUndefined();
    },
  );
});
