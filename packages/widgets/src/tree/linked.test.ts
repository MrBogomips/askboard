import { describe, expect, test } from "bun:test";
import { GANTT_MAX_DEPENDENTS, GANTT_MAX_PREDECESSORS, GANTT_MAX_TASKS } from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { BoardContent } from "@askboard/view/catalog";
import { type Say, say } from "@askboard/view/catalog";
import type { GanttPlanProps } from "../gantt/model/tasks.ts";
import { linkedAdd, linkedDelete, linkedDependents, refusalText } from "./linked.ts";
import { addAfter, addChild, remove } from "./model/edits.ts";

const EN: Say = (key, slots) => say("en-US", key, slots);

// The expanded UJ-2 board: the WBS `wbs__tree` and the plan `schedule__plan` over it, whose
// entries are prototype [ux], portal [architecture, prototype], billing [architecture] and
// reporting [portal].
const [question] = uj2ExpandedBoardDocument.items;
const [WBS, PLAN] = question.props.items;
const SENT_PLAN = PLAN.props as GanttPlanProps;
const SENT = WBS.props;

const board = (shown: ReadonlyMap<string, unknown> = new Map()): BoardContent => ({
  items: [WBS, PLAN],
  draft: shown,
  shown,
});

const DASHBOARDS = "Customer portal: dashboards";
const SPLIT = addAfter(SENT, "portal", DASHBOARDS);

describe("a package added in a Tree a plan names (view spec, An added package's predecessors)", () => {
  test("puts the Tree's value and the plan's in one update, the package after the portal depending on the portal's predecessors", () => {
    expect(linkedAdd(board(), WBS.id, SENT, SPLIT, "u-1", "portal", EN)).toEqual({
      ok: true,
      values: {
        [WBS.id]: SPLIT,
        [PLAN.id]: {
          ...SENT_PLAN,
          tasks: { ...SENT_PLAN.tasks, "u-1": { dependencies: ["architecture", "prototype"] } },
        },
      },
    });
  });

  test("gives a child the predecessors of the package it was added under", () => {
    const next = addChild(SENT, "reporting", "Reporting: exports");
    const write = linkedAdd(board(), WBS.id, SENT, next, "u-1", "reporting", EN);
    expect(write.ok && write.values[PLAN.id]).toEqual({
      ...SENT_PLAN,
      tasks: { ...SENT_PLAN.tasks, "u-1": { dependencies: ["portal"] } },
    });
  });

  test("names only the Tree when the anchor has no predecessors, or there is no anchor", () => {
    const next = addAfter(SENT, "ux", "Research");
    expect(linkedAdd(board(), WBS.id, SENT, next, "u-1", "ux", EN)).toEqual({
      ok: true,
      values: { [WBS.id]: next },
    });
    expect(linkedAdd(board(), WBS.id, SENT, SPLIT, "u-1", undefined, EN)).toEqual({
      ok: true,
      values: { [WBS.id]: SPLIT },
    });
  });

  test("gives the Tree `undefined` once its nodes are the agent's", () => {
    expect(linkedAdd(board(), WBS.id, SENT, SENT, "u-1", "ux", EN)).toEqual({
      ok: true,
      values: { [WBS.id]: undefined },
    });
  });

  test("is refused, naming the limit and the task past it, when the plan's edit would pass a limit", () => {
    const crowded = Object.fromEntries(
      Array.from({ length: GANTT_MAX_DEPENDENTS - 1 }, (_, at) => [
        `t-${at + 1}`,
        { dependencies: ["prototype"] },
      ]),
    );
    const plan = { ...SENT_PLAN, tasks: { ...SENT_PLAN.tasks, ...crowded } };
    expect(
      linkedAdd(board(new Map([[PLAN.id, plan]])), WBS.id, SENT, SPLIT, "u-1", "portal", EN),
    ).toEqual({
      ok: false,
      reason: `Clickable prototype would have more than ${GANTT_MAX_DEPENDENTS} dependent tasks, the most a task can have.`,
    });
  });
});

describe("a package deleted in a Tree a plan names (view spec, Deleting a package with dependents)", () => {
  const crowded = (task: string): GanttPlanProps => ({
    ...SENT_PLAN,
    tasks: {
      ...SENT_PLAN.tasks,
      ...Object.fromEntries(
        Array.from({ length: GANTT_MAX_DEPENDENTS - 1 }, (_, at) => [
          `t-${at + 1}`,
          { dependencies: [task] },
        ]),
      ),
    },
  });

  test("counts the tasks of the plans that depend on the branch, outside it", () => {
    expect(linkedDependents(board(), WBS.id, ["portal"])).toBe(1);
    expect(linkedDependents(board(), WBS.id, ["ux", "prototype"])).toBe(1);
    expect(linkedDependents(board(), WBS.id, ["reporting"])).toBe(0);
    expect(linkedDependents(board(), PLAN.id, ["portal"])).toBe(0);
  });

  test("connects each dependent to the deleted package's predecessors, in one update with the Tree's value", () => {
    const next = remove(SENT, "portal");
    expect(linkedDelete(board(), WBS.id, SENT, next, ["portal"], EN)).toEqual({
      ok: true,
      values: {
        [WBS.id]: next,
        [PLAN.id]: {
          ...SENT_PLAN,
          tasks: {
            ...SENT_PLAN.tasks,
            reporting: {
              ...SENT_PLAN.tasks.reporting,
              dependencies: ["architecture", "prototype"],
            },
          },
        },
      },
    });
  });

  test("leaves neither value in the draft once a package the user added is deleted again", () => {
    const added = linkedAdd(board(), WBS.id, SENT, SPLIT, "u-1", "portal", EN);
    const shown = new Map(added.ok ? Object.entries(added.values) : []);
    expect(linkedDelete(board(shown), WBS.id, SENT, SENT, ["u-1"], EN)).toEqual({
      ok: true,
      values: { [WBS.id]: undefined, [PLAN.id]: undefined },
    });
  });

  test("is refused, naming the limit, when a dependent's new predecessors would pass one", () => {
    const next = remove(SENT, "portal");
    const shown = new Map([[PLAN.id, crowded("prototype")]]);
    expect(linkedDelete(board(shown), WBS.id, SENT, next, ["portal"], EN)).toEqual({
      ok: false,
      reason: `Clickable prototype would have more than ${GANTT_MAX_DEPENDENTS} dependent tasks, the most a task can have.`,
    });
  });
});

describe("a refused linked edit's field error", () => {
  test("names the task past the limit by its label in the Tree, else by its ID", () => {
    expect(
      refusalText(
        { ok: false, limit: "predecessors", most: GANTT_MAX_PREDECESSORS, taskId: "reporting" },
        SENT.nodes,
        EN,
      ),
    ).toBe(
      `Reporting would have more than ${GANTT_MAX_PREDECESSORS} predecessors, the most a task can have.`,
    );
    expect(
      refusalText(
        { ok: false, limit: "dependents", most: GANTT_MAX_DEPENDENTS, taskId: "t-9" },
        SENT.nodes,
        EN,
      ),
    ).toBe(
      `t-9 would have more than ${GANTT_MAX_DEPENDENTS} dependent tasks, the most a task can have.`,
    );
  });

  test("names the plan's limit of entries", () => {
    expect(
      refusalText({ ok: false, limit: "entries", most: GANTT_MAX_TASKS }, SENT.nodes, EN),
    ).toBe(`The plan would hold more than ${GANTT_MAX_TASKS} tasks, the most a plan can hold.`);
  });
});
