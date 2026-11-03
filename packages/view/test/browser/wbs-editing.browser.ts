// The work breakdown's edits, in each engine, on the widget host (molecules design decision 14;
// view spec, "WBS values follow the edits"): a leaf's estimates entered by keyboard update its
// values, its parent's roll-ups and the Total within the same interaction, and move the plan that
// reads them, with nothing sent; an estimate outside its range shows a field error and keeps the
// editor and the draft; a parent's estimate cells take no edit; and the arrow keys reach the value
// cells, which no key edits.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { ganttOf, rowTexts } from "./fixtures/gantt-view.ts";
import { cellTexts, totalRow, wbsPlan } from "./fixtures/wbs-documents.ts";
import { isFocused, QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
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

/** A refused estimate's reason (molecules design decision 14). */
const OUT_OF_RANGE = "An estimate is 0 to 100,000 working days.";

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the WBS's edits`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the portal's estimates set to 4, 6 and 10 by keyboard update the portal, Build, the Total and the plan's reporting, with nothing sent",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        const plan = ganttOf(run.board, wbsPlan.id);
        const reportingBefore = (await rowTexts(plan)).find(([task]) => task === "reporting");
        await focusPortal(run, tree);
        await expectSteps(run, tree, [["ArrowRight", { nodeId: "portal", cell: 0 }]]);
        for (const [at, estimate] of [
          [1, "4"],
          [2, "6"],
          [3, "10"],
        ] as const) {
          await expectSteps(run, tree, [["ArrowRight", { nodeId: "portal", cell: at }]]);
          await typeIn(run, tree, "Enter", estimate);
          await run.board.page.keyboard.press("Enter");
          await tree.editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        }
        expect(await cellTexts(tree.row("portal"))).toEqual([
          "Customer portal",
          "4 d",
          "6 d",
          "10 d",
          "6.3 d",
          "1.0 d",
        ]);
        expect((await cellTexts(tree.row("build"))).slice(4)).toEqual(["20.3 d", "2.2 d"]);
        expect((await cellTexts(totalRow(tree))).slice(4)).toEqual(["34.3 d", "2.7 d"]);
        const reporting = (await rowTexts(plan)).find(([task]) => task === "reporting");
        expect(reporting?.[2]).not.toBe(reportingBefore?.[2]);
        expect(reporting?.[2]).toBe("11/26/2026");
        expect(await run.board.answer.isDisabled()).toBe(false);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: "plan" }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "-2 as an estimate shows a field error, keeps the editor and its focus, and leaves the draft",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        await typeIn(run, tree, "Enter", "-2");
        await run.board.page.keyboard.press("Enter");
        const error = run.board.view.getByText(OUT_OF_RANGE, { exact: true });
        await error.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(tree.editor)).toBe(true);
        expect(await tree.editor.getAttribute("aria-invalid")).toBe("true");
        expect((await cellTexts(tree.row("portal"))).slice(4)).toEqual(["12.7 d", "2.0 d"]);
        expect(run.drafts).toEqual([]);
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a parent's estimate cells take no edit, and the arrow keys reach the value cells, where Enter edits nothing",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowUp", { nodeId: "build" }],
          ["ArrowRight", { nodeId: "build", cell: 0 }],
          ["ArrowRight", { nodeId: "build", cell: 1 }],
        ]);
        for (const key of ["Enter", "F2"]) {
          await run.board.page.keyboard.press(key);
          await Bun.sleep(QUIET_MS);
          expect(await tree.editor.count()).toBe(0);
        }
        await expectSteps(run, tree, [
          ["End", { nodeId: "build", cell: 5 }],
          ["ArrowLeft", { nodeId: "build", cell: 4 }],
          ["ArrowDown", { nodeId: "portal", cell: 4 }],
          ["ArrowRight", { nodeId: "portal", cell: 5 }],
          ["ArrowRight", { nodeId: "portal", cell: 5 }],
        ]);
        for (const key of ["Enter", "F2"]) {
          await run.board.page.keyboard.press(key);
          await Bun.sleep(QUIET_MS);
          expect(await tree.editor.count()).toBe(0);
        }
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
