import { describe, expect, test } from "bun:test";
import type { NodeResult } from "@askboard/compute";
import { GANTT_ANSWER_DERIVED } from "@askboard/contract";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { type BoardGraph, liveGraph } from "../../graph/board-graph.ts";
import { answerDerived, planFinish, scheduleOf, taskSchedule } from "./schedule.ts";
import { type GanttOwnProps, ownTaskRows } from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const ITEMS = question.props.items;
const [release] = ITEMS;
const SENT = release.props as GanttOwnProps;

const graphOf = (value: unknown): BoardGraph => {
  const graph = liveGraph({ items: ITEMS, draft: new Map([["release", value]]) });
  if (graph === undefined) throw new Error("no graph");
  return graph;
};

const SENT_GRAPH = graphOf(undefined);

describe("a Gantt's schedule", () => {
  test.each([
    ["ux", "2026-11-02", "2026-11-09", 6, "2026-11-02", true],
    ["architecture", "2026-11-02", "2026-11-05", 4, "2026-11-02", false],
    ["prototype", "2026-11-10", "2026-11-16", 5, "2026-11-10", true],
    ["portal", "2026-11-17", "2026-12-03", 13, "2026-11-17", true],
    ["billing", "2026-11-06", "2026-11-18", 9, "2026-11-06", false],
    ["reporting", "2026-12-04", "2026-12-11", 6, "2026-12-04", true],
  ])(
    "reads %s from the graph: %s to %s, %i days, earliest %s, critical %p",
    (id, startDate, finishDate, duration, earliestDate, critical) => {
      expect(taskSchedule(SENT_GRAPH, "release", id)).toEqual({
        kind: "scheduled",
        startDate,
        finishDate,
        duration,
        earliestDate,
        critical,
      });
    },
  );

  test("gives each row its schedule, in the rows' order", () => {
    const rows = ownTaskRows(SENT);
    const schedules = scheduleOf(SENT_GRAPH, "release", rows);
    expect(schedules.map((s) => (s.kind === "scheduled" ? s.startDate : s.kind))).toEqual([
      "2026-11-02",
      "2026-11-02",
      "2026-11-10",
      "2026-11-17",
      "2026-11-06",
      "2026-12-04",
    ]);
    expect(Object.isFrozen(schedules)).toBe(true);
    expect(schedules.every((schedule) => Object.isFrozen(schedule))).toBe(true);
  });

  test("reads the plan's finish", () => {
    expect(planFinish(SENT_GRAPH, "release")).toBe("2026-12-11");
  });

  test("gives the answer's derived values by GANTT_ANSWER_DERIVED", () => {
    const derived = answerDerived(SENT_GRAPH, "release", ownTaskRows(SENT));
    expect(derived).toEqual({
      "release.finish": "2026-12-11",
      "release.criticalPath": ["ux", "prototype", "portal", "reporting"],
    });
    expect(Object.keys(derived)).toEqual(
      Object.keys(GANTT_ANSWER_DERIVED).map((key) => `release.${key}`),
    );
    expect(Object.isFrozen(derived)).toBe(true);
    expect(Object.isFrozen(derived["release.criticalPath"])).toBe(true);
  });

  test("follows the edits: a requested start keeps its earliest start", () => {
    const graph = graphOf(ganttEditedValue);
    expect(taskSchedule(graph, "release", "reporting")).toEqual({
      kind: "scheduled",
      startDate: "2026-12-09",
      finishDate: "2026-12-16",
      duration: 6,
      earliestDate: "2026-12-04",
      critical: true,
    });
    expect(taskSchedule(graph, "release", "billing")).toMatchObject({ duration: 11 });
    // Reporting's wait gives the portal three days of slack: only reporting stays critical.
    expect(answerDerived(graph, "release", ownTaskRows(ganttEditedValue))).toEqual({
      "release.finish": "2026-12-16",
      "release.criticalPath": ["reporting"],
    });
  });

  describe("in error", () => {
    const CYCLE = {
      start: "2026-11-02",
      tasks: [
        { id: "a", label: "A", duration: 2, dependencies: ["b"] },
        { id: "b", label: "B", duration: 2, dependencies: ["a"] },
        { id: "c", label: "C", duration: 3 },
      ],
    };

    test("gives a task on a cycle its error and kind, and schedules the others", () => {
      const graph = graphOf(CYCLE);
      expect(taskSchedule(graph, "release", "a")).toMatchObject({
        kind: "error",
        error: { error: "cycle" },
      });
      expect(taskSchedule(graph, "release", "b")).toMatchObject({ kind: "error" });
      // The plan's end reads every task, so no task's slack, and no critical flag, is known.
      expect(taskSchedule(graph, "release", "c")).toEqual({
        kind: "scheduled",
        startDate: "2026-11-02",
        finishDate: "2026-11-04",
        duration: 3,
        earliestDate: "2026-11-02",
        critical: false,
      });
    });

    test("gives a task with an unknown predecessor a missing-reference error", () => {
      const tasks = [
        { id: "a", label: "A", duration: 2 },
        { id: "c", label: "C", duration: 3, dependencies: ["nope"] },
      ];
      const graph = graphOf({ start: "2026-11-02", tasks });
      expect(taskSchedule(graph, "release", "c")).toMatchObject({
        kind: "error",
        error: { error: "missing-reference" },
      });
      expect(taskSchedule(graph, "release", "a")).toMatchObject({ kind: "scheduled" });
    });

    test("leaves the derived values in error out", () => {
      const graph = graphOf(CYCLE);
      expect(planFinish(graph, "release")).toMatchObject({ error: "cycle" });
      expect(answerDerived(graph, "release", ownTaskRows(CYCLE))).toEqual({});
    });

    test("gives a task the graph does not hold a missing-reference error", () => {
      expect(taskSchedule(SENT_GRAPH, "release", "nope")).toMatchObject({
        kind: "error",
        error: { error: "missing-reference", address: "release.nope.startDate" },
      });
    });

    // A graph whose nodes read as values of the wrong type, which `compute` never gives.
    const stub = (values: Record<string, NodeResult>): BoardGraph => ({
      read: (address) =>
        values[address] ?? { error: "missing-reference", address, detail: `no node ${address}` },
      warnings: [],
    });

    test("reads a value of the wrong type as a value error", () => {
      const graph = stub({
        "g.t.startDate": "2026-11-02",
        "g.t.finishDate": "2026-11-02",
        "g.t.duration": "1",
        "g.t.earliestDate": "2026-11-02",
        "g.t.critical": true,
        "g.finishDate": 3,
      });
      expect(taskSchedule(graph, "g", "t")).toEqual({
        kind: "error",
        error: { error: "value", address: "g.t.duration", detail: "not a number" },
      });
      expect(planFinish(graph, "g")).toEqual({
        error: "value",
        address: "g.finishDate",
        detail: "not a date",
      });
    });

    test("leaves the critical path out when a critical flag is no boolean", () => {
      const graph = stub({ "g.finishDate": "2026-11-02", "g.t.critical": 1, "g.u.critical": true });
      expect(answerDerived(graph, "g", [{ id: "u" }, { id: "t" }])).toEqual({
        "g.finish": "2026-11-02",
      });
    });
  });
});
