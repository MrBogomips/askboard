// The Gantt's predecessors panel, in each engine, on the widget host (gantt-widget design
// decisions 9 and 12; spec, "Gantt predecessors"): Enter on "Depends on" opens it under the row,
// "Done" and Enter commit what is checked and Escape restores; a task that would close a cycle is
// disabled, saying why, and a task at 50 predecessors, or one with 50 dependents, takes no more.

import { describe, expect, test } from "bun:test";
import { schedule } from "./fixtures/gantt-documents.ts";
import { focusedBox, focusedCell, keysTo } from "./fixtures/gantt-input.ts";
import {
  barDates,
  ganttOf,
  LIMITS_TASKS,
  panelFacts,
  panelOf,
  withTasks,
} from "./fixtures/gantt-view.ts";
import { TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's predecessors`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "Enter on Depends on opens the panel under the row; Done and Enter commit what is checked, Escape restores",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const panel = panelOf(gantt, "billing");
        const before = await barDates(gantt);
        await keysTo(run.board, "billing", "dependencies");
        await run.board.page.keyboard.press("Enter");
        const others = [
          "UX design",
          "Architecture",
          "Clickable prototype",
          "Customer portal",
          "Reporting",
        ];
        expect(await panelFacts(panel)).toEqual(
          others.map((task) => ({
            task,
            checked: task === "Architecture",
            disabled: false,
            reason: "",
          })),
        );
        expect(await focusedBox(run.board)).toBe("UX design");
        await panel.getByRole("checkbox", { name: "Clickable prototype", exact: true }).click();
        expect(await barDates(gantt)).toEqual(before);
        await panel.getByRole("button", { name: "Done", exact: true }).click();
        expect(await panel.count()).toBe(0);
        expect((await barDates(gantt)).billing).toBe("2026-11-17..2026-11-27");
        expect(((await gantt.cell("billing", "dependencies").textContent()) ?? "").trim()).toBe(
          "Architecture, Clickable prototype",
        );
        expect(await focusedCell(run.board)).toBe("billing.dependencies");
        expect(await run.board.answer.isEnabled()).toBe(true);
        // Escape restores what the panel held when it opened.
        await run.board.page.keyboard.press("Enter");
        await panel.getByRole("checkbox", { name: "Clickable prototype", exact: true }).click();
        await run.board.page.keyboard.press("Escape");
        expect(await panel.count()).toBe(0);
        expect((await barDates(gantt)).billing).toBe("2026-11-17..2026-11-27");
        expect(await focusedCell(run.board)).toBe("billing.dependencies");
        // By keyboard only: the arrow keys move between the boxes, Space checks, Enter commits.
        await run.board.page.keyboard.press("Enter");
        for (const key of ["ArrowDown", "ArrowDown"]) await run.board.page.keyboard.press(key);
        expect(await focusedBox(run.board)).toBe("Clickable prototype");
        await run.board.page.keyboard.press("Space");
        await run.board.page.keyboard.press("Enter");
        expect(await panel.count()).toBe(0);
        expect(await barDates(gantt)).toEqual(before);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a task that would close a cycle is disabled in the panel, saying why",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await keysTo(run.board, "prototype", "dependencies");
        await run.board.page.keyboard.press("Enter");
        expect(await panelFacts(panelOf(gantt, "prototype"))).toEqual([
          { task: "UX design", checked: true, disabled: false, reason: "" },
          { task: "Architecture", checked: false, disabled: false, reason: "" },
          {
            task: "Customer portal",
            checked: false,
            disabled: true,
            reason: "Customer portal already depends on Clickable prototype",
          },
          { task: "Billing integration", checked: false, disabled: false, reason: "" },
          {
            task: "Reporting",
            checked: false,
            disabled: true,
            reason: "Reporting already depends on Clickable prototype",
          },
        ]);
        await run.board.page.keyboard.press("Escape");
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a task at 50 predecessors, or one with 50 dependents, takes no more, counting what is checked",
      async () => {
        const run = await opened(withTasks(LIMITS_TASKS));
        const gantt = ganttOf(run.board);
        const full = "Hub already has 50 predecessors, the most a task can have";
        const busy = "Source already has 50 dependent tasks, the most a task can have";
        await gantt.cell("hub", "dependencies").click();
        await run.board.page.keyboard.press("Enter");
        const hub = panelOf(gantt, "hub");
        const facts = await panelFacts(hub);
        expect(facts.filter((box) => box.checked).length).toBe(50);
        expect(facts.filter((box) => !box.checked)).toEqual([
          { task: "Source", checked: false, disabled: true, reason: full },
          { task: "X", checked: false, disabled: true, reason: full },
        ]);
        // One fewer checked, and X may be checked; then the limit holds again.
        await hub.getByRole("checkbox", { name: "P 50", exact: true }).click();
        const x = hub.getByRole("checkbox", { name: "X", exact: true });
        expect(await x.isEnabled()).toBe(true);
        await x.click();
        expect(await hub.getByRole("checkbox", { name: "P 50", exact: true }).isDisabled()).toBe(
          true,
        );
        await run.board.page.keyboard.press("Escape");
        await gantt.cell("x", "dependencies").click();
        await run.board.page.keyboard.press("Enter");
        const others = await panelFacts(panelOf(gantt, "x"));
        expect(others.find((box) => box.task === "Source")).toEqual({
          task: "Source",
          checked: false,
          disabled: true,
          reason: busy,
        });
        expect(others.filter((box) => box.disabled).length).toBe(1);
        await run.board.page.keyboard.press("Escape");
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
