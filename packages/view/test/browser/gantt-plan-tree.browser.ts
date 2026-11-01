// The Gantt plan following its Tree, in each engine, on the widget host (gantt-widget design
// decisions 7, 8 and 9; spec, "Gantt dates follow the edits", "Gantt predecessors", "Gantt change
// highlight", "Gantt formula errors" and "Gantt plan baseline"), on the fixture plan, the Tree
// driven by the keyboard as its own scenarios drive it: an estimate changed in the Tree changes its
// task's duration and moves its dependents and the plan's end, the task marked re-estimated; a
// package added in the Tree is a task with a bar, the added mark, no baseline and no predecessors
// until the user links it in its panel; a package deleted while another depends on it leaves a
// field error under the dependent's row.

import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_PLAN_SHAPE } from "@askboard/contract";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { UJ2 } from "./fixtures/gantt-documents.ts";
import { focusedBox, focusedCell, keysTo } from "./fixtures/gantt-input.ts";
import {
  addedRows,
  baselineFacts,
  chartAt,
  PLAN_ROWS,
  planGantt,
  planQuestion,
  planTree,
  type RowText,
  tabIntoPlanGrid,
} from "./fixtures/gantt-plan.ts";
import {
  arrowFacts,
  barDates,
  changeOutlines,
  colour,
  counterText,
  criticalTasks,
  filledCells,
  ganttOf,
  panelFacts,
  panelOf,
  rowTexts,
} from "./fixtures/gantt-view.ts";
import { withBuild } from "./fixtures/tree-documents.ts";
import { eventually, QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { paintOf, pressIn, pressTool, treeGridOf } from "./harness/tree-grid.ts";
import {
  expectNewNode,
  expectSteps,
  FIXTURE_IDS,
  focusPortal,
  readyIn,
  shownIds,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const NONE_YET = "Changes vs agent's original · none yet";

/** Each task's bar as compute's UJ-2 plan schedules it, `start..finish`. */
const UJ2_DATES: Record<string, string> = Object.fromEntries(
  UJ2.map(([task, start, finish]) => [task, `${start}..${finish}`]),
);

/** The fixture plan's rows with some replaced, by task. */
const rowsWith = (replaced: Readonly<Record<string, RowText>>): RowText[] =>
  PLAN_ROWS.map((row) => replaced[row[0]] ?? row);

/** The package the user adds after the portal, with its estimates. */
const DASHBOARDS = {
  id: "u-1",
  label: "Customer portal: dashboards",
  optimistic: 4,
  mostLikely: 7,
  pessimistic: 12,
};

/** The plan's tasks once `u-1` follows the portal, as `keysTo` takes them. */
const WITH_DASHBOARDS = [
  "ux",
  "architecture",
  "prototype",
  "portal",
  "u-1",
  "billing",
  "reporting",
].map((id) => ({ id }));

/** The rows' tasks and the agent's dates of each baseline, in the chart's order. */
const baselineDates = async (gantt: ReturnType<typeof ganttOf>) =>
  (await baselineFacts(gantt)).map(({ task, start, finish }) => `${task} ${start}..${finish}`);

const SENT_BASELINES = UJ2.map(([task, start, finish]) => `${task} ${start}..${finish}`);

/** Nothing but the question's `ready` has left the view, after a quiet spell. */
const expectOnlyReady = async (run: WidgetHostRun) => {
  await Bun.sleep(QUIET_MS);
  expect(run.messages).toEqual([{ type: "ready", itemId: planQuestion.id }]);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt plan follows its Tree`, () => {
    const { host } = useWidgetHost(engine);

    /** The fixture plan's widget host, once its question reported ready first. */
    const opened = async (): Promise<WidgetHostRun> => {
      const run = await host(dist, ganttPlanBoardDocument);
      await readyIn(run);
      return run;
    };

    test(
      "the portal's most likely estimate changed from 12 to 20 in the Tree makes its duration 18, moves reporting and the plan's end, and marks the portal re-estimated",
      async () => {
        const run = await opened();
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, planGantt.id);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
          ["ArrowRight", { nodeId: "portal", cell: 2 }],
        ]);
        await typeIn(run, tree, "F2", "20");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 2 });
        // (8 + 4 × 20 + 20) / 6 = 18 working days: the portal ends on 12/10, reporting follows.
        await eventually(
          async () => (await barDates(gantt)).portal === "2026-11-17..2026-12-10",
          "the portal to end on 12/10/2026",
        );
        expect(await rowTexts(gantt)).toEqual(
          rowsWith({
            portal: [
              "portal",
              "Customer portal",
              "11/17/2026",
              "18",
              "Architecture, Clickable prototype",
            ],
            reporting: ["reporting", "Reporting", "12/11/2026", "6", "Customer portal"],
          }),
        );
        expect(await barDates(gantt)).toEqual({
          ...UJ2_DATES,
          portal: "2026-11-17..2026-12-10",
          reporting: "2026-12-11..2026-12-18",
        });
        expect(await criticalTasks(gantt)).toEqual(["ux", "prototype", "portal", "reporting"]);
        // The plan now ends on 12/18/2026, and the axis runs two weeks past it: 61 days.
        expect(Number(await chartAt(gantt, "week").getAttribute("width"))).toBe(61 * 15);
        expect(await baselineDates(gantt)).toEqual(SENT_BASELINES);
        // Re-estimated in the Tree: the portal's bar takes the change outline and its duration the
        // change fill; reporting, moved only by its predecessor, takes neither; the plan counts
        // only its own entries' changes, and the Tree's draft enables "Answer".
        expect((await changeOutlines(gantt)).map(({ task }) => task)).toEqual(["portal"]);
        expect(await filledCells(gantt, colour("change-subtle"))).toEqual([
          { cell: "portal.duration", color: colour("change-text") },
        ]);
        expect(await counterText(gantt)).toBe(NONE_YET);
        expect(await board.answer.isEnabled()).toBe(true);
        // Back to 12 by hand: the plan as the agent sent it, and nothing to answer.
        await typeIn(run, tree, "F2", "12");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 2 });
        await eventually(
          async () => (await barDates(gantt)).portal === UJ2_DATES.portal,
          "the portal to end on 12/3/2026 again",
        );
        expect(await rowTexts(gantt)).toEqual(PLAN_ROWS);
        expect(await barDates(gantt)).toEqual(UJ2_DATES);
        expect(await changeOutlines(gantt)).toEqual([]);
        expect(await board.answer.isDisabled()).toBe(true);
        await expectOnlyReady(run);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a package added in the Tree after the portal gets a bar, the added mark, no baseline and no predecessors; linked to Architecture and Clickable prototype in its panel, it starts after the prototype",
      async () => {
        const run = await opened();
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, planGantt.id);
        // "Add node" from the Tree's toolbar on the portal, then the new package's name and
        // estimates, all by keyboard.
        await focusPortal(run, tree);
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type(DASHBOARDS.label);
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        const estimates = [DASHBOARDS.optimistic, DASHBOARDS.mostLikely, DASHBOARDS.pessimistic];
        for (const [at, estimate] of estimates.entries()) {
          expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "u-1", cell: at + 1 });
          await typeIn(run, tree, "F2", String(estimate));
          expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: at + 1 });
        }
        // (4 + 4 × 7 + 12) / 6, rounded up, is 8 working days; with no predecessor, it starts
        // with the plan.
        await eventually(
          async () => (await barDates(gantt))["u-1"] === "2026-11-02..2026-11-11",
          "u-1's bar from 11/2/2026 to 11/11/2026",
        );
        const added: RowText = ["u-1", DASHBOARDS.label, "11/2/2026", "8", ""];
        expect(await rowTexts(gantt)).toEqual([
          ...PLAN_ROWS.slice(0, 4),
          added,
          ...PLAN_ROWS.slice(4),
        ]);
        expect(await barDates(gantt)).toEqual({ ...UJ2_DATES, "u-1": "2026-11-02..2026-11-11" });
        // No baseline: the agent sent no such task.
        expect(await baselineDates(gantt)).toEqual(SENT_BASELINES);
        // The added mark: the change outline on its bar and the change bar on its row's left
        // edge; no predecessor, so no arrow and no changed cell; the plan's counter counts only
        // its own entries' changes.
        const change = colour("change");
        expect(await changeOutlines(gantt)).toEqual([
          { task: "u-1", stroke: change, width: "2px" },
        ]);
        expect(await addedRows(gantt)).toEqual(["u-1"]);
        expect((await paintOf(gantt.cell("u-1", "task"))).shadow).toContain(
          `${change} 2px 0px 0px 0px inset`,
        );
        expect((await paintOf(gantt.cell("portal", "task"))).shadow).not.toContain(change);
        expect(await filledCells(gantt, colour("change-subtle"))).toEqual([]);
        expect((await arrowFacts(gantt)).filter(({ link }) => link.endsWith(">u-1"))).toEqual([]);
        expect(await counterText(gantt)).toBe(NONE_YET);
        // On to the plan's grid by Tab, through its zoom; Enter on u-1's "Depends on" opens its
        // panel, every other task offered, none checked.
        await tabIntoPlanGrid(board);
        await keysTo(board, "u-1", "dependencies", WITH_DASHBOARDS);
        await board.page.keyboard.press("Enter");
        const panel = panelOf(gantt, "u-1");
        expect(await panelFacts(panel)).toEqual(
          PLAN_ROWS.map(([, task]) => ({ task, checked: false, disabled: false, reason: "" })),
        );
        expect(await focusedBox(board)).toBe("UX design");
        for (const box of ["Architecture", "Clickable prototype"]) {
          await board.page.keyboard.press("ArrowDown");
          expect(await focusedBox(board)).toBe(box);
          await board.page.keyboard.press("Space");
        }
        await board.page.keyboard.press("Enter");
        expect(await panel.count()).toBe(0);
        expect(await focusedCell(board)).toBe("u-1.dependencies");
        // u-1 starts after the prototype ends, with an arrow from each of its predecessors.
        expect((await barDates(gantt))["u-1"]).toBe("2026-11-17..2026-11-26");
        expect((await rowTexts(gantt))[4]).toEqual([
          "u-1",
          DASHBOARDS.label,
          "11/17/2026",
          "8",
          "Architecture, Clickable prototype",
        ]);
        expect(
          (await arrowFacts(gantt)).map(({ link }) => link).filter((link) => link.endsWith(">u-1")),
        ).toEqual(["architecture>u-1", "prototype>u-1"]);
        expect(await filledCells(gantt, colour("change-subtle"))).toEqual([
          { cell: "u-1.dependencies", color: colour("change-text") },
        ]);
        expect(await counterText(gantt)).toBe("Your changes: 1");
        // Reporting moved later too (spec, "Counting changes"): two tasks changed, the portal not.
        await keysTo(board, "reporting", "start", WITH_DASHBOARDS);
        await board.page.keyboard.press("Enter");
        await board.page.keyboard.type("12/9/2026");
        await board.page.keyboard.press("Enter");
        await eventually(
          async () => (await barDates(gantt)).reporting === "2026-12-09..2026-12-16",
          "reporting to move to 12/9/2026",
        );
        expect((await changeOutlines(gantt)).map(({ task }) => task)).toEqual(["u-1", "reporting"]);
        expect(await counterText(gantt)).toBe("Your changes: 2");
        await expectOnlyReady(run);
        // "Answer" sends the Tree's and the plan's values, with the plan's derived values; the
        // plan's diff names the two tasks it changed.
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        await Bun.sleep(QUIET_MS);
        const sentPlan = planGantt.props as { readonly tasks: Readonly<Record<string, unknown>> };
        const plan = {
          ...planGantt.props,
          tasks: {
            ...sentPlan.tasks,
            reporting: { dependencies: ["portal"], start: "2026-12-09" },
            "u-1": { dependencies: ["architecture", "prototype"] },
          },
        };
        expect(run.messages).toEqual([
          { type: "ready", itemId: planQuestion.id },
          {
            type: "answer",
            itemId: planQuestion.id,
            rev: planQuestion.rev,
            values: {
              [planTree.id]: withBuild((children) => children.toSpliced(1, 0, DASHBOARDS)),
              [planGantt.id]: plan,
            },
            derived: { "schedule.finish": "2026-12-16", "schedule.criticalPath": ["reporting"] },
            when: expect.any(String),
          },
        ]);
        expect(elementChanges(planGantt.id, planGantt.props, plan, GANTT_PLAN_SHAPE)).toEqual([
          { op: "set", target: "schedule.reporting.start", value: "2026-12-09" },
          { op: "set", target: "schedule.u-1.dependencies", value: ["architecture", "prototype"] },
        ]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a package deleted in the Tree while another depends on it leaves a field error under the dependent's row, the other tasks scheduled",
      async () => {
        const run = await opened();
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, planGantt.id);
        // The portal, a leaf, goes at once; reporting depends on it.
        await focusPortal(run, tree);
        await board.page.keyboard.press("Delete");
        await eventually(
          async () => !(await shownIds(tree)).includes("portal"),
          "the portal to leave the Tree",
        );
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS.filter((id) => id !== "portal"));
        await gantt.note("reporting").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(((await gantt.note("reporting").textContent()) ?? "").trim()).toBe(
          "No dates: its predecessor portal names no task.",
        );
        expect(await gantt.root.locator("[data-gantt-note]").count()).toBe(1);
        // The portal has no row, no bar and no baseline; reporting has no dates and no bar; the
        // others keep theirs, and with the plan's end unknown, no path is critical.
        expect(await rowTexts(gantt)).toEqual([
          ...PLAN_ROWS.filter((row) => row[0] !== "portal" && row[0] !== "reporting"),
          ["reporting", "Reporting", "", "", "portal"],
        ]);
        const { portal: _portal, reporting: _reporting, ...scheduled } = UJ2_DATES;
        expect(await barDates(gantt)).toEqual(scheduled);
        expect(await criticalTasks(gantt)).toEqual([]);
        expect(await gantt.root.locator('[data-gantt-baseline="portal"]').count()).toBe(0);
        // Nothing blocks "Answer", which the Tree's draft enables; the plan changed nothing of
        // its own.
        expect(await board.answer.isEnabled()).toBe(true);
        expect(await counterText(gantt)).toBe(NONE_YET);
        expect(await changeOutlines(gantt)).toEqual([]);
        await expectOnlyReady(run);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
