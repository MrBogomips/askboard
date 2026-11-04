// UJ-2 on the Gantt plan, end to end, in each engine, on the widget host (gantt-widget task 7.9;
// spec, "Answering a question with a Gantt"; AD-10, AD-20): with the keyboard only, the user makes
// the approved UJ-2 answer's edits on the fixture plan, the Tree's in the Tree as the Tree's own
// UJ-2 scenario makes them, `u-1`'s predecessors following from the split (molecules, F20), and
// presses "Answer".
// Nothing leaves the view before it; after it, one answer message carries the Tree's and the
// plan's full edited values, whose diffs against the values sent are the approved answer's
// changes, and the plan's derived values, which are the approved answer's.

import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_PLAN_SHAPE, TREE_SHAPE } from "@askboard/contract";
import {
  ganttPlanBoardDocument,
  ganttPlanChanges,
  ganttPlanDerived,
  ganttPlanEditedValue,
  treeAnswer,
  treeEditedValue,
} from "@askboard/contract/fixtures";
import { validateGanttProps, validateTreeProps } from "@askboard/contract/validate";
import {
  baselineFacts,
  planGantt,
  planQuestion,
  planTree,
  type RowText,
} from "./fixtures/gantt-plan.ts";
import {
  barDates,
  changeOutlines,
  counterText,
  criticalTasks,
  ganttOf,
  rowTexts,
} from "./fixtures/gantt-view.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  type FocusAt,
  pressIn,
  pressTool,
  type TreeGrid,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import { expectNewNode, expectSteps, readyIn, typeIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** How many presses of Tab may pass before the focus must have reached its target. */
const MAX_TABS = 6;

/** Presses Tab until `reached` holds, at most `MAX_TABS` times, with no click. */
const tabUntil = async (board: Board, reached: () => Promise<boolean>, what: string) => {
  for (let presses = 0; !(await reached()); presses += 1) {
    if (presses === MAX_TABS) throw new Error(`${MAX_TABS} presses of Tab never reached ${what}`);
    await board.page.keyboard.press("Tab");
  }
};

/** Edits the Tree's focused field: F2, the text over the field's, then Enter, the focus kept. */
const enterField = async (run: WidgetHostRun, tree: TreeGrid, text: string, at: FocusAt) => {
  await typeIn(run, tree, "F2", text);
  expect({ text, at: await pressIn(run.board, "Enter") }).toEqual({ text, at });
  expect(await tree.editor.count()).toBe(0);
};

// The approved answer's plan as `compute` schedules it over the edited Tree: each row, then each
// bar; it ends on 12/2/2026.
const ANSWERED_ROWS: RowText[] = [
  ["ux", "UX design", "11/2/2026", "5", ""],
  ["architecture", "Architecture", "11/2/2026", "4", ""],
  ["prototype", "Clickable prototype", "11/9/2026", "5", "UX design"],
  ["portal", "Customer portal: accounts", "11/16/2026", "7", "Architecture, Clickable prototype"],
  ["u-1", "Customer portal: dashboards", "11/16/2026", "8", "Architecture, Clickable prototype"],
  ["billing", "Billing integration", "11/6/2026", "10", "Architecture"],
  ["reporting", "Reporting", "11/25/2026", "6", "Customer portal: accounts"],
];

const ANSWERED_BARS = {
  ux: "2026-11-02..2026-11-06",
  architecture: "2026-11-02..2026-11-05",
  prototype: "2026-11-09..2026-11-13",
  portal: "2026-11-16..2026-11-24",
  "u-1": "2026-11-16..2026-11-25",
  billing: "2026-11-06..2026-11-19",
  reporting: "2026-11-25..2026-12-02",
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: UJ-2 on the Gantt plan`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "with the keyboard only, the approved UJ-2 edits in the Tree, the plan's following from the split, then Answer, send one answer whose plan diffs to the approved operation with the approved derived values",
      async () => {
        const run = await host(dist, ganttPlanBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, planGantt.id);
        await tabUntil(board, async () => (await treeFocus(board)) !== undefined, "the Tree");
        expect(await treeFocus(board)).toEqual({ nodeId: "design" });
        // The Tree's edits, as the Tree's UJ-2 scenario makes them. `ux`: most likely, 5 to 4.
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "ux" }],
          ["ArrowRight", { nodeId: "ux", cell: 0 }],
          ["ArrowRight", { nodeId: "ux", cell: 1 }],
          ["ArrowRight", { nodeId: "ux", cell: 2 }],
        ]);
        await enterField(run, tree, "4", { nodeId: "ux", cell: 2 });
        // `portal`: renamed, and its three estimates halved.
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "architecture", cell: 2 }],
          ["ArrowDown", { nodeId: "prototype", cell: 2 }],
          ["ArrowDown", { nodeId: "build", cell: 2 }],
          ["ArrowDown", { nodeId: "portal", cell: 2 }],
          ["Home", { nodeId: "portal", cell: 0 }],
        ]);
        await typeIn(run, tree, "Enter", "Customer portal: accounts");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 0 });
        for (const [cell, text] of [
          [1, "4"],
          [2, "6"],
          [3, "10"],
        ] as const) {
          expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "portal", cell });
          await enterField(run, tree, text, { nodeId: "portal", cell });
        }
        // `u-1`, split off after `portal` from the toolbar's "Add node", named, which gives it the
        // portal's predecessors in the plan (molecules, F20), then estimated.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Customer portal: dashboards");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        for (const [cell, text] of [
          [1, "4"],
          [2, "7"],
          [3, "12"],
        ] as const) {
          expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "u-1", cell });
          await enterField(run, tree, text, { nodeId: "u-1", cell });
        }
        // `billing`: the pessimistic estimate, 15 to 21.
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "billing", cell: 3 });
        await enterField(run, tree, "21", { nodeId: "billing", cell: 3 });
        // The plan as the approved answer leaves it: the re-estimated tasks and `u-1` marked,
        // the tasks moved only by their predecessors not; one change of the plan's own.
        await eventually(
          async () => (await barDates(gantt))["u-1"] === ANSWERED_BARS["u-1"],
          "u-1 to start after the prototype",
        );
        expect(await rowTexts(gantt)).toEqual(ANSWERED_ROWS);
        expect(await barDates(gantt)).toEqual(ANSWERED_BARS);
        expect(await criticalTasks(gantt)).toEqual(["ux", "prototype", "portal", "reporting"]);
        expect((await baselineFacts(gantt)).map(({ task }) => task)).toEqual([
          "ux",
          "architecture",
          "prototype",
          "portal",
          "billing",
          "reporting",
        ]);
        expect((await changeOutlines(gantt)).map(({ task }) => task)).toEqual([
          "ux",
          "portal",
          "u-1",
          "billing",
        ]);
        expect(await counterText(gantt)).toBe("Your changes: 1");
        // Nothing has left the view yet.
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: planQuestion.id }]);
        // Tab on to "Answer", then Enter.
        expect(await board.answer.isEnabled()).toBe(true);
        await tabUntil(board, () => isFocused(board.answer), "Answer");
        await board.page.keyboard.press("Enter");
        await eventually(() => run.messages.length > 1, "the answer message", STEP_TIMEOUT_MS);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toHaveLength(2);
        const answers = run.messages.filter((message) => message.type === "answer");
        expect(answers).toHaveLength(1);
        const [answer] = answers;
        expect(answer).toEqual({
          type: "answer",
          itemId: planQuestion.id,
          rev: planQuestion.rev,
          values: { [planTree.id]: treeEditedValue, [planGantt.id]: ganttPlanEditedValue },
          derived: expect.any(Object),
          when: expect.any(String),
        });
        const { values = {}, derived = {} } = answer?.type === "answer" ? answer : {};
        // Each value validates as an edited value, and the contract's diff of the sent and the
        // edited value is the approved answer's: the Tree's `changes`, and the plan's operation.
        const wbs = validateTreeProps(values[planTree.id], "edited");
        const schedule = validateGanttProps(values[planGantt.id], "edited");
        if (!wbs.ok || !schedule.ok)
          throw new Error("the answer's values do not validate as edited");
        expect(elementChanges(planTree.id, planTree.props, wbs.value, TREE_SHAPE)).toEqual(
          treeAnswer.changes ?? [],
        );
        expect(
          elementChanges(planGantt.id, planGantt.props, schedule.value, GANTT_PLAN_SHAPE),
        ).toEqual(ganttPlanChanges);
        // The plan's derived values are the approved answer's; the Tree's are the WBS-with-PERT
        // change's, so only the plan's are compared.
        const planDerived = Object.fromEntries(
          Object.entries(derived).filter(([reference]) => reference.startsWith(`${planGantt.id}.`)),
        );
        expect(planDerived).toEqual(ganttPlanDerived);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
