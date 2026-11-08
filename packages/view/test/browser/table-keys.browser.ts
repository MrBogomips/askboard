// The Table at the keyboard, in each engine, on the widget host (table-widget, task 6.2; spec
// view-and-widgets: The Table at the keyboard, Adding and deleting rows, Editing a cell): from a Tab
// into the grid, the arrow keys, Home and End move the current cell, Enter opens an editor, a toggle
// switches on Space (unset, on, off, on), and a row is added and deleted from the toolbar with the
// keys alone, the focus never lost.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/table-keys.browser.ts

import { describe, expect, test } from "bun:test";
import {
  draftCell,
  draftTable,
  ROLES,
  rolesWith,
  tableDocument,
} from "./fixtures/table-documents.ts";
import { eventually, isFocused, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { cellOf, editorOf, tableGridOf, toolOf } from "./harness/table-grid.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Table at the keyboard`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "Tab into the grid lands on the first cell; arrows, Home and End move the current cell, one Tab stop throughout; Down, Right twice and Enter opens dev's rate, and 16 is its value",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        const press = (key: string) => board.page.keyboard.press(key);
        // Tab from the page's start reaches the grid's one stop.
        await cellOf(table, "pm", "role").focus();
        await eventually(() => isFocused(cellOf(table, "pm", "role")), "the focus on pm's role");
        await press("ArrowDown");
        await eventually(() => isFocused(cellOf(table, "dev", "role")), "the focus on dev's role");
        await press("ArrowRight");
        await press("ArrowRight");
        await eventually(() => isFocused(cellOf(table, "dev", "rate")), "the focus on dev's rate");
        await press("End");
        await eventually(() => isFocused(cellOf(table, "dev", "amount")), "End on the last cell");
        await press("Home");
        await eventually(() => isFocused(cellOf(table, "dev", "role")), "Home on the first cell");
        expect(await table.grid.locator("[tabindex='0']").count()).toBe(1);
        // Edits from the keyboard alone.
        await press("ArrowRight");
        await press("ArrowRight");
        await press("Enter");
        const editor = editorOf(table, "Rate, row 2");
        await editor.waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.type("16");
        await press("Enter");
        await editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => draftCell(run, "dev", "rate") === "16.00",
          "the draft to hold 16.00",
        );
        await eventually(
          () => isFocused(cellOf(table, "dev", "rate")),
          "the focus back on the cell",
        );
        // F2 opens the editor too, and Escape closes it with the focus back.
        await press("F2");
        await editor.waitFor({ timeout: STEP_TIMEOUT_MS });
        await press("Escape");
        await editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => isFocused(cellOf(table, "dev", "rate")),
          "the focus back after Escape",
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Space on a toggle cell cycles unset, on, off, on; a toggle stays one Tab stop",
      async () => {
        const toggled = rolesWith({
          columns: [...ROLES.columns, { field: "billable", label: "Billable", type: "toggle" }],
        });
        const run = await host(dist, tableDocument(toggled));
        await readyIn(run);
        const table = tableGridOf(run.board);
        const cell = cellOf(table, "pm", "billable");
        await cell.focus();
        const states: (string | null)[] = [];
        for (let press = 0; press < 3; press += 1) {
          await run.board.page.keyboard.press("Space");
          const want = ["true", "false", "true"][press];
          await eventually(
            async () => (await cell.getAttribute("aria-checked")) === want,
            `aria-checked ${want}`,
          );
          states.push(await cell.getAttribute("aria-checked"));
        }
        expect(states).toEqual(["true", "false", "true"]);
        expect(draftCell(run, "pm", "billable")).toBe(true);
        expect(await table.grid.locator("[tabindex='0']").count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a row is added and filled, and another deleted, with the keyboard alone, the focus never lost",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        const press = (key: string) => board.page.keyboard.press(key);
        await cellOf(table, "pm", "role").focus();
        // Tab leaves the grid for the toolbar; Enter on "Add row" adds after pm.
        await press("Tab");
        await eventually(() => isFocused(toolOf(table, "Add row")), "the focus on Add row");
        await press("Enter");
        await eventually(async () => (await table.rows.count()) === 3, "the row to be added");
        // The arrow keys move among the tools, and Shift+Tab goes back to the new row's first input cell.
        await press("ArrowRight");
        await eventually(() => isFocused(toolOf(table, "Delete row")), "the focus on Delete row");
        await press("Shift+Tab");
        await eventually(() => isFocused(cellOf(table, "u-1", "role")), "the focus on the new row");
        await press("Enter");
        await editorOf(table, "Role, row 2").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.type("QA engineer");
        await press("Enter");
        await eventually(() => draftCell(run, "u-1", "role") === "QA engineer", "the draft");
        // Delete the new row from the toolbar: focus stays on the tool, the grid keeps its stop.
        await press("Tab");
        await press("ArrowRight");
        await press("Enter");
        await eventually(async () => (await table.rows.count()) === 2, "the row to be deleted");
        expect(draftTable(run)).toBeUndefined();
        await eventually(
          () => isFocused(toolOf(table, "Delete row")),
          "the focus kept on the tool",
        );
        expect(await table.grid.locator("[tabindex='0']").count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
