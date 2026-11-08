// The Tree's drag and drop, in each engine, on the widget host and on the real board page
// (widget-editing-plus, spec "Tree drag and drop", "Tree drag handle", "Tree drops that are
// refused", "Tree drag has a keyboard path and is a change"): a row drags by its handle and drops
// before, after or into another, the indicator showing which or that the drop is not allowed, and
// Escape cancels. The library's native drag is the one the sandboxed frame takes (task 5.1).

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { tallBranchTreeDocument } from "./fixtures/tree-documents.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  beginDrag,
  dragDrop,
  dragOver,
  dragTip,
  expectDrop,
  handleOf,
  release,
  ZONE,
} from "./harness/tree-drag.ts";
import { enabledTools, groupQuestion, treeFocus, treeGridOf } from "./harness/tree-grid.ts";
import {
  allPlaces,
  expectUnchanged,
  FIXTURE_IDS,
  NONE_YET,
  placeOf,
  readyIn,
  shownIds,
} from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { placeSuffix, placesOf, widgetBoardFor } from "./harness/widget-board.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const place of placesOf())
    describe(`${engine}: the Tree's drag and drop${placeSuffix(place)}`, () => {
      const { host } = widgetBoardFor(engine, place);

      test(
        "the handle is named for its node, shows its grab cursor, and is no tab stop",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const tree = treeGridOf(run.board);
          const handle = handleOf(tree, "portal");
          expect(await handle.getAttribute("aria-label")).toBe("Drag Customer portal");
          await tree.row("portal").hover();
          expect(await handle.evaluate((grip) => getComputedStyle(grip).opacity)).toBe("1");
          expect(await handle.evaluate((grip) => getComputedStyle(grip).cursor)).toBe("grab");
          expect(await handle.evaluate((grip) => grip.tabIndex)).toBe(-1);
          expect(await tree.grid.locator('[tabindex="0"]').count()).toBe(1);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "billing dropped on the top quarter of portal precedes it: one change, the move mark, focus on billing",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await beginDrag(board, tree, "billing");
          await dragOver(board, tree, "portal", ZONE.before);
          await expectDrop(tree, "portal", "before");
          expect(await tree.row("billing").getAttribute("data-dragging")).toBe("");
          await release(board);
          await eventually(
            async () =>
              (await shownIds(tree)).indexOf("billing") < (await shownIds(tree)).indexOf("portal"),
            "billing to precede portal",
          );
          expect(await shownIds(tree)).toEqual([
            ...FIXTURE_IDS.slice(0, 5),
            "billing",
            "portal",
            "reporting",
          ]);
          expect(await tree.counter.textContent()).toBe("Your changes: 1");
          expect(await tree.marks("moved").count()).toBe(1);
          expect(await tree.row("billing").getAttribute("data-dragging")).toBeNull();
          await expectDrop(tree, "portal", null);
          expect(await treeFocus(board)).toEqual({ nodeId: "billing" });
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "billing dropped on the middle of portal is its last child, and portal is expanded",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await beginDrag(board, tree, "billing");
          await dragOver(board, tree, "portal", ZONE.into);
          await expectDrop(tree, "portal", "into");
          await release(board);
          await eventually(
            async () => (await placeOf(tree, "billing"))[0] === "3",
            "billing to move into portal",
          );
          // The plain Tree has no estimates that count and no plan: the drop acts at once, asking
          // nothing (wbs-gantt-consistency, "Nothing to lose").
          expect(await groupQuestion(board).count()).toBe(0);
          expect(await tree.toolbar.count()).toBe(1);
          expect(await placeOf(tree, "billing")).toEqual(["3", "1", "1"]);
          expect(await tree.row("portal").getAttribute("aria-expanded")).toBe("true");
          expect(await tree.counter.textContent()).toBe("Your changes: 1");
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "reporting dropped on the bottom quarter of build follows it at the top level, and billing stays",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await beginDrag(board, tree, "reporting");
          await dragOver(board, tree, "build", ZONE.after);
          await expectDrop(tree, "build", "after");
          await release(board);
          await eventually(
            async () => (await placeOf(tree, "reporting"))[0] === "1",
            "reporting to leave build",
          );
          expect(await placeOf(tree, "reporting")).toEqual(["1", "3", "3"]);
          expect(await placeOf(tree, "billing")).toEqual(["2", "2", "2"]);
          expect(await tree.counter.textContent()).toBe("Your changes: 1");
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "dragging build over portal reads not allowed with its tip, and dropping changes nothing",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const places = await allPlaces(tree);
          await beginDrag(board, tree, "build");
          await dragOver(board, tree, "portal", ZONE.into);
          await expectDrop(tree, "portal", "refused");
          await dragTip(board).getByText("Cannot drop inside its own branch").waitFor({
            timeout: STEP_TIMEOUT_MS,
          });
          await release(board);
          await eventually(
            async () => (await tree.row("build").getAttribute("data-dragging")) === null,
            "the drag to end",
          );
          expect(await allPlaces(tree)).toEqual(places);
          expect(await tree.counter.textContent()).toBe(NONE_YET);
          expect(await dragTip(board).textContent()).toBe("");
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "a drop that would put a node at level 9 reads not allowed with the limit, and the draft is unchanged",
        async () => {
          const run = await host(dist, tallBranchTreeDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const places = await allPlaces(tree);
          await beginDrag(board, tree, "leaf");
          await dragOver(board, tree, "b8", ZONE.into);
          await expectDrop(tree, "b8", "refused");
          await dragTip(board).getByText("At most 8 levels").waitFor({ timeout: STEP_TIMEOUT_MS });
          await release(board);
          await eventually(
            async () => (await tree.row("leaf").getAttribute("data-dragging")) === null,
            "the drag to end",
          );
          expect(await allPlaces(tree)).toEqual(places);
          expect(await tree.counter.textContent()).toBe(NONE_YET);
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "Escape during a drag moves nothing and leaves the focus on the dragged row",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const places = await allPlaces(tree);
          await beginDrag(board, tree, "billing");
          await dragOver(board, tree, "portal", ZONE.before);
          await expectDrop(tree, "portal", "before");
          await board.page.keyboard.press("Escape");
          await release(board);
          await eventually(
            async () => (await tree.row("billing").getAttribute("data-dragging")) === null,
            "the drag to end",
          );
          expect(await allPlaces(tree)).toEqual(places);
          expect(await tree.counter.textContent()).toBe(NONE_YET);
          expect(await treeFocus(board)).toEqual({ nodeId: "billing" });
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "a node dragged away and back to its place leaves no change",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await dragDrop(board, tree, "billing", "portal", ZONE.into);
          await eventually(
            async () => (await tree.counter.textContent()) === "Your changes: 1",
            "the counter to read one change",
          );
          await dragDrop(board, tree, "billing", "portal", ZONE.after);
          await eventually(
            async () => (await tree.counter.textContent()) === NONE_YET,
            "the counter to read no change",
          );
          expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
          expect(await tree.marks().count()).toBe(0);
        },
        TEST_TIMEOUT_MS,
      );
    });

  describe(`${engine}: the Tree's drag when read-only`, () => {
    const { host } = widgetBoardFor(engine, "widget host");

    test(
      "a locked Tree shows no handle and a drag attempt changes nothing",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await handleOf(tree, "billing").count()).toBe(1);
        await run.update({ type: "state", state: openStateOf(treeBoardDocument), lock: "moved" });
        await eventually(
          async () => (await enabledTools(tree.tools)).length === 0,
          "the locked Tree's tools to turn disabled",
        );
        expect(await tree.grid.locator("[data-drag-handle]").count()).toBe(0);
        const places = await allPlaces(tree);
        const row = await tree.row("billing").boundingBox();
        const target = await tree.row("portal").boundingBox();
        if (row === null || target === null) throw new Error("no box");
        const { mouse } = board.page;
        await mouse.move(row.x + 20, row.y + row.height / 2);
        await mouse.down();
        await mouse.move(target.x + 60, target.y + target.height * 0.1, { steps: 10 });
        await mouse.up();
        expect(await allPlaces(tree)).toEqual(places);
        expect(await tree.counter.textContent()).toBe(NONE_YET);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
