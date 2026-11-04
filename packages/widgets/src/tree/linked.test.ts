import { describe, expect, test } from "bun:test";
import { GANTT_MAX_DEPENDENTS, GANTT_MAX_PREDECESSORS, GANTT_MAX_TASKS } from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { BoardContent } from "@askboard/view/catalog";
import type { GanttPlanProps } from "../gantt/model/tasks.ts";
import { linkedAdd, refusalText } from "./linked.ts";
import { addAfter, addChild } from "./model/edits.ts";

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
    expect(linkedAdd(board(), WBS.id, SENT, SPLIT, "u-1", "portal")).toEqual({
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
    const write = linkedAdd(board(), WBS.id, SENT, next, "u-1", "reporting");
    expect(write.ok && write.values[PLAN.id]).toEqual({
      ...SENT_PLAN,
      tasks: { ...SENT_PLAN.tasks, "u-1": { dependencies: ["portal"] } },
    });
  });

  test("names only the Tree when the anchor has no predecessors, or there is no anchor", () => {
    const next = addAfter(SENT, "ux", "Research");
    expect(linkedAdd(board(), WBS.id, SENT, next, "u-1", "ux")).toEqual({
      ok: true,
      values: { [WBS.id]: next },
    });
    expect(linkedAdd(board(), WBS.id, SENT, SPLIT, "u-1", undefined)).toEqual({
      ok: true,
      values: { [WBS.id]: SPLIT },
    });
  });

  test("gives the Tree `undefined` once its nodes are the agent's", () => {
    expect(linkedAdd(board(), WBS.id, SENT, SENT, "u-1", "ux")).toEqual({
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
      linkedAdd(board(new Map([[PLAN.id, plan]])), WBS.id, SENT, SPLIT, "u-1", "portal"),
    ).toEqual({
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
      ),
    ).toBe(
      `Reporting would have more than ${GANTT_MAX_PREDECESSORS} predecessors, the most a task can have.`,
    );
    expect(
      refusalText(
        { ok: false, limit: "dependents", most: GANTT_MAX_DEPENDENTS, taskId: "t-9" },
        SENT.nodes,
      ),
    ).toBe(
      `t-9 would have more than ${GANTT_MAX_DEPENDENTS} dependent tasks, the most a task can have.`,
    );
  });

  test("names the plan's limit of entries", () => {
    expect(refusalText({ ok: false, limit: "entries", most: GANTT_MAX_TASKS }, SENT.nodes)).toBe(
      `The plan would hold more than ${GANTT_MAX_TASKS} tasks, the most a plan can hold.`,
    );
  });
});
