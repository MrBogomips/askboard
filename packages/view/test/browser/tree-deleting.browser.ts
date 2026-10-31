// The Tree's deleting scenarios, in each engine, on the widget host (tree-widget design decision
// 6; proposal, open question 11; spec, "Tree deleting nodes"): a leaf goes at once, a node with
// children asks first, inline in the toolbar row, and the focus moves as the spec says.

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import type { Locator } from "playwright";
import { plan, wbs } from "./fixtures/tree-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  deleteQuestion,
  enabledTools,
  focusRing,
  pressIn,
  pressTool,
  tabIntoTree,
  tabStops,
  toolFocus,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  expectNewNode,
  expectSteps,
  expectUnchanged,
  FIXTURE_IDS,
  RING,
  readyIn,
  shownIds,
  TOOL_LABELS,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's deletes`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "Delete on reporting removes it and focuses billing; Backspace acts as Delete; Delete from the toolbar keeps the focus there",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const url = board.page.url();
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        // A leaf goes at once, with no question; the focus goes to its previous sibling.
        expect(await pressIn(board, "End")).toEqual({ nodeId: "reporting" });
        expect(await pressIn(board, "Delete")).toEqual({ nodeId: "billing" });
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS.filter((id) => id !== "reporting"));
        expect(await deleteQuestion(board).count()).toBe(0);
        expect(await tabStops(tree.grid)).toBe(1);
        // Backspace on a cell: the focus keeps the column.
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "billing", cell: 0 }],
          ["ArrowRight", { nodeId: "billing", cell: 1 }],
        ]);
        expect(await pressIn(board, "Backspace")).toEqual({ nodeId: "portal", cell: 1 });
        expect(await shownIds(tree)).toEqual([...FIXTURE_IDS.slice(0, 6)]);
        // From the toolbar: `portal`, now `build`'s only child, goes; the focus stays on the tool
        // and the tree's focus goes to the parent.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        expect(await pressTool(board, "End")).toBe("Delete");
        expect(await pressTool(board, "Enter")).toBe("Delete");
        expect(await shownIds(tree)).toEqual([...FIXTURE_IDS.slice(0, 5)]);
        expect(await tree.row("build").getAttribute("aria-expanded")).toBeNull();
        expect(await pressIn(board, "Tab")).toEqual({ nodeId: "build", cell: 1 });
        expect(board.page.url()).toBe(url);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        // The draft holds `build` with no child left: "Answer" sends it.
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        const [, answer] = run.messages;
        const values = answer?.type === "answer" ? answer.values : undefined;
        const [design] = wbs.props.nodes;
        expect(values).toEqual({
          [wbs.id]: { ...wbs.props, nodes: [design, { id: "build", label: "Build" }] },
        });
        expect(validateTreeProps(values?.[wbs.id], "edited").ok).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Delete on design asks, inline, about Design and the 3 nodes under it, with the focus on Cancel; Escape and Cancel keep the nodes",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const url = board.page.url();
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        // The question replaces the tools in the toolbar row, the focus on "Cancel".
        await board.page.keyboard.press("Delete");
        const question = deleteQuestion(
          board,
          "“Design” and the 3 nodes under it will be deleted.",
        );
        await question.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await question.getByRole("button").allTextContents()).toEqual(["Cancel", "Delete"]);
        expect(await isFocused(question.getByRole("button", { name: "Cancel" }))).toBe(true);
        expect(await focusRing(board)).toEqual(RING);
        expect(await tree.tools.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        // Escape keeps the nodes and gives the focus back to `design`.
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "design" });
        expect(await question.count()).toBe(0);
        expect(await tree.tools.allTextContents()).toEqual(TOOL_LABELS);
        // Backspace asks too; "Cancel" by a click keeps the nodes.
        await board.page.keyboard.press("Backspace");
        await question.waitFor({ timeout: STEP_TIMEOUT_MS });
        await question.getByRole("button", { name: "Cancel" }).click({ timeout: STEP_TIMEOUT_MS });
        expect(await question.count()).toBe(0);
        expect(await treeFocus(board)).toEqual({ nodeId: "design" });
        // From the toolbar's "Delete": Enter on "Cancel" gives the focus back to the tool.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        expect(await pressTool(board, "End")).toBe("Delete");
        await board.page.keyboard.press("Enter");
        await question.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(question.getByRole("button", { name: "Cancel" }))).toBe(true);
        expect(await pressTool(board, "Enter")).toBe("Delete");
        expect(await question.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(board.page.url()).toBe(url);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "confirming removes the branch and moves the focus to the next sibling, else the previous one, else the parent",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        // From the tree, by the keyboard: `design` goes with its 3 nodes, the focus to `build`.
        await board.page.keyboard.press("Delete");
        const design = deleteQuestion(board, "“Design” and the 3 nodes under it will be deleted.");
        await design.waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Tab");
        expect(await isFocused(design.getByRole("button", { name: "Delete" }))).toBe(true);
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "build" });
        expect(await design.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS.slice(4));
        expect(await tabStops(tree.grid)).toBe(1);
        // A parent of one child asks too, in the singular: `u-1` under `portal`.
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "portal" });
        await tree.tool("Add child").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Accounts");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        expect(await pressIn(board, "ArrowUp")).toEqual({ nodeId: "portal", cell: 0 });
        await board.page.keyboard.press("Delete");
        const portal = deleteQuestion(
          board,
          "“Customer portal” and the node under it will be deleted.",
        );
        await portal.waitFor({ timeout: STEP_TIMEOUT_MS });
        await portal.getByRole("button", { name: "Delete" }).click({ timeout: STEP_TIMEOUT_MS });
        expect(await treeFocus(board)).toEqual({ nodeId: "billing", cell: 0 });
        expect(await shownIds(tree)).toEqual(["build", "billing", "reporting"]);
        // From the toolbar, by clicks: `build`, the last node, goes; the empty Tree's focus is
        // on "Add node".
        await tree.cell("build", 0).click({ timeout: STEP_TIMEOUT_MS });
        await tree.tool("Delete").click({ timeout: STEP_TIMEOUT_MS });
        const build = deleteQuestion(board, "“Build” and the 2 nodes under it will be deleted.");
        await build.getByRole("button", { name: "Delete" }).click({ timeout: STEP_TIMEOUT_MS });
        expect(await tree.rows.count()).toBe(0);
        expect(await enabledTools(tree.tools)).toEqual(["Add node"]);
        expect(await toolFocus(board)).toBe("Add node");
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        // "Answer" sends the empty Tree, which the contract allows.
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        const [, answer] = run.messages;
        const values = answer?.type === "answer" ? answer.values : undefined;
        expect(values).toEqual({ [wbs.id]: { ...wbs.props, nodes: [] } });
        expect(validateTreeProps(values?.[wbs.id], "edited").ok).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the question follows the Tree: another branch asks anew, a focus moved elsewhere stays, and a question that no longer applies goes",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const cancelOf = (question: Locator) => question.getByRole("button", { name: "Cancel" });
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        await board.page.keyboard.press("Delete");
        const design = deleteQuestion(board, "“Design” and the 3 nodes under it will be deleted.");
        await design.waitFor({ timeout: STEP_TIMEOUT_MS });
        // Delete on another branch while the question shows asks about it, on "Cancel".
        await tree.cell("build", 0).click({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Delete");
        const build = (under: string) =>
          deleteQuestion(board, `“Build” and ${under} under it will be deleted.`);
        await build("the 3 nodes").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(cancelOf(build("the 3 nodes")))).toBe(true);
        expect(await design.count()).toBe(0);
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "build", cell: 0 });
        // Confirming after the focus moved outside the branch leaves the focus where it is.
        await tree.cell("design", 0).click({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Delete");
        await design.waitFor({ timeout: STEP_TIMEOUT_MS });
        await tree.cell("reporting", 0).click({ timeout: STEP_TIMEOUT_MS });
        await design.getByRole("button", { name: "Delete" }).click({ timeout: STEP_TIMEOUT_MS });
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS.slice(4));
        expect(await treeFocus(board)).toEqual({ nodeId: "reporting", cell: 0 });
        // The question counts the nodes as they are, and goes once its node has none left.
        await tree.cell("build", 0).click({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Delete");
        await build("the 3 nodes").waitFor({ timeout: STEP_TIMEOUT_MS });
        await tree.cell("portal", 0).click({ timeout: STEP_TIMEOUT_MS });
        expect(await pressIn(board, "Delete")).toEqual({ nodeId: "billing", cell: 0 });
        await build("the 2 nodes").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await pressIn(board, "Delete")).toEqual({ nodeId: "reporting", cell: 0 });
        await build("the node").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await pressIn(board, "Delete")).toEqual({ nodeId: "build", cell: 0 });
        expect(await deleteQuestion(board).count()).toBe(0);
        expect(await tree.tools.allTextContents()).toEqual(TOOL_LABELS);
        // A question that shows when "Answer" is pressed goes, and stays gone.
        await tree.tool("Add child").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Docs");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        // `build` has a child again, and its old question does not come back.
        expect(await deleteQuestion(board).count()).toBe(0);
        await tree.cell("build", 0).click({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Delete");
        await build("the node").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        await Bun.sleep(QUIET_MS);
        expect(await deleteQuestion(board).count()).toBe(0);
        expect(await shownIds(tree)).toEqual(["build", "u-1"]);
        const [, answer] = run.messages;
        const values = answer?.type === "answer" ? answer.values : undefined;
        expect(values).toEqual({
          [wbs.id]: {
            ...wbs.props,
            nodes: [{ id: "build", label: "Build", children: [{ id: "u-1", label: "Docs" }] }],
          },
        });
        expect(run.messages).toHaveLength(2);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
