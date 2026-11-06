// The Tree's row selection, in each engine, on the widget host (widget-editing-plus; view spec,
// "Tree row selection", "Tree selection is view state"): Space and Shift with the arrows select
// from the keyboard, the toolbar's "Select all" takes collapsed rows too, a parent's check box is
// partial while part of its branch is selected, and selecting changes no draft and no answer.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { treeFocus, treeGridOf } from "./harness/tree-grid.ts";
import { expectSteps, expectUnchanged, focusPortal, readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's row selection`, () => {
    const { host } = useWidgetHost(engine);

    const selectedIds = (tree: ReturnType<typeof treeGridOf>) =>
      tree.rows.evaluateAll((rows) =>
        rows
          .filter((row) => row.getAttribute("aria-selected") === "true")
          .map((row) => row.getAttribute("data-node-id")),
      );

    test(
      "Space on build selects its branch: four rows, the toolbar reads 4 selected, the header check box is partial, and nothing is answered",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [["ArrowUp", { nodeId: "build" }]]);
        await run.board.page.keyboard.press("Space");
        expect(await selectedIds(tree)).toEqual(["build", "portal", "billing", "reporting"]);
        await run.board.view.getByText("4 selected", { exact: true }).waitFor();
        const header = tree.grid.locator("[data-select-all]");
        expect(await header.evaluate((box: HTMLInputElement) => box.indeterminate)).toBe(true);
        expect(await treeFocus(run.board)).toEqual({ nodeId: "build" });
        await expectUnchanged(run);
        expect(run.drafts).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Space on portal, then Shift+ArrowDown twice, selects portal, billing and reporting and leaves the focus on reporting",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await run.board.page.keyboard.press("Space");
        await run.board.page.keyboard.press("Shift+ArrowDown");
        await run.board.page.keyboard.press("Shift+ArrowDown");
        expect(await selectedIds(tree)).toEqual(["build", "portal", "billing", "reporting"]);
        expect(await treeFocus(run.board)).toEqual({ nodeId: "reporting" });
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Select all with build collapsed selects every node, and Select none clears them",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowUp", { nodeId: "build" }],
          ["ArrowLeft", { nodeId: "build" }],
        ]);
        expect(await tree.row("build").getAttribute("aria-expanded")).toBe("false");
        await tree.tool("Select all").click();
        await run.board.view.getByText("8 selected", { exact: true }).waitFor();
        expect(await tree.grid.locator("[data-select-all]").isChecked()).toBe(true);
        await tree.tool("Select none").click();
        expect(await selectedIds(tree)).toEqual([]);
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a row's check box selects it without leaving the tree, and the header's selects and clears every node",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await tree.row("ux").locator("[data-select]").click();
        expect(await selectedIds(tree)).toEqual(["ux"]);
        expect(await treeFocus(run.board)).toEqual({ nodeId: "ux" });
        await tree.grid.locator("[data-select-all]").click();
        await run.board.view.getByText("8 selected", { exact: true }).waitFor();
        await tree.grid.locator("[data-select-all]").click();
        expect(await selectedIds(tree)).toEqual([]);
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
