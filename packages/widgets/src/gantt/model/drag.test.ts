import { describe, expect, test } from "bun:test";
import { GANTT_MAX_DURATION } from "@askboard/contract";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import { DRAG_THRESHOLD, moveDrop, resizeDrop } from "./drag.ts";
import { clearStart, requestStart, sameGantt } from "./edits.ts";
import type { GanttOwnProps } from "./tasks.ts";

const SENT = ganttBoardDocument.items[0].props.items[0].props as GanttOwnProps;

// Reporting as the fixture schedules it: it starts on its earliest start, Friday 2026-12-04.
const REPORTING = { start: "2026-12-04", earliest: "2026-12-04" } as const;

describe("moving a bar", () => {
  test.each([
    [75, "week", { kind: "request", start: "2026-12-09" }, "five days later"],
    [120, "week", { kind: "request", start: "2026-12-14" }, "over Saturday 12/12: Monday"],
    [128, "week", { kind: "request", start: "2026-12-14" }, "over Sunday 12/13: Monday"],
    [8, "week", { kind: "request", start: "2026-12-07" }, "past half a day: the next day"],
    [7, "week", { kind: "clear", start: "2026-12-04" }, "short of half a day: the same day"],
    [3, "week", { kind: "clear", start: "2026-12-04" }, "at the threshold: no click"],
    [-45, "week", { kind: "clear", start: "2026-12-04" }, "before the earliest start"],
    [-1e9, "week", { kind: "clear", start: "2026-12-04" }, "far before any day"],
    [1e12, "week", { kind: "request", start: "9999-12-31" }, "past the last day"],
    [96, "day", { kind: "request", start: "2026-12-07" }, "three days at day zoom"],
    [20, "month", { kind: "request", start: "2026-12-09" }, "five days at month zoom"],
  ] as const)("by %p px at %s zoom lands as %j: %s", (dx, zoom, move) => {
    expect(moveDrop({ ...REPORTING, dx, zoom })).toEqual(move);
  });

  test.each([0, 2, -2.9, DRAG_THRESHOLD - 0.1])("by %p px is a click", (dx) => {
    expect(DRAG_THRESHOLD).toBe(3);
    expect(moveDrop({ ...REPORTING, dx, zoom: "day" })).toEqual({ kind: "click" });
  });

  test("of a requested task back onto its earliest start clears the request", () => {
    const requested = { start: "2026-12-09", earliest: "2026-12-04" };
    expect(moveDrop({ ...requested, dx: -75, zoom: "week" })).toEqual({
      kind: "clear",
      start: "2026-12-04",
    });
    expect(moveDrop({ ...requested, dx: -30, zoom: "week" })).toEqual({
      kind: "request",
      start: "2026-12-07",
    });
  });

  test("later and back onto the earliest start leaves the agent's value", () => {
    const later = moveDrop({ ...REPORTING, dx: 75, zoom: "week" });
    expect(later.kind).toBe("request");
    const value = requestStart(SENT, SENT, "reporting", (later as { start: string }).start);
    const back = moveDrop({ start: "2026-12-09", earliest: "2026-12-04", dx: -75, zoom: "week" });
    expect(back.kind).toBe("clear");
    expect(sameGantt(clearStart(value, SENT, "reporting"), SENT)).toBe(true);
  });

  test("before the predecessors allow stops at the earliest start and changes nothing", () => {
    expect(moveDrop({ ...REPORTING, dx: -150, zoom: "week" }).kind).toBe("clear");
    expect(clearStart(SENT, SENT, "reporting")).toBe(SENT);
  });

  test("gives frozen results", () => {
    expect(Object.isFrozen(moveDrop({ ...REPORTING, dx: 75, zoom: "week" }))).toBe(true);
    expect(Object.isFrozen(moveDrop({ ...REPORTING, dx: -75, zoom: "week" }))).toBe(true);
    expect(Object.isFrozen(moveDrop({ ...REPORTING, dx: 1, zoom: "week" }))).toBe(true);
  });
});

// UX design as the fixture schedules it: six working days, Monday 2026-11-02 to Monday 2026-11-09.
const UX = { start: "2026-11-02", finish: "2026-11-09" } as const;

describe("resizing a bar", () => {
  test.each([
    [30, "week", 8, "two working days to the right"],
    [15, "week", 7, "one day to the right"],
    [-30, "week", 5, "back onto Saturday: to Friday"],
    [-45, "week", 5, "back onto Friday"],
    [-105, "week", 1, "back onto its start"],
    [-120, "week", 1, "back before its start"],
    [64, "day", 8, "two days at day zoom"],
    [8, "month", 8, "two days at month zoom"],
    [1e12, "week", GANTT_MAX_DURATION, "past the longest duration"],
  ] as const)("by %p px at %s zoom lasts %i days: %s", (dx, zoom, duration) => {
    expect(resizeDrop({ ...UX, dx, zoom })).toEqual({ kind: "duration", duration });
  });

  test("of a one-day task to the left keeps one day", () => {
    const oneDay = { start: "2026-11-02", finish: "2026-11-02" };
    expect(resizeDrop({ ...oneDay, dx: -15, zoom: "week" })).toEqual({
      kind: "duration",
      duration: 1,
    });
  });

  test.each([0, 2.9, -2])("by %p px is a click", (dx) => {
    expect(resizeDrop({ ...UX, dx, zoom: "week" })).toEqual({ kind: "click" });
  });

  test("gives frozen results", () => {
    expect(Object.isFrozen(resizeDrop({ ...UX, dx: 30, zoom: "week" }))).toBe(true);
  });
});
