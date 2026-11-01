// The Tree's navigation scenarios, in each engine, on the widget host (tree-widget design
// decision 6; spec, "Tree keyboard" and "Tree expand and collapse"): the tree is one Tab stop,
// the arrow keys, Home and End move the focus with the focus ring, Right and Left expand,
// collapse and move between a row and its cells, and a chevron's click toggles its node; none of
// it changes the draft.

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { plan } from "./fixtures/tree-documents.ts";
import { TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  chevronAngle,
  focusRing,
  pressIn,
  tabIntoTree,
  tabStops,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  expectSteps,
  expectUnchanged,
  FIXTURE_IDS,
  RING,
  readyIn,
  shownIds,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's keys`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the tree is one Tab stop, and the arrow keys, Home and End move the focus with the focus ring",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const url = board.page.url();
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        expect(await tabStops(tree.grid)).toBe(1);
        expect(await focusRing(board)).toEqual(RING);
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "ux" }],
          ["ArrowDown", { nodeId: "architecture" }],
          ["End", { nodeId: "reporting" }],
          ["ArrowDown", { nodeId: "reporting" }],
          ["ArrowUp", { nodeId: "billing" }],
          ["Home", { nodeId: "design" }],
          ["ArrowUp", { nodeId: "design" }],
          ["End", { nodeId: "reporting" }],
        ]);
        expect(await focusRing(board)).toEqual(RING);
        // Tab never lands on another row or cell: it leaves the tree in every engine, since the
        // question card holds the open prompt and the question's actions after its widget since
        // the ask lifecycle (ask-lifecycle, task 6.4), so Firefox's frame no longer wraps back to
        // the tree's one Tab stop.
        const afterTab = await pressIn(board, "Tab");
        expect(afterTab === undefined ? "left the tree" : afterTab).toEqual("left the tree");
        expect(await tabStops(tree.grid)).toBe(1);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(board.page.url()).toBe(url);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Right and Left expand and collapse a row, go to its parent, and move between the row and its cells",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const url = board.page.url();
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        // Left collapses an open row, Right expands it again; the focus stays on the row.
        expect(await pressIn(board, "ArrowLeft")).toEqual({ nodeId: "design" });
        expect(await tree.row("design").getAttribute("aria-expanded")).toBe("false");
        expect(await chevronAngle(tree.chevron("design"))).toBe(0);
        expect(await shownIds(tree)).toEqual(["design", "build", "portal", "billing", "reporting"]);
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "build" });
        expect(await pressIn(board, "ArrowUp")).toEqual({ nodeId: "design" });
        expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "design" });
        expect(await tree.row("design").getAttribute("aria-expanded")).toBe("true");
        expect(await chevronAngle(tree.chevron("design"))).toBe(90);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        // Right on an open row enters its cells; Left on the name goes back to the row.
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "design", cell: 0 }],
          ["ArrowRight", { nodeId: "design", cell: 1 }],
          ["End", { nodeId: "design", cell: 3 }],
          ["ArrowRight", { nodeId: "design", cell: 3 }],
          ["Home", { nodeId: "design", cell: 0 }],
          ["ArrowLeft", { nodeId: "design" }],
          // On a leaf, Right enters the cells, Up and Down keep the column, Left goes to the parent.
          ["ArrowDown", { nodeId: "ux" }],
          ["ArrowRight", { nodeId: "ux", cell: 0 }],
          ["ArrowRight", { nodeId: "ux", cell: 1 }],
          ["ArrowDown", { nodeId: "architecture", cell: 1 }],
        ]);
        expect(await focusRing(board)).toEqual(RING);
        await expectSteps(run, tree, [
          ["ArrowLeft", { nodeId: "architecture", cell: 0 }],
          ["ArrowLeft", { nodeId: "architecture" }],
          ["ArrowLeft", { nodeId: "design" }],
        ]);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(board.page.url()).toBe(url);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click on a chevron collapses and expands its node, and a focus it hides moves to the node",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        expect(await pressIn(board, "End")).toEqual({ nodeId: "reporting" });
        await tree.chevron("build").click();
        expect(await tree.row("build").getAttribute("aria-expanded")).toBe("false");
        expect(await chevronAngle(tree.chevron("build"))).toBe(0);
        expect(await shownIds(tree)).toEqual([
          "design",
          "ux",
          "architecture",
          "prototype",
          "build",
        ]);
        expect(await treeFocus(board)).toEqual({ nodeId: "build" });
        expect(await tabStops(tree.grid)).toBe(1);
        await tree.chevron("build").click();
        expect(await tree.row("build").getAttribute("aria-expanded")).toBe("true");
        expect(await chevronAngle(tree.chevron("build"))).toBe(90);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await treeFocus(board)).toEqual({ nodeId: "build" });
        // A chevron collapsing a branch that does not hold the focus leaves the focus alone.
        await tree.chevron("design").click();
        expect(await shownIds(tree)).toEqual(["design", "build", "portal", "billing", "reporting"]);
        expect(await treeFocus(board)).toEqual({ nodeId: "build" });
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
