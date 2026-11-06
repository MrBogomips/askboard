// The Gantt's editing scenarios, in each engine, on the widget host (gantt-widget design decisions
// 9 and 12; spec, "Gantt editing in the grid" and "Gantt keyboard"): Enter and F2 edit a start or
// a duration with the parsed value echoed, and Enter commits, the dependents and the critical path
// following; a refused value shows under its row, keeping the focus and the draft, and Escape
// restores; Delete or Backspace on a requested start clears it.

import { describe, expect, test } from "bun:test";
import { schedule } from "./fixtures/gantt-documents.ts";
import { editorFocused, focusedCell, keysTo } from "./fixtures/gantt-input.ts";
import { alignment, barDates, criticalTasks, ganttOf } from "./fixtures/gantt-view.ts";
import { TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's editing`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "typing a start: Enter edits it with the parsed day echoed, Enter commits, and the task, the end and the critical path move",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await keysTo(run.board, "reporting", "start");
        await run.board.page.keyboard.press("Enter");
        const editor = gantt.cell("reporting", "start").locator("input");
        expect(await editor.inputValue()).toBe("12/4/2026");
        expect(await editorFocused(run.board, "reporting", "start")).toBe(true);
        await run.board.page.keyboard.type("12/9/2026");
        expect(await gantt.cell("reporting", "start").textContent()).toContain(
          "= Wed, Dec 9, 2026",
        );
        await run.board.page.keyboard.press("Enter");
        expect(await editor.count()).toBe(0);
        expect(((await gantt.cell("reporting", "start").textContent()) ?? "").trim()).toBe(
          "Wed 12/9",
        );
        expect((await barDates(gantt)).reporting).toBe("2026-12-09..2026-12-16");
        expect(await criticalTasks(gantt)).toEqual(["reporting"]);
        expect(await focusedCell(run.board)).toBe("reporting.start");
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "F2 edits a start and a duration, and the dependents and the critical path follow each commit",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        // The portal three working days later: reporting, and the plan's end, three days later.
        await keysTo(run.board, "portal", "start");
        await run.board.page.keyboard.press("F2");
        await run.board.page.keyboard.type("11/20/2026");
        await run.board.page.keyboard.press("Enter");
        const dates = await barDates(gantt);
        expect([dates.portal, dates.reporting]).toEqual([
          "2026-11-20..2026-12-08",
          "2026-12-09..2026-12-16",
        ]);
        expect(await criticalTasks(gantt)).toEqual(["portal", "reporting"]);
        await keysTo(run.board, "billing", "duration");
        await run.board.page.keyboard.press("F2");
        expect(await gantt.cell("billing", "duration").locator("input").inputValue()).toBe("9");
        await run.board.page.keyboard.type("30");
        expect(await gantt.cell("billing", "duration").textContent()).toContain("= 30");
        await run.board.page.keyboard.press("Enter");
        expect(((await gantt.cell("billing", "duration").textContent()) ?? "").trim()).toBe("30 d");
        expect((await barDates(gantt)).billing).toBe("2026-11-06..2026-12-17");
        expect(await criticalTasks(gantt)).toEqual(["architecture", "billing"]);
        expect(await focusedCell(run.board)).toBe("billing.duration");
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a start before the earliest, on a weekend or no day, and a duration of 2.5, are refused under the row, keeping the focus and the draft; Escape restores",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const before = await barDates(gantt);
        await keysTo(run.board, "reporting", "start");
        await run.board.page.keyboard.press("Enter");
        const editor = gantt.cell("reporting", "start").locator("input");
        const refusals = [
          ["11/20/2026", "12/4/2026"],
          ["12/12/2026", "working day"],
          ["2/30/2026", "no day 30"],
        ] as const;
        for (const [entry, said] of refusals) {
          await editor.fill(entry);
          await run.board.page.keyboard.press("Enter");
          expect({ entry, note: await gantt.note("reporting").textContent() }).toEqual({
            entry,
            note: expect.stringContaining(said),
          });
          expect(await editorFocused(run.board, "reporting", "start")).toBe(true);
          expect(await run.board.answer.isDisabled()).toBe(true);
        }
        await run.board.page.keyboard.press("Escape");
        expect(await editor.count()).toBe(0);
        expect(await gantt.note("reporting").count()).toBe(0);
        expect(((await gantt.cell("reporting", "start").textContent()) ?? "").trim()).toBe(
          "Fri 12/4",
        );
        expect(await focusedCell(run.board)).toBe("reporting.start");
        // A refused duration in a middle row: the rows under it move down with the chart's.
        await keysTo(run.board, "portal", "duration");
        await run.board.page.keyboard.press("Enter");
        await run.board.page.keyboard.type("2.5");
        await run.board.page.keyboard.press("Enter");
        expect(await gantt.note("portal").textContent()).toContain("whole");
        expect(await editorFocused(run.board, "portal", "duration")).toBe(true);
        const lined = await alignment(gantt);
        expect(lined.map(({ task, row }) => [task, row])).toEqual(
          ["ux", "architecture", "prototype", "portal", "billing", "reporting"].map(
            (task, index) => [task, 32 + 36 * index + (index > 3 ? 20 : 0)],
          ),
        );
        for (const { row, bar } of lined) expect(bar).toBe(row);
        await run.board.page.keyboard.press("Escape");
        expect(await barDates(gantt)).toEqual(before);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Delete or Backspace on a requested start clears it: the task moves back to its earliest start",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        for (const key of ["Delete", "Backspace"]) {
          await keysTo(run.board, "reporting", "start");
          await run.board.page.keyboard.press("Enter");
          await run.board.page.keyboard.type("12/9/2026");
          await run.board.page.keyboard.press("Enter");
          expect((await barDates(gantt)).reporting).toBe("2026-12-09..2026-12-16");
          expect(await run.board.answer.isEnabled()).toBe(true);
          await run.board.page.keyboard.press(key);
          expect({ key, dates: (await barDates(gantt)).reporting }).toEqual({
            key,
            dates: "2026-12-04..2026-12-11",
          });
          // Back to the agent's value: the draft holds nothing, and Answer is disabled again.
          expect(await run.board.answer.isDisabled()).toBe(true);
          expect(await focusedCell(run.board)).toBe("reporting.start");
        }
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
