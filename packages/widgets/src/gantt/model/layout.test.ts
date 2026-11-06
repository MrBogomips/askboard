import { describe, expect, test } from "bun:test";
import {
  AXIS_HEIGHT,
  arrowMarkerId,
  arrowPath,
  BAR_HEIGHT,
  BASELINE_GAP,
  BASELINE_HEIGHT,
  barBox,
  baselineBox,
  chartSpan,
  NOTE_HEIGHT,
  ROW_HEIGHT,
  rowBoxes,
} from "./layout.ts";

const ORIGIN = "2026-11-02";

describe("the chart's rows", () => {
  test("are 36px under a 32px axis, with bars of 14px, as the UJ-2 mock draws them", () => {
    expect([AXIS_HEIGHT, ROW_HEIGHT, BAR_HEIGHT, NOTE_HEIGHT]).toEqual([32, 36, 14, 20]);
  });

  test("stack under the axis, a row holding a note taller by one line", () => {
    expect(rowBoxes([false, true, false])).toEqual({
      boxes: [
        { top: 32, height: 36, middle: 50 },
        { top: 68, height: 56, middle: 86 },
        { top: 124, height: 36, middle: 142 },
      ],
      height: 160,
    });
  });

  test("leave only the axis when there is no row", () => {
    expect(rowBoxes([])).toEqual({ boxes: [], height: 32 });
  });
});

describe("a bar", () => {
  test("spans its calendar days from its start to its finish, both included, centred in its row", () => {
    const row = { top: 32, height: 36, middle: 50 };
    expect(barBox("2026-11-02", "2026-11-09", ORIGIN, "week", row)).toEqual({
      x: 0,
      y: 43,
      width: 120,
      height: 14,
    });
    expect(barBox("2026-11-10", "2026-11-16", ORIGIN, "week", row).x).toBe(120);
    expect(barBox("2026-11-10", "2026-11-10", ORIGIN, "day", row).width).toBe(32);
  });

  test("of a task of no duration, a milestone, is as wide as nothing, never negative", () => {
    const row = { top: 32, height: 36, middle: 50 };
    // A milestone finishes the working day before it starts: over a weekend, days before.
    expect(barBox("2026-11-09", "2026-11-06", ORIGIN, "day", row)).toMatchObject({
      x: 224,
      width: 0,
    });
    expect(barBox("2026-11-04", "2026-11-03", ORIGIN, "week", row).width).toBe(0);
  });
});

describe("a plan's baseline", () => {
  const row = { top: 32, height: 36, middle: 50 };

  test("is 4px high, 4px under its bar, past the change outline, and inside its row", () => {
    expect([BASELINE_HEIGHT, BASELINE_GAP]).toEqual([4, 4]);
    const bar = barBox("2026-11-02", "2026-11-09", ORIGIN, "week", row);
    const baseline = baselineBox("2026-11-02", "2026-11-09", ORIGIN, "week", row);
    expect(baseline).toEqual({ x: 0, y: 61, width: 120, height: 4 });
    expect(baseline.y - (bar.y + bar.height)).toBe(4);
    // The change outline, a 2px stroke 2px out from the bar, ends 3px under it.
    expect(baseline.y).toBeGreaterThan(bar.y + bar.height + 3);
    expect(baseline.y + baseline.height).toBeLessThanOrEqual(row.top + row.height);
  });

  test("spans the agent's days at each zoom, wherever the task's bar went", () => {
    expect(baselineBox("2026-12-04", "2026-12-11", ORIGIN, "week", row)).toMatchObject({
      x: 480,
      width: 120,
    });
    expect(baselineBox("2026-12-04", "2026-12-11", ORIGIN, "day", row)).toMatchObject({
      x: 1024,
      width: 256,
    });
    expect(baselineBox("2026-12-04", "2026-12-11", ORIGIN, "month", row)).toMatchObject({
      x: 128,
      width: 32,
    });
  });
});

describe("a finish-to-start arrow", () => {
  const box = (x: number, width: number, y: number) => ({ x, y, width, height: 14 });

  test("leaves the bar's end by an 8px stub, drops in the gap, and enters from the left", () => {
    // The channel runs 5px under the predecessor's bar, clear of the row's rule.
    expect(arrowPath(box(165, 105, 187), box(465, 120, 259))).toBe(
      "M270,194 h8 V206 H457 V266 H465",
    );
  });

  test("returns under its predecessor to a successor that starts at once", () => {
    expect(arrowPath(box(0, 120, 43), box(120, 45, 79))).toBe("M120,50 h8 V62 H112 V86 H120");
  });

  test("takes the gap above to a successor drawn above its predecessor", () => {
    expect(arrowPath(box(0, 120, 79), box(120, 45, 43))).toBe("M120,86 h8 V74 H112 V50 H120");
  });

  test("never runs along a row's rule: the channel is 6px clear of it either way", () => {
    // Bars of 14px in rows of 36px: a rule lies 11px under a bar's foot or over its top.
    const down = arrowPath(box(0, 50, 43), box(200, 50, 115));
    const up = arrowPath(box(0, 50, 115), box(200, 50, 43));
    expect(down.match(/V(\d+) H/)?.[1]).toBe("62");
    expect(up.match(/V(\d+) H/)?.[1]).toBe("110");
  });

  test("ends in a marker whose ID no other item's marker takes, whatever the two items' IDs", () => {
    // `a`'s critical marker and `a-critical`'s plain one must differ, and so on for any IDs.
    const ids = ["a", "a-critical", "a-arrow", "critical", "arrow", "a_critical", "critical-a"];
    const markers = ids.flatMap((id) => [arrowMarkerId(id, false), arrowMarkerId(id, true)]);
    expect(arrowMarkerId("a", true)).not.toBe(arrowMarkerId("a-critical", false));
    expect(new Set(markers).size).toBe(markers.length);
  });
});

describe("the chart's span", () => {
  test("runs from the plan's start to two weeks past the last finish", () => {
    expect(chartSpan(ORIGIN, ["2026-11-09", "2026-12-11", "2026-11-18"])).toEqual({
      origin: ORIGIN,
      last: "2026-12-25",
    });
  });

  test("holds two weeks when no task is scheduled", () => {
    expect(chartSpan(ORIGIN, [])).toEqual({ origin: ORIGIN, last: "2026-11-16" });
  });

  test("starts no later than a task that starts before the plan's start", () => {
    expect(chartSpan(ORIGIN, ["2026-11-03"], ["2026-10-30"]).origin).toBe("2026-10-30");
  });

  test("stops at the last day a Gantt may name", () => {
    expect(chartSpan("9999-12-20", ["9999-12-30"]).last).toBe("9999-12-31");
  });
});
