// The Tree's bulk percentage adjustment, in each engine, on the widget host (widget-editing-plus;
// view spec, "Tree bulk percentage adjustment panel", "Tree bulk adjustment preview", "A bulk
// adjustment is changes", "Tree adjustment undo"): by keyboard only a selection is adjusted once,
// with no navigation; Cancel and Escape change nothing; the adjustment is highlighted, counted and
// answered as one set per changed value; Undo adjust, by button and by Ctrl or Cmd with Z, puts
// every value back, and any other edit takes the button away.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { eventually, isFocused, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { pressIn, type pressTool, toolFocus, treeFocus, treeGridOf } from "./harness/tree-grid.ts";
import { expectUnchanged, focusPortal, pageOf, readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();
const ADJUST = "Adjust by %…";
const DONE = /^Adjusted \d+ values by \+15%\. Undo$/;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's bulk adjustment`, () => {
    const { host } = useWidgetHost(engine);

    // Tabs back to the toolbar from the tree and arrows to "Adjust by %…".
    const toAdjust = async (board: Parameters<typeof pressTool>[0]) => {
      await board.page.keyboard.press("Shift+Tab");
      for (let presses = 0; (await toolFocus(board)) !== ADJUST; presses += 1) {
        if (presses === 20) throw new Error(`the arrows never reached "${ADJUST}"`);
        await board.page.keyboard.press("ArrowRight");
      }
    };

    test(
      "by keyboard only: select rows with Space, open the panel with Enter, uncheck Optimistic with Space, type 15 and press Enter: one adjustment, no navigation",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const before = await pageOf(run);
        await focusPortal(run, tree);
        await board.page.keyboard.press("Space");
        await board.page.keyboard.press("Shift+ArrowDown");
        await board.page.keyboard.press("Shift+ArrowDown");
        await toAdjust(board);
        await board.page.keyboard.press("Enter");
        const panel = board.view.getByRole("dialog");
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await panel.getByLabel("Optimistic").isChecked()).toBe(true);
        await board.page.keyboard.press("Space");
        expect(await panel.getByLabel("Optimistic").isChecked()).toBe(false);
        await board.page.keyboard.type("15");
        const apply = panel.getByRole("button", { name: "Apply" });
        await eventually(async () => !(await apply.isDisabled()), "Apply enabled", STEP_TIMEOUT_MS);
        await board.page.keyboard.press("Enter");
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await toolFocus(board)).toBe(ADJUST);
        await eventually(
          async () => DONE.test((await board.view.getByRole("status").textContent()) ?? ""),
          "the announcement",
          STEP_TIMEOUT_MS,
        );
        expect(await pageOf(run)).toEqual(before);
        expect(await tree.cell("portal", 2).getAttribute("data-change")).toBe("field");
        expect(await tree.cell("portal", 1).getAttribute("data-change")).toBeNull();
        expect(await board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a percentage that is refused shows a message and keeps Apply disabled; Escape closes the panel with nothing changed and the focus back on the button",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await tree.grid.locator("[data-select-all]").click();
        await tree.tool(ADJUST).click();
        const panel = board.view.getByRole("dialog");
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        const field = panel.getByLabel("Percentage");
        for (const refused of ["-100", "+1001", "12,5", "1.25"]) {
          await field.fill(refused);
          expect(await panel.getByRole("button", { name: "Apply" }).isDisabled()).toBe(true);
          expect(await field.getAttribute("aria-invalid")).toBe("true");
        }
        await field.fill("+10");
        expect(await panel.getByText("=", { exact: false }).count()).toBe(0);
        await board.page.keyboard.press("Escape");
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(tree.tool(ADJUST))).toBe(true);
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Undo adjust, by button and by the keyboard, puts the values back; the draft is empty again; another edit takes the button away",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await tree.row("portal").locator("[data-select]").click();
        await tree.tool(ADJUST).click();
        const panel = board.view.getByRole("dialog");
        await panel.getByLabel("Percentage").fill("15");
        await panel.getByRole("button", { name: "Apply" }).click();
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await tree.tool("Undo adjust").waitFor();
        await tree.tool("Undo adjust").click();
        await eventually(
          async () => (await tree.counter.textContent()) === "No changes",
          "No changes",
          STEP_TIMEOUT_MS,
        );
        expect(await tree.tool("Undo adjust").count()).toBe(0);
        await expectUnchanged(run);
        // By the keyboard: Ctrl or Cmd with Z in the tree.
        await tree.tool(ADJUST).click();
        await panel.getByLabel("Percentage").fill("15");
        await panel.getByRole("button", { name: "Apply" }).click();
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await pressIn(board, "Tab")).toEqual(await treeFocus(board));
        await board.page.keyboard.press("ControlOrMeta+z");
        await eventually(
          async () => (await tree.counter.textContent()) === "No changes",
          "No changes by the keyboard",
          STEP_TIMEOUT_MS,
        );
        // Another edit takes the button away.
        await tree.tool(ADJUST).click();
        await panel.getByLabel("Percentage").fill("15");
        await panel.getByRole("button", { name: "Apply" }).click();
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await tree.cell("ux", 0).dblclick();
        await board.page.keyboard.type("UX research");
        await board.page.keyboard.press("Enter");
        await tree.tool("Undo adjust").waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the answer of an adjustment carries the edited Tree once, with the derived values as they stand",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await tree.grid.locator("[data-select-all]").click();
        await tree.tool(ADJUST).click();
        const panel = board.view.getByRole("dialog");
        for (const column of ["Optimistic", "Pessimistic"])
          await panel.getByLabel(column).uncheck();
        await panel.getByLabel("Percentage").fill("+10");
        await panel.getByRole("button", { name: "Apply" }).click();
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await tree.marks("field").count()).toBeGreaterThan(0);
        await board.answer.click();
        await eventually(() => run.messages.length > 1, "the answer message", STEP_TIMEOUT_MS);
        const answers = run.messages.filter((message) => message.type === "answer");
        expect(answers).toHaveLength(1);
        expect(answers[0]).toMatchObject({ type: "answer", derived: expect.any(Object) });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
