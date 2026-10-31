import { describe, expect, test } from "bun:test";
import {
  AXIS_HEIGHT,
  arrowPath,
  BAR_HEIGHT,
  barBox,
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
});

describe("a finish-to-start arrow", () => {
  const box = (x: number, width: number, y: number) => ({ x, y, width, height: 14 });

  test("runs straight to just before a successor that starts well after, then down and in", () => {
    expect(arrowPath(box(165, 105, 187), box(465, 120, 259))).toBe("M270,194 H449 V266 H465");
  });

  test("elbows back under its predecessor to a successor that starts at once, as in the mock", () => {
    expect(arrowPath(box(0, 120, 43), box(120, 45, 79))).toBe("M120,50 h5 V62 H111 V86 H120");
  });

  test("elbows up to a successor drawn above its predecessor", () => {
    expect(arrowPath(box(0, 120, 79), box(120, 45, 43))).toBe("M120,86 h5 V74 H111 V50 H120");
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
