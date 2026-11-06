// The Tree toolbar's counter and overflow, in each engine, on the widget host (widget-editing-plus
// spec, "Tree toolbar overflow"; review F-16): at 1280 px in en-US all seven tools show and the
// counter reads "No changes"; at 700 px in it-IT, where the seven tools alone leave the counter too
// little (the adjustment tools of later tasks reach that at 1024), no label overprints another and
// the move tools are in "More", which opens by keyboard and acts on the current row.

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readyIn, shownIds, TOOL_LABELS } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const italian = { ...treeBoardDocument, language: "it-IT" } as unknown as ViewDocument;
const MOVES = ["Move up", "Move down", "Indent", "Outdent"];

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree toolbar's counter and overflow`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "at 1280 px in en-US all seven tools show, with no More, and the counter reads No changes",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        expect(await tree.tools.allTextContents()).toEqual(TOOL_LABELS);
        expect(await tree.counter.textContent()).toBe("No changes");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "at a narrow width in it-IT no label overprints another and the move tools are in More, which opens by keyboard and acts on the current row",
      async () => {
        const run = await host(dist, italian);
        await run.board.page.setViewportSize({ width: 700, height: 800 });
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await tree.counter.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tree.counter.textContent()).toBe("Nessuna modifica");
        const labels = await tree.tools.allTextContents();
        expect(labels).toContain("Altro");
        for (const move of MOVES) expect(labels).not.toContain(move);
        // No tool, "More" included, overlaps the counter or another tool.
        const boxes: Box[] = [];
        for (const button of await tree.tools.all()) {
          const box = await button.boundingBox();
          if (box !== null) boxes.push(box);
        }
        const counter = await tree.counter.boundingBox();
        if (counter === null) throw new Error("no counter box");
        for (const [at, box] of boxes.entries()) {
          expect(overlap(box, counter)).toBe(false);
          for (const other of boxes.slice(at + 1)) expect(overlap(box, other)).toBe(false);
        }
        // A click marks the row; "More" opens by keyboard and "Move down" acts on it.
        await tree.cell("ux", 0).click({ timeout: STEP_TIMEOUT_MS });
        await tree.tool("Altro").focus();
        await run.board.page.keyboard.press("Enter");
        const item = run.board.view.getByRole("menuitem", { name: "Sposta giù" });
        await item.waitFor({ timeout: STEP_TIMEOUT_MS });
        // The crowded row gives up "Select all" and "Select none" too, with the four moves.
        expect(await run.board.view.getByRole("menuitem").count()).toBe(MOVES.length + 2);
        await item.click({ timeout: STEP_TIMEOUT_MS });
        expect((await shownIds(tree)).slice(0, 3)).toEqual(["design", "architecture", "ux"]);
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
