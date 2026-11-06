// The work breakdown's estimates edited with the pointer, in each engine (view spec, "Tree
// editing"; molecules design decision 14): a click on a leaf's estimate cell then Enter, or a double
// click on it, opens its editor, and Enter commits what was typed, the values following. Neither
// opens an editor on a parent's estimate cell, which PERT ignores.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { cellTexts } from "./fixtures/wbs-documents.ts";
import { QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the WBS's estimates with the pointer`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a click then Enter on the portal's optimistic estimate opens its editor, and Enter commits 4",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await tree.cell("portal", 1).click({ timeout: STEP_TIMEOUT_MS });
        await run.board.page.keyboard.press("Enter");
        await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.board.page.keyboard.type("4");
        await run.board.page.keyboard.press("Enter");
        await tree.editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect((await cellTexts(tree.row("portal")))[1]).toBe("4 d");
        expect(await run.board.answer.isDisabled()).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a double click on the portal's pessimistic estimate opens its editor, and Enter commits 30",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await tree.cell("portal", 3).dblclick({ timeout: STEP_TIMEOUT_MS });
        await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
        await tree.editor.fill("30");
        await run.board.page.keyboard.press("Enter");
        await tree.editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect((await cellTexts(tree.row("portal")))[3]).toBe("30 d");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a double click on a parent's estimate cell opens no editor",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await tree.cell("build", 1).dblclick({ timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        expect(await tree.editor.count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
