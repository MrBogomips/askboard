// The Tree's toolbar and adding scenarios, in each engine, on the widget host (tree-widget design
// decision 6; proposal, open questions 10, 12 and 16; spec, "Tree adding nodes" and "Tree
// limits on the board"): the toolbar is one Tab stop, "Add node" and "Add child" open the new
// node's name, which it needs to be added, and the limits disable the adds.

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import {
  deepTreeDocument,
  emptyTreeDocument,
  fullTreeDocument,
  plan,
  wbs,
  withBuild,
} from "./fixtures/tree-documents.ts";
import { eventually, QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  enabledTools,
  focusRing,
  pressIn,
  pressTool,
  tabIntoToolbar,
  tabIntoTree,
  tabStops,
  toolStops,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  expectNewNode,
  expectSteps,
  expectToolSteps,
  expectUnchanged,
  FIXTURE_IDS,
  focusPortal,
  placeOf,
  RING,
  readyIn,
  shownIds,
  TOOL_LABELS,
  TOOLS,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's toolbar and adds`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the toolbar is one Tab stop: the arrow keys, Home and End move among its tools, skipping disabled ones",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tree.tools.allTextContents()).toEqual(TOOL_LABELS);
        expect(
          await tree.tools.evaluateAll((tools) =>
            tools.map((tool) => tool.getAttribute("aria-keyshortcuts")),
          ),
        ).toEqual(TOOLS.map(([, keys]) => keys));
        expect(
          await tree.tools.evaluateAll((tools) => tools.map((tool) => tool.getAttribute("title"))),
        ).toEqual(
          TOOLS.map(([label, keys]) =>
            keys === null ? null : `${label} (${keys.replace(" ", " or ")})`,
          ),
        );
        // On `design`, the first top-level node, "Move up", "Indent" and "Outdent" are disabled.
        expect(await enabledTools(tree.tools)).toEqual([
          "Add node",
          "Add child",
          "Move down",
          "Delete",
        ]);
        expect(await tabIntoToolbar(board, plan.props.text)).toBe("Add node");
        expect(await toolStops(tree.toolbar)).toBe(1);
        expect(await focusRing(board)).toEqual(RING);
        await expectToolSteps(run, tree, [
          ["ArrowRight", "Add child"],
          ["ArrowRight", "Move down"],
          ["ArrowRight", "Delete"],
          ["ArrowRight", "Delete"],
          ["Home", "Add node"],
          ["ArrowLeft", "Add node"],
          ["End", "Delete"],
          ["ArrowLeft", "Move down"],
        ]);
        expect(await focusRing(board)).toEqual(RING);
        // Tab goes on to the tree, and Shift+Tab back to the tool focused last.
        expect(await pressIn(board, "Tab")).toEqual({ nodeId: "design" });
        expect(await pressTool(board, "Shift+Tab")).toBe("Move down");
        // The tree's focus decides which tools are enabled: on `build`, the last top-level node,
        // "Move down" is disabled, and the toolbar's Tab stop moves on to "Indent".
        expect(await pressIn(board, "Tab")).toEqual({ nodeId: "design" });
        await expectSteps(
          run,
          tree,
          ["ux", "architecture", "prototype", "build"].map(
            (nodeId) => ["ArrowDown", { nodeId }] as const,
          ),
        );
        expect(await enabledTools(tree.tools)).toEqual([
          "Add node",
          "Add child",
          "Move up",
          "Indent",
          "Delete",
        ]);
        expect(await pressTool(board, "Shift+Tab")).toBe("Indent");
        expect(await toolStops(tree.toolbar)).toBe(1);
        // On `billing`, a middle child, every tool is enabled.
        expect(await pressIn(board, "Tab")).toEqual({ nodeId: "build" });
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "portal" }],
          ["ArrowDown", { nodeId: "billing" }],
        ]);
        expect(await enabledTools(tree.tools)).toEqual(TOOL_LABELS);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      '"Add node" on portal gives u-1 after it under build, editing its empty name; Enter adds it, with the focus on it',
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        // From the keyboard: Shift+Tab to the toolbar, whose Tab stop is "Add node", then Enter.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        expect(await shownIds(tree)).toEqual([
          ...FIXTURE_IDS.slice(0, 6),
          "u-1",
          ...FIXTURE_IDS.slice(6),
        ]);
        expect(await placeOf(tree, "u-1")).toEqual(["2", "2", "4"]);
        expect(await board.answer.isDisabled()).toBe(true);
        await board.page.keyboard.type("Customer portal: dashboards");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("u-1", 0).textContent()).toBe("Customer portal: dashboards");
        expect(await tabStops(tree.grid)).toBe(1);
        expect(await board.answer.isEnabled()).toBe(true);
        // A second add, by a click, takes the next ID, right after the node in focus.
        await tree.tool("Add node").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-2");
        await board.page.keyboard.type("Customer portal: settings");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-2", cell: 0 });
        expect(await shownIds(tree)).toEqual([
          ...FIXTURE_IDS.slice(0, 6),
          "u-1",
          "u-2",
          ...FIXTURE_IDS.slice(6),
        ]);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        // The draft holds both nodes, named and with no field; "Answer" sends them.
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        const [, answer] = run.messages;
        const values = answer?.type === "answer" ? answer.values : undefined;
        expect(values).toEqual({
          [wbs.id]: withBuild((children) =>
            children.toSpliced(
              1,
              0,
              { id: "u-1", label: "Customer portal: dashboards" },
              { id: "u-2", label: "Customer portal: settings" },
            ),
          ),
        });
        expect(validateTreeProps(values?.[wbs.id], "edited").ok).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      '"Add child" expands the current node and adds its last child; on a leaf, the leaf becomes a parent',
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        expect(await pressIn(board, "ArrowLeft")).toEqual({ nodeId: "design" });
        expect(await shownIds(tree)).toEqual(["design", "build", "portal", "billing", "reporting"]);
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        expect(await pressTool(board, "ArrowRight")).toBe("Add child");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        expect(await tree.row("design").getAttribute("aria-expanded")).toBe("true");
        expect(await shownIds(tree)).toEqual([
          ...FIXTURE_IDS.slice(0, 4),
          "u-1",
          ...FIXTURE_IDS.slice(4),
        ]);
        expect(await placeOf(tree, "u-1")).toEqual(["2", "4", "4"]);
        await board.page.keyboard.type("Research");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        expect(await tree.cell("u-1", 0).textContent()).toBe("Research");
        // On a leaf, `ux`: it takes the child and becomes an open parent.
        await tree.cell("ux", 0).click({ timeout: STEP_TIMEOUT_MS });
        expect(await treeFocus(board)).toEqual({ nodeId: "ux", cell: 0 });
        expect(await tree.row("ux").getAttribute("aria-expanded")).toBeNull();
        await tree.tool("Add child").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-2");
        expect(await tree.row("ux").getAttribute("aria-expanded")).toBe("true");
        expect(await tree.chevron("ux").count()).toBe(1);
        expect(await placeOf(tree, "u-2")).toEqual(["3", "1", "1"]);
        await board.page.keyboard.type("Interviews");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-2", cell: 0 });
        expect(await shownIds(tree)).toEqual([
          "design",
          "ux",
          "u-2",
          "architecture",
          "prototype",
          "u-1",
          ...FIXTURE_IDS.slice(4),
        ]);
        // A click on a tool while a name is edited leaves the field, which commits it first.
        await typeIn(run, tree, "F2", "Interviews and surveys");
        await tree.tool("Add child").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-3");
        expect(await tree.cell("u-2", 0).textContent()).toBe("Interviews and surveys");
        expect(await placeOf(tree, "u-3")).toEqual(["4", "1", "1"]);
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "u-2", cell: 0 });
        expect(await tree.row("u-3").count()).toBe(0);
        expect(await board.answer.isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape, an empty name or leaving the name empty takes the new node away, and nothing changes",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        // Escape, after typing: the focus goes back to the node it was on.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Draft");
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "portal" });
        expect(await tree.editor.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        // An empty name: "Add child" on `portal`, a leaf, which opens, then Enter.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        expect(await pressTool(board, "ArrowRight")).toBe("Add child");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        expect(await tree.row("portal").getAttribute("aria-expanded")).toBe("true");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal" });
        expect(await tree.editor.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await tree.row("portal").getAttribute("aria-expanded")).toBeNull();
        // Leaving the name empty, by a click on the question's text.
        await tree.tool("Add node").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-1");
        await board.view.getByRole("heading", { name: plan.props.text }).click();
        expect(await tree.editor.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        // The spec's "A node left without a name": "Add child", then Escape.
        await tree.tool("Add child").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.press("Escape");
        expect(await tree.editor.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await tabStops(tree.grid)).toBe(1);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "leaving a new node's name by Shift+Tab, or taking the node away in an empty Tree, keeps the focus in the Tree",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        // Shift+Tab from an empty name: the node goes, and the focus goes back to `portal`.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        expect(await pressIn(board, "Shift+Tab")).toEqual({ nodeId: "portal" });
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await tabStops(tree.grid)).toBe(1);
        // Shift+Tab from a name: the node is added, and the focus stays on its name.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Dashboards");
        expect(await pressIn(board, "Shift+Tab")).toEqual({ nodeId: "u-1", cell: 0 });
        expect(await tree.cell("u-1", 0).textContent()).toBe("Dashboards");
        expect(await board.answer.isEnabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);

        // In an empty Tree only "Add node" is enabled; its node taken away, the focus goes back
        // to it, and an added node takes it.
        const empty = await host(dist, emptyTreeDocument);
        await readyIn(empty);
        const emptyTree = treeGridOf(empty.board);
        expect(await emptyTree.rows.count()).toBe(0);
        expect(await enabledTools(emptyTree.tools)).toEqual(["Add node"]);
        expect(await tabIntoToolbar(empty.board, plan.props.text)).toBe("Add node");
        await empty.board.page.keyboard.press("Enter");
        await expectNewNode(emptyTree, "u-1");
        expect(await placeOf(emptyTree, "u-1")).toEqual(["1", "1", "1"]);
        expect(await pressTool(empty.board, "Escape")).toBe("Add node");
        expect(await emptyTree.rows.count()).toBe(0);
        await empty.board.page.keyboard.press("Enter");
        await expectNewNode(emptyTree, "u-1");
        expect(await pressTool(empty.board, "Enter")).toBe("Add node");
        expect(await emptyTree.rows.count()).toBe(0);
        await empty.board.page.keyboard.press("Enter");
        await expectNewNode(emptyTree, "u-1");
        await empty.board.page.keyboard.type("First");
        expect(await pressIn(empty.board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        expect(await shownIds(emptyTree)).toEqual(["u-1"]);
        expect(await empty.board.answer.isEnabled()).toBe(true);
        expect(empty.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      'at 500 nodes both adds are disabled, and "Add child" is disabled on a node at the eighth level',
      async () => {
        const full = await host(dist, fullTreeDocument);
        await readyIn(full);
        const fullTree = treeGridOf(full.board);
        expect(await fullTree.rows.count()).toBe(500);
        // On `p1`, the first top-level node: only "Move down" and "Delete" are left.
        expect(await enabledTools(fullTree.tools)).toEqual(["Move down", "Delete"]);
        expect(await tabIntoToolbar(full.board, plan.props.text)).toBe("Move down");
        expect(await toolStops(fullTree.toolbar)).toBe(1);
        // A click on a disabled add does nothing.
        await fullTree.tool("Add node").dispatchEvent("click");
        await fullTree.tool("Add child").dispatchEvent("click");
        expect(await fullTree.editor.count()).toBe(0);
        expect(await fullTree.rows.count()).toBe(500);
        await expectUnchanged(full);
        expect(full.browser.cspProblems()).toEqual([]);

        const deep = await host(dist, deepTreeDocument);
        await readyIn(deep);
        const deepTree = treeGridOf(deep.board);
        expect(await tabIntoTree(deep.board, plan.props.text)).toEqual({ nodeId: "l1" });
        expect(await pressIn(deep.board, "End")).toEqual({ nodeId: "l8" });
        expect(await placeOf(deepTree, "l8")).toEqual(["8", "1", "1"]);
        expect(await enabledTools(deepTree.tools)).toEqual(["Add node", "Outdent", "Delete"]);
        expect(await pressIn(deep.board, "ArrowUp")).toEqual({ nodeId: "l7" });
        expect(await enabledTools(deepTree.tools)).toEqual([
          "Add node",
          "Add child",
          "Outdent",
          "Delete",
        ]);
        await expectUnchanged(deep);
        expect(deep.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
