// Double-click in the Gantt's grid, in each engine, on the widget host (widget-editing-plus design
// decision 9; view spec, "Double-click opens a cell's editor"): a double click on an editable
// start or duration opens its editor, as Enter does, and on a predecessors cell the panel Enter
// opens; on a name, and after "Answer", it opens nothing; and no text of the grid becomes selected.

import { describe, expect, test } from "bun:test";
import { schedule } from "./fixtures/gantt-documents.ts";
import { dragBy, grabPoint } from "./fixtures/gantt-input.ts";
import { ganttOf, panelOf } from "./fixtures/gantt-view.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: double-click in the Gantt's grid`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    /** What the view's document has selected as text, apart from an open editor's own selected text. */
    const selection = async (run: Awaited<ReturnType<typeof opened>>) => {
      const view = await run.board.viewFrame();
      return view.evaluate(() => {
        const text = window.getSelection()?.toString() ?? "";
        const field = document.activeElement;
        const own =
          field instanceof HTMLInputElement
            ? field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)
            : "";
        return text === own ? "" : text;
      });
    };

    test(
      "opens the editor of a start or a duration and the predecessors panel, none on a name, and selects no text",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await gantt.cell("reporting", "start").dblclick();
        expect(await gantt.grid.locator("input").count()).toBe(1);
        expect(await selection(run)).toBe("");
        await run.board.page.keyboard.press("Escape");
        expect(await gantt.grid.locator("input").count()).toBe(0);
        await gantt.cell("billing", "duration").dblclick();
        expect(await gantt.grid.locator("input").inputValue()).toBe("9");
        await run.board.page.keyboard.press("Enter");
        await gantt.cell("billing", "dependencies").dblclick();
        await panelOf(gantt, "billing").waitFor();
        await run.board.page.keyboard.press("Escape");
        await gantt.cell("ux", "task").dblclick();
        expect(await gantt.grid.locator("input").count()).toBe(0);
        expect(await panelOf(gantt, "ux").count()).toBe(0);
        expect(await selection(run)).toBe("");
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after Answer a double click opens nothing",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await dragBy(run.board, await grabPoint(gantt, "reporting"), 75);
        await run.board.answer.click();
        await eventually(() => run.messages.length > 1, "the answer message");
        await run.board.receipt("sent").waitFor();
        for (const column of ["start", "duration", "dependencies"]) {
          await gantt.cell("billing", column).dblclick();
        }
        expect(await gantt.grid.locator("input").count()).toBe(0);
        expect(await panelOf(gantt, "billing").count()).toBe(0);
        expect(await selection(run)).toBe("");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
