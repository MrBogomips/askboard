import { describe, expect, test } from "bun:test";
import { EN_US_SAY } from "../en-us.ts";
import { scheduleNote } from "./notes.ts";
import type { TaskSchedule } from "./schedule.ts";
import type { GanttRow } from "./tasks.ts";

const row = (id: string, dependencies: readonly string[]): GanttRow => ({
  id,
  label: id.toUpperCase(),
  sent: true,
  start: undefined,
  duration: 2,
  dependencies,
  cells: [],
});

const LABELS = new Map([
  ["a", "Design"],
  ["b", "Build"],
  ["c", "Ship"],
]);

const error = (kind: string, address: string): TaskSchedule => ({
  kind: "error",
  error: { error: kind as "cycle", address },
});

describe("the field error under a task the graph cannot schedule", () => {
  test("says nothing for a scheduled task", () => {
    const scheduled: TaskSchedule = {
      kind: "scheduled",
      startDate: "2026-11-02",
      finishDate: "2026-11-03",
      duration: 2,
      earliestDate: "2026-11-02",
      critical: false,
    };
    expect(scheduleNote("g", row("a", []), scheduled, LABELS, EN_US_SAY)).toBeUndefined();
    expect(scheduleNote("g", row("a", []), undefined, LABELS, EN_US_SAY)).toBeUndefined();
  });

  test("says a task's own predecessors form a cycle", () => {
    expect(scheduleNote("g", row("a", ["b"]), error("cycle", "g.a.es"), LABELS, EN_US_SAY)).toBe(
      "No dates: its predecessors form a cycle.",
    );
  });

  test("names a predecessor the Gantt does not hold", () => {
    expect(
      scheduleNote(
        "g",
        row("a", ["b", "ghost"]),
        error("missing-reference", "g.a.es"),
        LABELS,
        EN_US_SAY,
      ),
    ).toBe("No dates: its predecessor ghost names no task.");
    expect(
      scheduleNote(
        "g",
        row("a", ["x", "y"]),
        error("missing-reference", "g.a.es"),
        LABELS,
        EN_US_SAY,
      ),
    ).toBe("No dates: its predecessors x, y name no task.");
  });

  test("names the task an error comes from, for a task that follows it", () => {
    expect(scheduleNote("g", row("c", ["a"]), error("cycle", "g.a.ef"), LABELS, EN_US_SAY)).toBe(
      "No dates: it follows Design, which has none.",
    );
    expect(
      scheduleNote("g", row("c", ["q"]), error("missing-reference", "g.q.ef"), LABELS, EN_US_SAY),
    ).toBe("No dates: it follows q, which has none.");
  });

  test("says the schedule could not be computed for any other error", () => {
    expect(
      scheduleNote("g", row("a", []), error("value", "g.a.startDate"), LABELS, EN_US_SAY),
    ).toBe("No dates: the schedule could not be computed.");
    expect(scheduleNote("g", row("a", []), error("value", "elsewhere"), LABELS, EN_US_SAY)).toBe(
      "No dates: the schedule could not be computed.",
    );
  });
});
