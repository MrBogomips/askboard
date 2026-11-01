// The Gantt's pointer scenarios, in each engine, on the widget host (gantt-widget design decisions
// 9 and 12; spec, "Gantt rescheduling by drag" and "Gantt durations"): a bar dragged later moves
// on the drop with its dependents, stops at its earliest start with the guide and snaps to working
// days; Escape cancels a drag, and a press under the drag threshold is a click; a bar's end
// resizes it, never below one working day. Then a Gantt at the 500-task limit, visible within the
// load timeout and rescheduled by a drop within the step timeout.

import { describe, expect, test } from "bun:test";
import { ORIGIN, schedule, WEEK_PX } from "./fixtures/gantt-documents.ts";
import {
  armDropTimer,
  dragBy,
  endPoint,
  grabPoint,
  guideFacts,
  pressAndMove,
} from "./fixtures/gantt-input.ts";
import {
  barDates,
  barFacts,
  colour,
  counterText,
  daysFrom,
  ganttOf,
  LIMIT_TASKS,
  withTasks,
} from "./fixtures/gantt-view.ts";
import { LOAD_TIMEOUT_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's drags`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "dragging a bar later moves it on the drop, and its dependents with it",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        // Three working days later: from Tuesday 11/17 to Friday 11/20, three calendar days.
        await pressAndMove(run.board, await grabPoint(gantt, "portal"), 3 * WEEK_PX);
        expect(Number(await gantt.bar("portal").getAttribute("x"))).toBe(
          daysFrom(ORIGIN, "2026-11-20") * WEEK_PX,
        );
        expect((await barDates(gantt)).reporting).toBe("2026-12-04..2026-12-11");
        await run.board.page.mouse.up();
        const dates = await barDates(gantt);
        expect([dates.portal, dates.reporting]).toEqual([
          "2026-11-20..2026-12-08",
          "2026-12-09..2026-12-16",
        ]);
        expect(await guideFacts(gantt)).toBeUndefined();
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a bar dragged before its predecessors allow stops at its earliest start, shown by the guide, and a drop there clears the request",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const earliest = daysFrom(ORIGIN, "2026-12-04") * WEEK_PX;
        await pressAndMove(run.board, await grabPoint(gantt, "reporting"), -10 * WEEK_PX);
        expect(Number(await gantt.bar("reporting").getAttribute("x"))).toBe(earliest);
        expect(await guideFacts(gantt)).toEqual({
          date: "2026-12-04",
          x: earliest,
          stroke: colour("muted-foreground"),
        });
        await run.board.page.mouse.up();
        expect((await barDates(gantt)).reporting).toBe("2026-12-04..2026-12-11");
        expect(await run.board.answer.isDisabled()).toBe(true);
        // Later, then back onto the earliest start: the request is gone, and so is the draft.
        await dragBy(run.board, await grabPoint(gantt, "reporting"), 5 * WEEK_PX);
        expect((await barDates(gantt)).reporting).toBe("2026-12-09..2026-12-16");
        expect(await run.board.answer.isEnabled()).toBe(true);
        await dragBy(run.board, await grabPoint(gantt, "reporting"), -10 * WEEK_PX);
        expect((await barDates(gantt)).reporting).toBe("2026-12-04..2026-12-11");
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a bar dropped with its start over Saturday 12/12/2026 starts on Monday 12/14/2026",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await dragBy(run.board, await grabPoint(gantt, "reporting"), 8 * WEEK_PX);
        expect((await barDates(gantt)).reporting).toBe("2026-12-14..2026-12-21");
        expect(((await gantt.cell("reporting", "start").textContent()) ?? "").trim()).toBe(
          "12/14/2026",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape during a drag cancels it, and a press that travels under 3px is a click that changes nothing",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const before = await barFacts(gantt);
        const x = Number(await gantt.bar("portal").getAttribute("x"));
        await pressAndMove(run.board, await grabPoint(gantt, "portal"), 3 * WEEK_PX);
        expect(Number(await gantt.bar("portal").getAttribute("x"))).toBe(x + 3 * WEEK_PX);
        await run.board.page.keyboard.press("Escape");
        expect(Number(await gantt.bar("portal").getAttribute("x"))).toBe(x);
        expect(await guideFacts(gantt)).toBeUndefined();
        await run.board.page.mouse.up();
        await dragBy(run.board, await grabPoint(gantt, "billing"), 2);
        await gantt.bar("billing").click();
        await dragBy(run.board, await endPoint(gantt, "billing"), -2);
        expect(await barFacts(gantt)).toEqual(before);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "dragging a bar's end resizes it, its dependents following, and never below one working day",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        // A 6-day task's end two working days to the right: Monday 11/9 to Wednesday 11/11.
        await dragBy(run.board, await endPoint(gantt, "ux"), 2 * WEEK_PX);
        const dates = await barDates(gantt);
        expect([dates.ux, dates.prototype, dates.reporting]).toEqual([
          "2026-11-02..2026-11-11",
          "2026-11-12..2026-11-18",
          "2026-12-08..2026-12-15",
        ]);
        expect(((await gantt.cell("ux", "duration").textContent()) ?? "").trim()).toBe("8");
        await dragBy(run.board, await endPoint(gantt, "architecture"), -10 * WEEK_PX);
        expect((await barDates(gantt)).architecture).toBe("2026-11-02..2026-11-02");
        expect(((await gantt.cell("architecture", "duration").textContent()) ?? "").trim()).toBe(
          "1",
        );
        await dragBy(run.board, await endPoint(gantt, "architecture"), -3 * WEEK_PX);
        expect(((await gantt.cell("architecture", "duration").textContent()) ?? "").trim()).toBe(
          "1",
        );
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a 500-task Gantt becomes visible within the load timeout, and a drop reschedules it within the step timeout",
      async () => {
        const from = Date.now();
        const run = await opened(withTasks(LIMIT_TASKS));
        expect(Date.now() - from).toBeLessThan(LOAD_TIMEOUT_MS);
        const gantt = ganttOf(run.board);
        expect(await gantt.bars.count()).toBe(500);
        // The first task three days later, its first request: the 24 after it in its chain follow.
        const last = (await barDates(gantt)).t25;
        const dropped = await armDropTimer(run.board, "t25");
        await dragBy(run.board, await grabPoint(gantt, "t1"), 3 * WEEK_PX);
        expect(await dropped()).toBeLessThan(STEP_TIMEOUT_MS);
        expect((await barDates(gantt)).t25).not.toBe(last);
        expect((await barDates(gantt)).t1).toBe("2026-11-05..2026-11-05");
        // Then a resize and a move of the request it now holds, which the live graph recalculates.
        const resized = await armDropTimer(run.board, "t1");
        await dragBy(run.board, await endPoint(gantt, "t1"), 2 * WEEK_PX);
        expect(await resized()).toBeLessThan(STEP_TIMEOUT_MS);
        expect((await barDates(gantt)).t1).toBe("2026-11-05..2026-11-06");
        const moved = await armDropTimer(run.board, "t1");
        await dragBy(run.board, await grabPoint(gantt, "t1"), 3 * WEEK_PX);
        expect(await moved()).toBeLessThan(STEP_TIMEOUT_MS);
        expect((await barDates(gantt)).t1).toBe("2026-11-09..2026-11-10");
        expect(await counterText(gantt)).toBe("Your changes: 1");
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
