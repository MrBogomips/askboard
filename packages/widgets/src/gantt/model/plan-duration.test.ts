// A plan's requested duration in the model (`edits.ts`, `marks.ts`; widget-editing-plus design
// decisions 2 and 11; view spec, "Gantt plan duration resize" and "A requested duration is
// cleared by returning to the estimate"): `setDuration` on a plan sets the entry's `duration`, or
// clears it when it equals the effort-derived one; the result diffs to one `set`, counts once, and
// is marked as the user's.

import { describe, expect, test } from "bun:test";
import {
  elementChanges,
  GANTT_MAX_DURATION,
  GANTT_PLAN_SHAPE,
  type GanttPlanEntry,
  type TreeNode,
} from "@askboard/contract";
import {
  ganttPlanBoardDocument,
  ganttPlanRequestedChanges,
  ganttPlanRequestedValue,
} from "@askboard/contract/fixtures";
import { validateGanttProps } from "@askboard/contract/validate";
import { clearDuration, requestStart, sameGantt, setDuration } from "./edits.ts";
import { ganttMarks } from "./kinds.ts";
import { planChangeCount } from "./marks.ts";
import { type GanttPlanProps, planTaskRows } from "./tasks.ts";

const [question] = ganttPlanBoardDocument.items;
const PLAN = question.props.items[1].props as GanttPlanProps;

// The portal's estimates give 13 working days in the fixture.
const ESTIMATE = 13;

const entryOf = (value: GanttPlanProps, id: string): GanttPlanEntry | undefined =>
  Object.hasOwn(value.tasks, id) ? value.tasks[id] : undefined;

const planEntryOf = entryOf;

const changesOf = (value: GanttPlanProps) =>
  elementChanges("schedule", PLAN, value, GANTT_PLAN_SHAPE);

describe("a plan's requested duration", () => {
  test("lengthening a task sets the entry's duration and keeps its other fields", () => {
    const next = setDuration(PLAN, PLAN, "portal", 21, ESTIMATE);
    expect(entryOf(next, "portal")).toEqual({
      dependencies: ["architecture", "prototype"],
      duration: 21,
    });
    expect(next).toEqual(ganttPlanRequestedValue);
    expect(changesOf(next)).toEqual(ganttPlanRequestedChanges);
    expect(validateGanttProps(next, "edited")).toMatchObject({ ok: true });
    expect(Object.isFrozen(next.tasks)).toBe(true);
  });

  test("a task with no entry gets one holding only the duration", () => {
    const next = setDuration(PLAN, PLAN, "ux", 9, 6);
    expect(entryOf(next, "ux")).toEqual({ duration: 9 });
    expect(changesOf(next)).toEqual([{ op: "set", target: "schedule.ux.duration", value: 9 }]);
  });

  test("back to the estimate clears the request, and the entry once it holds nothing", () => {
    const lengthened = setDuration(PLAN, PLAN, "ux", 9, 6);
    const back = setDuration(lengthened, PLAN, "ux", 6, 6);
    expect(entryOf(back, "ux")).toBeUndefined();
    expect(sameGantt(back, PLAN)).toBe(true);
    const portal = setDuration(
      setDuration(PLAN, PLAN, "portal", 21, ESTIMATE),
      PLAN,
      "portal",
      ESTIMATE,
      ESTIMATE,
    );
    expect(sameGantt(portal, PLAN)).toBe(true);
    expect(portal).toEqual(PLAN);
  });

  test("a request the agent sent comes back as the agent's own", () => {
    const sent = ganttPlanRequestedValue;
    const changed = setDuration(sent, sent, "portal", 30, ESTIMATE);
    expect(changesOf(changed).length).toBe(1);
    const again = setDuration(changed, sent, "portal", 21, ESTIMATE);
    expect(again).toEqual(sent);
    expect(planEntryOf(again, "portal")).toBe(planEntryOf(sent, "portal"));
  });

  test("clearDuration drops the request, and does nothing where there is none", () => {
    const requested = setDuration(PLAN, PLAN, "portal", 21, ESTIMATE);
    const cleared = clearDuration(requested, PLAN, "portal");
    expect(sameGantt(cleared, PLAN)).toBe(true);
    expect(clearDuration(PLAN, PLAN, "ux")).toBe(PLAN);
  });

  test("a request cleared before the answer leaves no change", () => {
    const requested = setDuration(PLAN, PLAN, "billing", 20, 9);
    expect(planChangeCount(requested, PLAN)).toBe(1);
    expect(planChangeCount(clearDuration(requested, PLAN, "billing"), PLAN)).toBe(0);
  });

  test("whole days from 1 to 2,000 are taken; 0, 2,001 and 2.5 are refused", () => {
    for (const days of [0, GANTT_MAX_DURATION + 1, 2.5, Number.NaN]) {
      expect(() => setDuration(PLAN, PLAN, "ux", days, 6)).toThrow(RangeError);
    }
    expect(entryOf(setDuration(PLAN, PLAN, "ux", 1, 6), "ux")).toEqual({ duration: 1 });
    expect(entryOf(setDuration(PLAN, PLAN, "ux", GANTT_MAX_DURATION, 6), "ux")).toEqual({
      duration: GANTT_MAX_DURATION,
    });
  });

  test("a request with no estimate to compare with is kept as it is", () => {
    expect(entryOf(setDuration(PLAN, PLAN, "ux", 6, undefined), "ux")).toEqual({ duration: 6 });
  });

  test("the estimates' change afterwards leaves the request alone: the entry holds it as typed", () => {
    const requested = setDuration(PLAN, PLAN, "portal", 21, ESTIMATE);
    // The Tree's estimates change: nothing in the Gantt's value does.
    expect(requestStart(requested, PLAN, "ux", "2026-11-03")).toMatchObject({
      tasks: { portal: { duration: 21 } },
    });
  });
});

describe("a requested duration's marks and count", () => {
  const nodes = (question.props.items[0].props as { nodes: readonly TreeNode[] }).nodes;
  const rows = planTaskRows(PLAN, nodes, nodes);

  test("the task's duration is the user's change: marked, outlined and counted once", () => {
    const next = setDuration(PLAN, PLAN, "portal", 21, ESTIMATE);
    const { marks, count } = ganttMarks(next, PLAN, rows, [], []);
    expect(count).toBe(1);
    expect(marks.get("portal")).toMatchObject({ duration: true, changed: true });
    expect(marks.get("ux")).toMatchObject({ duration: false, changed: false });
  });

  test("a request cleared leaves the task unmarked", () => {
    const next = clearDuration(setDuration(PLAN, PLAN, "portal", 21, ESTIMATE), PLAN, "portal");
    const { marks, count } = ganttMarks(next, PLAN, rows, [], []);
    expect(count).toBe(0);
    expect(marks.get("portal")).toMatchObject({ duration: false, changed: false });
  });
});
