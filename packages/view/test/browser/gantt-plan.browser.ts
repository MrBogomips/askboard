// The Gantt plan's scenarios, in each engine, on the widget host (gantt-widget design decisions 9,
// 10 and 12; spec, "Gantt layout", "Gantt plan scope", "Gantt plan baseline", "Gantt keyboard" and
// "Read-only Gantt"), on the fixture plan: the question `plan` holding the Tree `wbs` and the plan
// `schedule` over it. The grid lists the Tree's six leaves in the Tree's order with their PERT
// durations, read-only; the toolbar is a second Tab stop whose "Day | Week | Month" rescales the
// axis, the bars and the baselines and sends nothing; each bar has the agent's dates under it as a
// baseline, which stays where it was when the task moves; and an answered plan still zooms.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { ORIGIN, UJ2, WEEK_PX } from "./fixtures/gantt-documents.ts";
import {
  dragBy,
  focusedCell,
  focusedItem,
  focusRing,
  grabPoint,
  keysTo,
  pageState,
} from "./fixtures/gantt-input.ts";
import {
  baselineFacts,
  chartAt,
  checkedZoom,
  DAY_PX,
  focusedZoom,
  optionLook,
  PLAN_ROWS,
  PLAN_TASKS,
  planGantt,
  planQuestion,
  planTree,
  tickLabels,
  ZOOM_LABELS,
  type ZoomName,
  zoomOption,
} from "./fixtures/gantt-plan.ts";
import {
  barDates,
  barFacts,
  changeOutlines,
  colour,
  counterText,
  criticalTasks,
  daysFrom,
  type GanttParts,
  ganttOf,
  rowTexts,
} from "./fixtures/gantt-view.ts";
import {
  eventually,
  LOAD_TIMEOUT_MS,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const NONE_YET = "No changes";

/** A task's span on the axis at a zoom, from the chart's first day. */
const spanAt = (start: string, finish: string, zoom: ZoomName) => ({
  x: daysFrom(ORIGIN, start) * DAY_PX[zoom],
  width: (daysFrom(start, finish) + 1) * DAY_PX[zoom],
});

// The axis runs from the plan's start to two weeks past its end, 12/11/2026: 54 days.
const AXIS_DAYS = 54;
const FIRST_TICKS: Record<ZoomName, readonly string[]> = {
  day: ["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6", "Sat 7", "Sun 8", "Mon 9"],
  week: ["Nov 2", "Nov 9", "Nov 16", "Nov 23", "Nov 30", "Dec 7", "Dec 14", "Dec 21"],
  month: ["Dec 2026"],
};

/** The fixture plan's chart at a zoom: its label, its width, its axis, its bars and baselines. */
const expectScale = async (gantt: GanttParts, zoom: ZoomName) => {
  const chart = chartAt(gantt, zoom);
  await chart.waitFor({ timeout: STEP_TIMEOUT_MS });
  expect(Number(await chart.getAttribute("width"))).toBe(AXIS_DAYS * DAY_PX[zoom]);
  const ticks = await tickLabels(gantt);
  expect(ticks.slice(0, FIRST_TICKS[zoom].length)).toEqual([...FIRST_TICKS[zoom]]);
  if (zoom === "day") expect(ticks).toHaveLength(AXIS_DAYS);
  else expect(ticks).toHaveLength(FIRST_TICKS[zoom].length);
  const spans = UJ2.map(([task, start, finish]) => ({ task, ...spanAt(start, finish, zoom) }));
  const bars = await barFacts(gantt);
  expect(bars.map(({ task, x, width }) => ({ task, x, width }))).toEqual(spans);
  const baselines = await baselineFacts(gantt);
  expect(baselines.map(({ task, x, width }) => ({ task, x, width }))).toEqual(spans);
};

/** Presses Tab from the host page until the focus reaches the plan, at most ten times. */
const tabIntoPlan = async (board: Board): Promise<void> => {
  for (let presses = 0; presses < 10; presses += 1) {
    await board.page.keyboard.press("Tab");
    if ((await focusedItem(board)) === planGantt.id) return;
  }
  throw new Error("ten presses of Tab never reached the plan");
};

/** Where the view's focus is: a zoom option by its label, a grid cell, or the item holding it. */
const focusAt = async (board: Board) =>
  (await focusedZoom(board)) ?? (await focusedCell(board)) ?? (await focusedItem(board));

/** Presses a key, then waits for the focus to reach `at`. */
const pressTo = async (board: Board, key: string, at: string): Promise<void> => {
  await board.page.keyboard.press(key);
  await eventually(async () => (await focusAt(board)) === at, `${key} to move the focus to ${at}`);
};

/** Presses a key on a zoom option, then waits for the zoom it chooses. */
const choose = async (board: Board, gantt: GanttParts, key: string, label: string) => {
  await board.page.keyboard.press(key);
  await eventually(
    async () => (await checkedZoom(gantt)).join() === label,
    `${key} to choose ${label}`,
  );
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt plan`, () => {
    const { host } = useWidgetHost(engine);

    /** The fixture plan's widget host, once its question reported ready first. */
    const openedPlan = async (): Promise<WidgetHostRun> => {
      const run = await host(dist, ganttPlanBoardDocument);
      await eventually(
        () => run.messages.length > 0,
        "the plan's question's first message",
        LOAD_TIMEOUT_MS,
      );
      expect(run.messages[0]).toEqual({ type: "ready", itemId: planQuestion.id });
      return run;
    };

    test(
      "the plan lists the Tree's leaves in its order with their PERT durations, read-only, and draws their bars and the critical path",
      async () => {
        const run = await openedPlan();
        const gantt = ganttOf(run.board, planGantt.id);
        expect(await rowTexts(gantt)).toEqual(PLAN_ROWS);
        // No row and no bar for a parent package.
        for (const parent of ["design", "build"]) {
          expect(await gantt.row(parent).count()).toBe(0);
          expect(await gantt.bar(parent).count()).toBe(0);
        }
        expect(await barDates(gantt)).toEqual(
          Object.fromEntries(UJ2.map(([task, start, finish]) => [task, `${start}..${finish}`])),
        );
        expect(await criticalTasks(gantt)).toEqual(["ux", "prototype", "portal", "reporting"]);
        expect(await chartAt(gantt, "week").count()).toBe(1);
        // Durations are right-aligned values: no resize handle, and no key edits one.
        const alignment = await gantt.grid
          .locator('[data-gantt-column="duration"]')
          .evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).textAlign));
        expect(alignment).toEqual(UJ2.map(() => "right"));
        expect(await gantt.root.locator("[data-gantt-handle]").count()).toBe(0);
        await keysTo(run.board, "billing", "duration", PLAN_TASKS);
        for (const key of ["Enter", "F2", "Delete", "Backspace"]) {
          await run.board.page.keyboard.press(key);
          expect({ key, editors: await gantt.grid.locator("input").count() }).toEqual({
            key,
            editors: 0,
          });
        }
        expect(await focusedCell(run.board)).toBe("billing.duration");
        expect(await rowTexts(gantt)).toEqual(PLAN_ROWS);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: planQuestion.id }]);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await counterText(gantt)).toBe(NONE_YET);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the toolbar is a second Tab stop whose Day, Week and Month rescale the axis, the bars and the baselines, sending nothing",
      async () => {
        const run = await openedPlan();
        const { board } = run;
        const gantt = ganttOf(board, planGantt.id);
        const page = await pageState(board);
        expect(
          await gantt.root
            .getByRole("radio")
            .evaluateAll((options) => options.map((option) => (option.textContent ?? "").trim())),
        ).toEqual([...ZOOM_LABELS]);
        expect(await checkedZoom(gantt)).toEqual(["Week"]);
        await expectScale(gantt, "week");
        // The zoom, then the grid: two Tab stops, and Shift+Tab back to the Tree.
        await tabIntoPlan(board);
        expect(await focusAt(board)).toBe("Week");
        const ring = colour("ring");
        expect(await focusRing(board)).toEqual({ style: "solid", width: "2px", color: ring });
        await pressTo(board, "Tab", "ux.task");
        await pressTo(board, "Shift+Tab", "Week");
        await pressTo(board, "Shift+Tab", planTree.id);
        await pressTo(board, "Tab", "Week");
        // The arrow keys, Home and End move between the options; Space or Enter chooses one.
        await pressTo(board, "ArrowRight", "Month");
        expect(await checkedZoom(gantt)).toEqual(["Week"]);
        await choose(board, gantt, "Space", "Month");
        await expectScale(gantt, "month");
        await pressTo(board, "Home", "Day");
        await choose(board, gantt, "Enter", "Day");
        await expectScale(gantt, "day");
        // Choosing the zoom shown again keeps it.
        await board.page.keyboard.press("Enter");
        await Bun.sleep(QUIET_MS);
        expect(await checkedZoom(gantt)).toEqual(["Day"]);
        await expectScale(gantt, "day");
        await pressTo(board, "End", "Month");
        await pressTo(board, "ArrowRight", "Day");
        expect(await focusRing(board)).toEqual({ style: "solid", width: "2px", color: ring });
        // The pointer chooses too.
        await zoomOption(gantt, "Week").click();
        await expectScale(gantt, "week");
        expect(await checkedZoom(gantt)).toEqual(["Week"]);
        // The segmented control's look: the chosen option on the card in the primary text,
        // semibold and underlined in the primary colour; the others in the muted foreground.
        expect(await optionLook(zoomOption(gantt, "Week"))).toEqual({
          background: colour("card"),
          color: colour("primary-text"),
          weight: "600",
          underline: `2px solid ${colour("primary")}`,
        });
        for (const label of ["Day", "Month"]) {
          expect((await optionLook(zoomOption(gantt, label))).color).toBe(
            colour("muted-foreground"),
          );
        }
        expect(await rowTexts(gantt)).toEqual(PLAN_ROWS);
        expect(await pageState(board)).toEqual(page);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: planQuestion.id }]);
        expect(await board.answer.isDisabled()).toBe(true);
        expect(await counterText(gantt)).toBe(NONE_YET);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a baseline lies under each bar at the agent's dates, and stays there when reporting moves three working days later",
      async () => {
        const run = await openedPlan();
        const gantt = ganttOf(run.board, planGantt.id);
        const sent = UJ2.map(([task, start, finish]) => ({
          task,
          start,
          finish,
          ...spanAt(start, finish, "week"),
          height: 4,
          gap: 4,
          fill: colour("border-strong"),
        }));
        expect(await baselineFacts(gantt)).toEqual(sent);
        // Reporting, from Friday 12/4 to Wednesday 12/9: three working days later.
        await dragBy(run.board, await grabPoint(gantt, "reporting"), 5 * WEEK_PX);
        await eventually(
          async () => (await barDates(gantt)).reporting === "2026-12-09..2026-12-16",
          "reporting to move to 12/9/2026",
        );
        expect(await rowTexts(gantt)).toEqual(
          PLAN_ROWS.map((row) =>
            row[0] === "reporting"
              ? ["reporting", "Reporting", "12/9/2026", "6", "Customer portal"]
              : row,
          ),
        );
        expect(await baselineFacts(gantt)).toEqual(sent);
        const [reporting] = (await barFacts(gantt)).filter((bar) => bar.task === "reporting");
        expect(reporting?.x).toBe(spanAt("2026-12-09", "2026-12-16", "week").x);
        expect((await changeOutlines(gantt)).map(({ task }) => task)).toEqual(["reporting"]);
        expect(await counterText(gantt)).toBe("Your changes: 1");
        expect(await run.board.answer.isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: planQuestion.id }]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after Answer, the plan still zooms and takes no edit",
      async () => {
        const run = await openedPlan();
        const gantt = ganttOf(run.board, planGantt.id);
        await dragBy(run.board, await grabPoint(gantt, "reporting"), 5 * WEEK_PX);
        await eventually(
          async () => (await barDates(gantt)).reporting === "2026-12-09..2026-12-16",
          "reporting to move to 12/9/2026",
        );
        await run.board.answer.click();
        await eventually(() => run.messages.length > 1, "the answer message");
        await run.board.receipt("sent").waitFor();
        await zoomOption(gantt, "Month").click();
        await chartAt(gantt, "month").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await checkedZoom(gantt)).toEqual(["Month"]);
        const [reporting] = (await barFacts(gantt)).filter((bar) => bar.task === "reporting");
        expect(reporting?.x).toBe(spanAt("2026-12-09", "2026-12-16", "month").x);
        const before = { rows: await rowTexts(gantt), bars: await barDates(gantt) };
        await dragBy(run.board, await grabPoint(gantt, "ux"), 14 * DAY_PX.month);
        await keysTo(run.board, "reporting", "start", PLAN_TASKS);
        await run.board.page.keyboard.press("Enter");
        expect(await gantt.grid.locator("input").count()).toBe(0);
        expect({ rows: await rowTexts(gantt), bars: await barDates(gantt) }).toEqual(before);
        expect(run.messages.map((message) => message.type)).toEqual(["ready", "answer"]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
