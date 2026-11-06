// The Tree's change highlight, in each engine, on the widget host (tree-widget design decision 6;
// proposal, open question 14; spec, "Tree change highlight"; DESIGN.md, Change highlight): what
// the user changed against what the agent sent takes the user-change hue in either scheme, a
// renamed name and a changed field on the change fill with the change border, an added row the
// change bar and a moved row a change mark on its name; the toolbar row counts the nodes changed,
// each once, also while a delete asks first.

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  deleteQuestion,
  focusRing,
  paintOf,
  pressIn,
  shiftTabToAddNode,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  expectNewNode,
  expectSteps,
  focusPortal,
  markedIds,
  NONE_YET,
  placeOf,
  RING,
  readyIn,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** The vertical middle of a box, to tell that two elements sit in one row. */
const middleOf = (box: { y: number; height: number } | null): number =>
  box === null ? Number.NaN : box.y + box.height / 2;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's change highlight`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the counter reads none yet, then counts each node changed once: 3 after renaming portal, adding u-1 and deleting reporting",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tree.counter.textContent()).toBe(NONE_YET);
        expect(await tree.marks().count()).toBe(0);
        // Renaming `portal`: its name takes the highlight, and the counter counts it.
        await focusPortal(run, tree);
        await typeIn(run, tree, "Enter", "Customer portal: accounts");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal" });
        expect(await tree.marks("renamed").textContent()).toBe("Customer portal: accounts");
        expect(await tree.counter.textContent()).toBe("Your changes: 1");
        // A new node shows the added mark at once (review F-11) but is not counted until its name
        // is committed.
        expect(await shiftTabToAddNode(board)).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        expect(await tree.row("u-1").getAttribute("data-change")).toBe("added");
        expect(await tree.counter.textContent()).toBe("Your changes: 1");
        await board.page.keyboard.type("Customer portal: dashboards");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        expect(await tree.counter.textContent()).toBe("Your changes: 2");
        // The spec's "Counting changes": deleting `reporting` makes 3.
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "billing", cell: 0 }],
          ["ArrowDown", { nodeId: "reporting", cell: 0 }],
        ]);
        expect(await pressIn(board, "Delete")).toEqual({ nodeId: "billing", cell: 0 });
        expect(await tree.counter.textContent()).toBe("Your changes: 3");
        expect(await markedIds(tree)).toEqual(["portal renamed", "u-1 added"]);
        // Renamed back, `portal` is the agent's again: unmarked and no longer counted.
        await expectSteps(run, tree, [
          ["ArrowUp", { nodeId: "u-1", cell: 0 }],
          ["ArrowUp", { nodeId: "portal", cell: 0 }],
        ]);
        await typeIn(run, tree, "Enter", "Customer portal");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 0 });
        expect(await markedIds(tree)).toEqual(["u-1 added"]);
        expect(await tree.counter.textContent()).toBe("Your changes: 2");
        // While a delete asks first, the counter keeps its place in the toolbar row, at its right.
        await tree.cell("design", 0).click({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Delete");
        const question = deleteQuestion(
          board,
          "“Design” and the 3 nodes under it will be deleted.",
        );
        await question.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tree.counter.textContent()).toBe("Your changes: 2");
        const [asked, counted] = [await question.boundingBox(), await tree.counter.boundingBox()];
        expect(Math.abs(middleOf(asked) - middleOf(counted))).toBeLessThanOrEqual(2);
        expect(counted?.x ?? 0).toBeGreaterThanOrEqual((asked?.x ?? 0) + (asked?.width ?? 0));
        // Confirming deletes `design` and its 3 nodes: each counts once.
        await board.page.keyboard.press("Tab");
        await board.page.keyboard.press("Enter");
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await tree.counter.textContent()).toBe("Your changes: 6");
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        // After "Answer", the Tree shows the sent value with its marks and its count.
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        expect(await tree.counter.textContent()).toBe("Your changes: 6");
        expect(await markedIds(tree)).toEqual(["u-1 added"]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in a ${scheme} system, a renamed name, a changed field, an added row's bar and a moved row's mark take DESIGN.md's ${scheme} change tokens`,
        async () => {
          const run = await host(dist, treeBoardDocument, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const change = tokenColor("change", scheme);
          const fill = tokenColor("change-subtle", scheme);
          const text = tokenColor("change-text", scheme);
          await focusPortal(run, tree);
          // A renamed name: `portal`.
          await typeIn(run, tree, "Enter", "Customer portal: accounts");
          expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal" });
          // A changed field: `portal`'s optimistic estimate; the focus ring still shows on it.
          await expectSteps(run, tree, [
            ["ArrowRight", { nodeId: "portal", cell: 0 }],
            ["ArrowRight", { nodeId: "portal", cell: 1 }],
          ]);
          await typeIn(run, tree, "F2", "4");
          expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 1 });
          expect(await focusRing(board)).toEqual(RING);
          // An added row: `u-1` after `portal`.
          expect(await shiftTabToAddNode(board)).toBe("Add node");
          await board.page.keyboard.press("Enter");
          await expectNewNode(tree, "u-1");
          await board.page.keyboard.type("Customer portal: dashboards");
          expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
          // A moved row: `billing`, indented under `u-1`.
          expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "billing", cell: 0 });
          expect(await pressIn(board, "Alt+Shift+ArrowRight")).toEqual({
            nodeId: "billing",
            cell: 0,
          });
          expect(await placeOf(tree, "billing")).toEqual(["3", "1", "1"]);
          // Each mark, and nothing else marked.
          expect(await markedIds(tree)).toEqual([
            "portal renamed",
            "portal field",
            "u-1 added",
            "billing moved",
          ]);
          expect(await tree.counter.textContent()).toBe("Your changes: 3");
          const renamed = await paintOf(tree.marks("renamed"));
          expect([renamed.background, renamed.color, renamed.border]).toEqual([fill, text, change]);
          const field = await paintOf(tree.cell("portal", 1));
          expect([field.background, field.color]).toEqual([fill, text]);
          expect(field.shadow).toContain(`${change} 0px 0px 0px 1px inset`);
          const added = await paintOf(tree.cell("u-1", 0));
          expect(added.shadow).toContain(`${change} 2px 0px 0px 0px inset`);
          expect(await tree.marks("moved").isVisible()).toBe(true);
          expect((await paintOf(tree.marks("moved"))).background).toBe(change);
          // An unchanged cell takes none of it.
          const plain = await paintOf(tree.cell("portal", 2));
          expect(plain.background).toBe("rgba(0, 0, 0, 0)");
          expect(plain.color).not.toBe(text);
          expect(plain.shadow).not.toContain(change);
          // The counter's mark is the change dot.
          const dot = tree.counter.locator("[aria-hidden]");
          expect((await paintOf(dot)).background).toBe(change);
          await Bun.sleep(QUIET_MS);
          expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
          expect(run.browser.errors).toEqual([]);
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
