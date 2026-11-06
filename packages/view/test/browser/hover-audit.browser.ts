// The hover and focus audit of the board's controls, in each engine, on the widget host
// (widget-editing-plus task 7.1; spec, "Hover and focus feedback", "Hover cursors and looks" and
// "No hover feedback where nothing responds"), on the controls this change added and the ones the
// shared layer of task 1.1 could miss: a button, an editable cell, a disabled control, the drag
// handle, the column edge and a Gantt bar, in the light and the dark scheme, and the read-only
// widgets. `hover-layer.browser.ts` holds the first layer's own scenarios.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { ViewUpdate } from "../../src/view-protocol.ts";
import { chooseWeek, planGantt } from "./fixtures/gantt-plan.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import { handleOf } from "./harness/tree-drag.ts";
import { enabledTools, treeGridOf } from "./harness/tree-grid.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();
const ADJUST = "Adjust by %…";

/** The computed cursor and hover look of an element. */
const lookOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      cursor: style.cursor,
      background: style.backgroundColor,
      border: style.borderTopColor,
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    };
  });

const hovered = async (locator: Locator) => {
  await locator.hover();
  return lookOf(locator);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme: a disabled "Adjust by %…" shows not-allowed and no change, an enabled one the pointer and the hover pair, the drag handle grab, the column edge col-resize with the strong outline, and a bar grab`,
        async () => {
          const run = await host(dist, ganttPlanBoardDocument, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const gantt = ganttOf(board, planGantt.id);
          await chooseWeek(gantt);
          // A disabled control: nothing selected, so the adjustment is not offered.
          const resting = await lookOf(tree.tool(ADJUST));
          const disabled = await hovered(tree.tool(ADJUST));
          expect(disabled.cursor).toBe("not-allowed");
          expect(disabled.background).toBe(resting.background);
          expect(disabled.border).toBe(resting.border);
          // The same button, enabled by a selection: the pointer, the strong border, the card fill.
          await tree.row("portal").locator("[data-select]").click();
          const button = await hovered(tree.tool(ADJUST));
          expect(button.cursor).toBe("pointer");
          expect(button.border).toBe(tokenColor("border-strong", scheme));
          expect(button.background).toBe(tokenColor("card", scheme));
          // The drag handle shows on the row's hover, with the grab cursor.
          await tree.row("billing").hover();
          expect((await lookOf(handleOf(tree, "billing"))).cursor).toBe("grab");
          // The column edge: the resize cursor and the hover outline; the focus ring is not its hover.
          const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
          const edgeLook = await hovered(edge);
          expect(edgeLook.cursor).toBe("col-resize");
          expect(edgeLook.outline).toBe(`1px solid ${tokenColor("border-strong", scheme)}`);
          // A bar of a plan takes the grab cursor, and its end the horizontal resize one.
          expect((await hovered(gantt.bar("portal"))).cursor).toBe("grab");
          const grip = gantt.root.locator('[data-gantt-handle="portal"]');
          expect((await hovered(grip)).cursor).toBe("ew-resize");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "a read-only plan and Tree show no handle, no grab on a bar, no text cursor on a cell and no hover change on a tool; the column edge still resizes",
      async () => {
        const run = await host(dist, ganttPlanBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, planGantt.id);
        await chooseWeek(gantt);
        const update: ViewUpdate = { type: "state", state: openStateOf(ganttPlanBoardDocument) };
        await run.update({ ...update, lock: "moved" });
        await eventually(
          async () => (await enabledTools(tree.tools)).length === 0,
          "every tool disabled",
        );
        expect(await tree.grid.locator("[data-drag-handle]").count()).toBe(0);
        expect(await gantt.root.locator("[data-gantt-handle]").count()).toBe(0);
        expect((await hovered(gantt.bar("portal"))).cursor).not.toBe("grab");
        const cell = await hovered(tree.cell("portal", 1));
        expect(cell.cursor).not.toBe("text");
        expect(cell.outline).not.toContain("1px solid");
        const tool = await hovered(tree.tool("Move down"));
        expect(tool.cursor).toBe("not-allowed");
        const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
        expect((await hovered(edge)).cursor).toBe("col-resize");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
