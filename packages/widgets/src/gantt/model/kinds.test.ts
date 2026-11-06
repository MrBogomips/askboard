import { describe, expect, test } from "bun:test";
import {
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanBoardDocument,
  ganttPlanEditedValue,
  treeEditedValue,
} from "@askboard/contract/fixtures";
import { ganttMarks, ganttRows } from "./kinds.ts";
import {
  changeCount,
  derivedCount,
  ownTaskMarks,
  planChangeCount,
  planTaskMarks,
} from "./marks.ts";
import type { Baseline, TaskSchedule } from "./schedule.ts";
import { type GanttOwnProps, type GanttPlanProps, ownTaskRows, planTaskRows } from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
const OWN = release.props as GanttOwnProps;
const EDITED = ganttEditedValue as GanttOwnProps;

const [planQuestion] = ganttPlanBoardDocument.items;
const [WBS, SCHEDULE] = planQuestion.props.items;
const PLAN = SCHEDULE.props as GanttPlanProps;
const TREE = { nodes: WBS.props.nodes, sentNodes: WBS.props.nodes };

/** Reporting moved to 12/9/2026 and nothing else: the plan's schedule beside its baseline. */
const scheduled = (startDate: string, finishDate: string, duration: number): TaskSchedule => ({
  kind: "scheduled",
  startDate,
  finishDate,
  duration,
  earliestDate: startDate,
  critical: false,
});

describe("a Gantt's rows, by its kind (design decision 8)", () => {
  test("a Gantt with its own tasks lists them", () => {
    expect(ganttRows(OWN, undefined)).toEqual(ownTaskRows(OWN));
  });

  test("a plan lists its Tree's leaves as the Tree stands", () => {
    expect(ganttRows(PLAN, TREE)).toEqual(planTaskRows(PLAN, TREE.nodes, TREE.sentNodes));
    const split = ganttRows(PLAN, { nodes: treeEditedValue.nodes, sentNodes: TREE.sentNodes });
    expect(split.map((row) => row.id)).toEqual([
      "ux",
      "architecture",
      "prototype",
      "portal",
      "u-1",
      "billing",
      "reporting",
    ]);
  });

  test("a plan without its Tree has no rows to give", () => {
    expect(() => ganttRows(PLAN, undefined)).toThrow(RangeError);
  });
});

describe("a Gantt's marks and the count its toolbar shows, by its kind", () => {
  test("a Gantt with its own tasks marks and counts each changed task", () => {
    const rows = ownTaskRows(EDITED);
    const { marks, count } = ganttMarks(EDITED, OWN, rows, [], undefined);
    expect(marks).toEqual(ownTaskMarks(EDITED, OWN));
    expect(count).toBe(changeCount(ownTaskMarks(EDITED, OWN)));
    expect(count).toBe(2);
  });

  test("a plan marks what its entries and its Tree changed, and counts only its own entries", () => {
    const rows = planTaskRows(ganttPlanEditedValue, treeEditedValue.nodes, TREE.sentNodes);
    const schedules = rows.map(() => scheduled("2026-11-02", "2026-11-09", 6));
    const baselines: (Baseline | undefined)[] = rows.map((row) =>
      row.id === "u-1"
        ? undefined
        : { startDate: "2026-11-02", finishDate: "2026-11-06", duration: 5 },
    );
    const { marks, count, derived } = ganttMarks(
      ganttPlanEditedValue,
      PLAN,
      rows,
      schedules,
      baselines,
    );
    expect(marks).toEqual(planTaskMarks(ganttPlanEditedValue, PLAN, rows, schedules, baselines));
    expect(marks.get("u-1")).toMatchObject({ added: true, dependencies: true, changed: true });
    expect(marks.get("ux")).toMatchObject({ derived: true, changed: false });
    expect(count).toBe(planChangeCount(ganttPlanEditedValue, PLAN));
    expect(derived).toBe(derivedCount(marks));
    expect(derived).toBeGreaterThan(0);
    expect(count).toBe(1);
  });

  test("a plan with no baseline marks no task re-estimated", () => {
    const rows = planTaskRows(PLAN, TREE.nodes, TREE.sentNodes);
    const { marks, count } = ganttMarks(PLAN, PLAN, rows, [], undefined);
    expect([...marks.values()].some((mark) => mark.changed)).toBe(false);
    expect(count).toBe(0);
  });

  test("a value and an agent's value of different kinds have no marks", () => {
    expect(() => ganttMarks(OWN, PLAN, [], [], undefined)).toThrow(RangeError);
    expect(() => ganttMarks(PLAN, OWN, [], [], undefined)).toThrow(RangeError);
  });
});
