// The Tree's current row, in each engine, on the widget host (widget-editing-plus spec, "Tree
// current row"; review F-02): none when the Tree opens, with the row tools disabled; a click marks
// a row with the `primary-subtle` fill and the `primary` left bar although the focus ring is not
// shown; "Move down" and "Delete" act on the marked row, which keeps the mark when the focus
// leaves.

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import { enabledTools, treeGridOf } from "./harness/tree-grid.ts";
import { FIXTURE_IDS, readyIn, shownIds } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const CURRENT = '[aria-current="true"]';

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's current row`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "no row is current at open and the row tools are disabled; a click marks the row, without the focus ring, and Move down and Delete act on it",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tree.grid.locator(CURRENT).count()).toBe(0);
        expect(await enabledTools(tree.tools)).toEqual([]);
        // A click marks the row: its fill, its left bar, and no focus ring.
        await tree.cell("ux", 0).click({ timeout: STEP_TIMEOUT_MS });
        const row = tree.row("ux");
        // The pointer leaves the cell, whose hover outline would otherwise read as a ring.
        await board.view.getByRole("heading", { name: plan.props.text }).hover();
        expect(await tree.grid.locator(CURRENT).count()).toBe(1);
        expect(await row.getAttribute("aria-current")).toBe("true");
        const paint = await row.evaluate((element) => ({
          background: getComputedStyle(element).backgroundColor,
          bar: getComputedStyle(element.querySelector("[data-cell]") ?? element).boxShadow,
          ring: getComputedStyle(element.querySelector("[data-cell]") ?? element).outlineStyle,
        }));
        expect(paint.background).toBe(tokenColor("primary-subtle", "light"));
        expect(paint.bar).toContain(tokenColor("primary", "light"));
        expect(paint.ring).toBe("none");
        // The tools act on the marked row.
        await tree.tool("Move down").click({ timeout: STEP_TIMEOUT_MS });
        expect(await shownIds(tree)).toEqual([
          "design",
          "architecture",
          "ux",
          "prototype",
          "build",
          "portal",
          "billing",
          "reporting",
        ]);
        expect(await tree.grid.locator(CURRENT).getAttribute("data-node-id")).toBe("ux");
        await tree.tool("Delete").click({ timeout: STEP_TIMEOUT_MS });
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS.filter((id) => id !== "ux"));
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the mark stays after the focus leaves the Tree, and an arrow key moves it",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await tree.cell("architecture", 0).click({ timeout: STEP_TIMEOUT_MS });
        await board.view.getByRole("heading", { name: plan.props.text }).click();
        expect(await tree.row("architecture").getAttribute("aria-current")).toBe("true");
        expect((await enabledTools(tree.tools)).length).toBeGreaterThan(0);
        await tree.cell("architecture", 0).focus();
        await board.page.keyboard.press("ArrowDown");
        await eventually(
          async () => (await tree.row("prototype").getAttribute("aria-current")) === "true",
          "the mark on the next row",
        );
        expect(await tree.grid.locator(CURRENT).count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
