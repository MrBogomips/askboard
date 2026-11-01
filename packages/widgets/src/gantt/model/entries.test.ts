import { describe, expect, test } from "bun:test";
import { ganttBoardDocument, ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { moveDrop } from "./drag.ts";
import { sameGantt } from "./edits.ts";
import { durationEntry, entryEcho, entryText, landOn, startEntry } from "./entries.ts";
import type { TaskSchedule } from "./schedule.ts";
import { type GanttOwnProps, type GanttPlanProps, ownTaskRows, planEntry } from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
const SENT = release.props as GanttOwnProps;
const ROWS = ownTaskRows(SENT);
const REPORTING = ROWS.find((row) => row.id === "reporting");

/** Reporting as the graph schedules the fixture: from 12/4/2026, its earliest start. */
const SCHEDULED: TaskSchedule = {
  kind: "scheduled",
  startDate: "2026-12-04",
  finishDate: "2026-12-11",
  duration: 6,
  earliestDate: "2026-12-04",
  critical: true,
};
const IN_ERROR: TaskSchedule = {
  kind: "error",
  error: { error: "cycle", address: "release.x.es" },
};

const taskOf = (value: GanttOwnProps, id: string) => value.tasks.find((task) => task.id === id);

const [planQuestion] = ganttPlanBoardDocument.items;
const [, schedule] = planQuestion.props.items;
// The fixture plan: reporting's entry holds its predecessor, the portal.
const PLAN = schedule.props as GanttPlanProps;

describe("a typed start", () => {
  test("requests a later working day", () => {
    const entry = startEntry(SENT, SENT, "reporting", SCHEDULED, " 12/9/2026 ");
    expect(entry.kind).toBe("value");
    if (entry.kind === "value") expect(taskOf(entry.value, "reporting")?.start).toBe("2026-12-09");
  });

  test("refuses a day before the earliest start, naming it", () => {
    expect(startEntry(SENT, SENT, "reporting", SCHEDULED, "11/20/2026")).toEqual({
      kind: "refused",
      reason: "The earliest start its predecessors allow is 12/4/2026.",
    });
  });

  test("refuses a Saturday or a Sunday", () => {
    expect(startEntry(SENT, SENT, "reporting", SCHEDULED, "12/12/2026")).toEqual({
      kind: "refused",
      reason: "12/12/2026 is not a working day: pick a day from Monday to Friday.",
    });
    expect(startEntry(SENT, SENT, "reporting", SCHEDULED, "2026-12-13").kind).toBe("refused");
  });

  test("refuses what is no day, with the parser's reason", () => {
    expect(startEntry(SENT, SENT, "reporting", SCHEDULED, "2/30/2026")).toEqual({
      kind: "refused",
      reason: "February 2026 has no day 30",
    });
  });

  test("changes nothing when it is the day the task starts on", () => {
    expect(startEntry(SENT, SENT, "reporting", SCHEDULED, "12/4/2026")).toEqual({
      kind: "value",
      value: SENT,
    });
  });

  test("clears the request when empty, or when it is the earliest start", () => {
    const moved = startEntry(SENT, SENT, "reporting", SCHEDULED, "12/9/2026");
    if (moved.kind !== "value") throw new Error("not moved");
    const later = { ...SCHEDULED, startDate: "2026-12-09", finishDate: "2026-12-16" };
    expect(startEntry(moved.value, SENT, "reporting", later, "")).toEqual({
      kind: "value",
      value: SENT,
    });
    const back = startEntry(moved.value, SENT, "reporting", later, "12/4/2026");
    expect(back.kind === "value" && taskOf(back.value, "reporting")).toBe(
      taskOf(SENT, "reporting"),
    );
  });

  test("takes any working day for a task the graph cannot schedule", () => {
    const entry = startEntry(SENT, SENT, "reporting", IN_ERROR, "11/3/2026");
    expect(entry.kind === "value" && taskOf(entry.value, "reporting")?.start).toBe("2026-11-03");
  });
});

describe("landing on a day", () => {
  test("requests it, or, on the earliest start, holds no request", () => {
    expect(
      taskOf(landOn(SENT, SENT, "reporting", "2026-12-10", "2026-12-04"), "reporting")?.start,
    ).toBe("2026-12-10");
    expect(landOn(SENT, SENT, "reporting", "2026-12-04", "2026-12-04")).toBe(SENT);
  });

  test("keeps the agent's own request when the agent asked for the earliest start", () => {
    const agent = {
      ...SENT,
      tasks: SENT.tasks.map((task) => (task.id === "ux" ? { ...task, start: "2026-11-02" } : task)),
    };
    const moved = landOn(agent, agent, "ux", "2026-11-04", "2026-11-02");
    expect(landOn(moved, agent, "ux", "2026-11-02", "2026-11-02").tasks[0]).toBe(agent.tasks[0]);
  });
});

/** The fixture Gantt with the agent's request for reporting's start. */
const askedFor = (start: string): GanttOwnProps => ({
  ...SENT,
  tasks: SENT.tasks.map((task) => (task.id === "reporting" ? { ...task, start } : task)),
});

/** Reporting moved from where the agent's request put it to Wednesday 12/9/2026. */
const MOVED_LATER: TaskSchedule = {
  ...SCHEDULED,
  startDate: "2026-12-09",
  finishDate: "2026-12-16",
};

describe("an agent's request for a day the task does not start on", () => {
  // Before the earliest start the portal allows: the graph schedules it on 12/4/2026.
  test("before the earliest start: a drop on the bar's own day, a drag back and the typed day keep it", () => {
    const agent = askedFor("2026-11-20");
    const wiggle = moveDrop({ start: "2026-12-04", earliest: "2026-12-04", dx: 5, zoom: "week" });
    expect(wiggle.kind).not.toBe("click");
    if (wiggle.kind === "click") return;
    expect(landOn(agent, agent, "reporting", wiggle.start, "2026-12-04")).toBe(agent);
    const moved = landOn(agent, agent, "reporting", "2026-12-09", "2026-12-04");
    expect(taskOf(moved, "reporting")?.start).toBe("2026-12-09");
    const back = landOn(moved, agent, "reporting", "2026-12-04", "2026-12-04");
    expect(taskOf(back, "reporting")).toBe(taskOf(agent, "reporting"));
    expect(sameGantt(back, agent)).toBe(true);
    const typed = startEntry(moved, agent, "reporting", MOVED_LATER, "12/4/2026");
    expect(typed.kind === "value" && taskOf(typed.value, "reporting")).toBe(
      taskOf(agent, "reporting"),
    );
  });

  // On Saturday 12/5/2026: the graph schedules it on Monday 12/7/2026, after its earliest start.
  test("on a Saturday: a drop on the bar's own day, a drag back and the typed day keep it", () => {
    const agent = askedFor("2026-12-05");
    const wiggle = moveDrop({ start: "2026-12-07", earliest: "2026-12-04", dx: 5, zoom: "week" });
    expect(wiggle.kind).not.toBe("click");
    if (wiggle.kind === "click") return;
    expect(landOn(agent, agent, "reporting", wiggle.start, "2026-12-04")).toBe(agent);
    const moved = landOn(agent, agent, "reporting", "2026-12-09", "2026-12-04");
    const back = landOn(moved, agent, "reporting", "2026-12-07", "2026-12-04");
    expect(taskOf(back, "reporting")).toBe(taskOf(agent, "reporting"));
    expect(sameGantt(back, agent)).toBe(true);
    const typed = startEntry(moved, agent, "reporting", MOVED_LATER, "12/7/2026");
    expect(typed.kind === "value" && taskOf(typed.value, "reporting")).toBe(
      taskOf(agent, "reporting"),
    );
    // Its earliest start is another day: a drop there still clears the request.
    expect(
      taskOf(landOn(agent, agent, "reporting", "2026-12-04", "2026-12-04"), "reporting")?.start,
    ).toBeUndefined();
  });

  test("with no earliest start, the first working day from the request keeps it", () => {
    const agent = askedFor("2026-12-05");
    const moved = landOn(agent, agent, "reporting", "2026-12-09", undefined);
    expect(taskOf(landOn(moved, agent, "reporting", "2026-12-07", undefined), "reporting")).toBe(
      taskOf(agent, "reporting"),
    );
  });

  test("in a plan's entry, on a Saturday: a drag back keeps it", () => {
    const agent: GanttPlanProps = {
      ...PLAN,
      tasks: { ...PLAN.tasks, reporting: { start: "2026-12-05", dependencies: ["portal"] } },
    };
    expect(landOn(agent, agent, "reporting", "2026-12-07", "2026-12-04")).toBe(agent);
    const moved = landOn(agent, agent, "reporting", "2026-12-09", "2026-12-04");
    expect(
      planEntry(landOn(moved, agent, "reporting", "2026-12-07", "2026-12-04"), "reporting"),
    ).toBe(planEntry(agent, "reporting"));
  });
});

describe("a typed duration", () => {
  test("sets whole working days", () => {
    const entry = durationEntry(SENT, SENT, "billing", "30");
    expect(
      entry.kind === "value" && taskOf(entry.value as GanttOwnProps, "billing")?.duration,
    ).toBe(30);
  });

  test.each(["2.5", "0", "2001", ""])("refuses %p, saying a duration is whole", (text) => {
    expect(durationEntry(SENT, SENT, "billing", text)).toEqual({
      kind: "refused",
      reason: "A duration is a whole number of working days, from 1 to 2,000.",
    });
  });

  test("refuses what is no number, with the parser's reason", () => {
    const entry = durationEntry(SENT, SENT, "billing", "ten");
    expect(entry.kind).toBe("refused");
    expect(entry.kind === "refused" && entry.reason).toContain("not part of a number");
  });
});

describe("an editor", () => {
  test("opens on the task's start as the grid shows it, or its duration", () => {
    if (REPORTING === undefined) throw new Error("no reporting row");
    expect(entryText("start", REPORTING, SCHEDULED)).toBe("12/4/2026");
    expect(entryText("start", REPORTING, IN_ERROR)).toBe("");
    expect(entryText("start", { ...REPORTING, start: "2026-12-09" }, IN_ERROR)).toBe("12/9/2026");
    expect(entryText("duration", REPORTING, SCHEDULED)).toBe("6");
    expect(entryText("duration", { ...REPORTING, duration: undefined }, SCHEDULED)).toBe("");
  });

  test("echoes the day or the number it reads, and nothing for what it refuses", () => {
    expect(entryEcho("start", "12/9/2026")).toBe("= Wed, Dec 9, 2026");
    expect(entryEcho("start", "12/9")).toBeUndefined();
    expect(entryEcho("start", "")).toBeUndefined();
    expect(entryEcho("duration", "1,200")).toBe("= 1200");
    expect(entryEcho("duration", "x")).toBeUndefined();
  });
});

describe("in a Gantt plan (design decision 8)", () => {
  test("a typed start requests the day in the task's entry, beside its predecessors", () => {
    const entry = startEntry(PLAN, PLAN, "reporting", SCHEDULED, "12/9/2026");
    expect(entry.kind === "value" && planEntry(entry.value, "reporting")).toEqual({
      start: "2026-12-09",
      dependencies: ["portal"],
    });
    expect(startEntry(PLAN, PLAN, "reporting", SCHEDULED, "11/20/2026").kind).toBe("refused");
  });

  test("a bar landed later requests the day; back on its earliest start, the agent's entry", () => {
    const moved = landOn(PLAN, PLAN, "reporting", "2026-12-09", "2026-12-04");
    expect(planEntry(moved, "reporting")?.start).toBe("2026-12-09");
    expect(landOn(moved, PLAN, "reporting", "2026-12-04", "2026-12-04")).toEqual(PLAN);
    expect(landOn(PLAN, PLAN, "reporting", "2026-12-04", "2026-12-04")).toBe(PLAN);
  });

  test("a task with no entry gets one with its request, and loses it on its earliest start", () => {
    const moved = landOn(PLAN, PLAN, "ux", "2026-11-04", "2026-11-02");
    expect(planEntry(moved, "ux")).toEqual({ start: "2026-11-04" });
    expect(landOn(moved, PLAN, "ux", "2026-11-02", "2026-11-02")).toEqual(PLAN);
  });

  test("keeps the agent's own request when the agent asked for the earliest start", () => {
    const agent: GanttPlanProps = {
      ...PLAN,
      tasks: { ...PLAN.tasks, ux: { start: "2026-11-02" } },
    };
    const moved = landOn(agent, agent, "ux", "2026-11-04", "2026-11-02");
    expect(planEntry(landOn(moved, agent, "ux", "2026-11-02", "2026-11-02"), "ux")).toBe(
      planEntry(agent, "ux"),
    );
  });

  test("a typed duration is refused: a plan's durations follow its work packages' estimates", () => {
    expect(durationEntry(PLAN, PLAN, "billing", "11")).toEqual({
      kind: "refused",
      reason: "A plan's durations follow its work packages' estimates in its Tree.",
    });
  });
});
