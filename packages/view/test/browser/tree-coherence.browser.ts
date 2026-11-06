// The estimates stay in order, in each engine, on the widget host (widget-editing-plus; view spec,
// "Estimates stay in order", "Estimates in order, the edge cases"): a cell edit that breaks
// optimistic <= most likely <= pessimistic is refused with a message naming the rule, the focus and
// the text kept and the draft unchanged; a bulk adjustment is all or nothing, its preview naming
// the rows, and a coherent one applies.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { isFocused, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import {
  expectSteps,
  expectUnchanged,
  focusPortal,
  readyIn,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();
const ADJUST = "Adjust by %…";

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the estimates stay in order`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "an optimistic above the most likely is refused naming the rule, keeps the editor, its focus and its text, and the draft is unchanged",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        await typeIn(run, tree, "Enter", "99999");
        await run.board.page.keyboard.press("Enter");
        const message = run.board.view.getByText("Optimistic must not exceed Most likely.", {
          exact: true,
        });
        await message.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(tree.editor)).toBe(true);
        expect(await tree.editor.inputValue()).toBe("99999");
        expect(run.drafts).toEqual([]);
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a negative estimate names the range, and an optimistic equal to the most likely commits",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        await typeIn(run, tree, "Enter", "-1");
        await run.board.page.keyboard.press("Enter");
        await run.board.view
          .getByText("An estimate is 0 to 100,000 working days.", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(run.drafts).toEqual([]);
        await run.board.page.keyboard.press("Escape");
        const likely = (await tree.cell("portal", 2).textContent())?.replace(/ d$/, "") ?? "";
        await typeIn(run, tree, "Enter", likely);
        await run.board.page.keyboard.press("Enter");
        await tree.editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a bulk adjustment that would break one row names it and its column, disables Apply and changes no value; a coherent one applies",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await tree.grid.locator("[data-select-all]").click();
        await tree.tool(ADJUST).click();
        const panel = board.view.getByRole("dialog");
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        for (const column of ["Most likely", "Pessimistic"])
          await panel.getByLabel(column).uncheck();
        await panel.getByLabel("Percentage").fill("+300");
        await panel.getByText(/Nothing is applied/).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await panel.getByText(/, Optimistic/).count()).toBeGreaterThan(0);
        expect(await panel.getByRole("button", { name: "Apply" }).isDisabled()).toBe(true);
        expect(await tree.marks("field").count()).toBe(0);
        for (const column of ["Most likely", "Pessimistic"]) await panel.getByLabel(column).check();
        await panel.getByLabel("Percentage").fill("+10");
        const apply = panel.getByRole("button", { name: "Apply" });
        await apply.click();
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await tree.marks("field").count()).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
