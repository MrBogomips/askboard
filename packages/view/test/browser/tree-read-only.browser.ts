// The read-only Tree, in each engine, on the widget host (tree-widget design decision 6; spec,
// "Read-only Tree"; AD-10, AD-21): once its question is answered, or while the host locks the
// view, the Tree stays readable and navigable, expanding and collapsing included, its editing keys
// do nothing and every tool is disabled. An edit under way when it turns read-only, a delete's
// question included, is dropped, the focus staying in the Tree, and does not come back when a
// lock ends.

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewUpdate } from "../../src/view-protocol.ts";
import { plan } from "./fixtures/tree-documents.ts";
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
  pressIn,
  pressTool,
  recordedKeys,
  recordKeys,
  type TreeGrid,
  tabIntoTree,
  toolStops,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  allPlaces,
  expectNewNode,
  expectSteps,
  expectUnchanged,
  FIXTURE_IDS,
  focusPortal,
  NONE_YET,
  pageOf,
  readyIn,
  shownIds,
  TOOL_LABELS,
  typeIn,
} from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** The keys that edit: none may change a read-only Tree, nor let the browser act. */
const EDIT_KEYS = [
  "Enter",
  "F2",
  "Delete",
  "Backspace",
  "Alt+Shift+ArrowUp",
  "Alt+Shift+ArrowDown",
  "Alt+Shift+ArrowRight",
  "Alt+Shift+ArrowLeft",
];

const OPEN: ViewUpdate = { type: "state", state: openStateOf(treeBoardDocument) };

/** The host locks the view, as the board page does when the board moves (AD-21). */
const lock = async (run: WidgetHostRun, tree: TreeGrid): Promise<void> => {
  await run.update({ ...OPEN, lock: "moved" });
  await eventually(
    async () => (await enabledTools(tree.tools)).length === 0,
    "the locked Tree's tools to turn disabled",
  );
};

/** The lock ends, as when the user takes the board back. */
const unlock = async (run: WidgetHostRun, tree: TreeGrid): Promise<void> => {
  await run.update(OPEN);
  await eventually(
    async () => (await enabledTools(tree.tools)).length > 0,
    "the Tree to turn editable again",
  );
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the read-only Tree`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "after Answer, the Tree shows the sent value and stays navigable and collapsible; its editing keys do nothing and every tool is disabled",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const page = await pageOf(run);
        await focusPortal(run, tree);
        await typeIn(run, tree, "Enter", "Customer portal: accounts");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal" });
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        // The spec's "After Answer": the sent value, with its mark and its count.
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal: accounts");
        expect(await tree.counter.textContent()).toBe("Your changes: 1");
        expect(await enabledTools(tree.tools)).toEqual([]);
        expect(await toolStops(tree.toolbar)).toBe(0);
        // The editing keys change nothing, and the browser does not act on them.
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "portal" });
        await recordKeys(board);
        const places = await allPlaces(tree);
        for (const key of EDIT_KEYS) {
          expect({ key, at: await pressIn(board, key) }).toEqual({ key, at: { nodeId: "portal" } });
          expect({
            key,
            editors: await tree.editor.count(),
            questions: await deleteQuestion(board).count(),
            places: await allPlaces(tree),
          }).toEqual({ key, editors: 0, questions: 0, places });
        }
        // The modifiers' own presses are recorded too; the browser acts on none of the keys.
        expect(
          (await recordedKeys(board)).filter((key) => !/^(Alt\+)?(Shift\+)?(Alt|Shift)$/.test(key)),
        ).toEqual(EDIT_KEYS.map((key) => `${key} prevented`));
        // A disabled tool's click changes nothing either.
        for (const label of TOOL_LABELS) await tree.tool(label).dispatchEvent("click");
        expect(await tree.editor.count()).toBe(0);
        expect(await allPlaces(tree)).toEqual(places);
        // Navigable and collapsible, by the keys and by a chevron.
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "billing" }],
          ["ArrowUp", { nodeId: "portal" }],
          ["ArrowUp", { nodeId: "build" }],
          ["ArrowLeft", { nodeId: "build" }],
        ]);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS.slice(0, 5));
        expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "build" });
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        await tree.chevron("design").click({ timeout: STEP_TIMEOUT_MS });
        expect(await shownIds(tree)).toEqual(["design", ...FIXTURE_IDS.slice(4)]);
        expect(await pageOf(run)).toEqual(page);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toHaveLength(2);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a lock drops a field being edited and a node being added, the focus staying in the Tree, and neither comes back when the lock ends",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        // A name half typed: the lock drops it, and the focus goes back to its row.
        await typeIn(run, tree, "Enter", "Customer portal: half");
        await lock(run, tree);
        expect(await tree.editor.count()).toBe(0);
        expect(await treeFocus(board)).toEqual({ nodeId: "portal" });
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal");
        expect(await board.answer.isDisabled()).toBe(true);
        // The locked Tree is navigable, and its editing keys do nothing.
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "billing" });
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "billing" });
        expect(await pressIn(board, "Delete")).toEqual({ nodeId: "billing" });
        expect(await tree.editor.count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await pressIn(board, "ArrowUp")).toEqual({ nodeId: "portal" });
        await unlock(run, tree);
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal");
        expect(await treeFocus(board)).toEqual({ nodeId: "portal" });
        // A new node being named: the lock takes it away, the focus back where the add started.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Draft");
        await lock(run, tree);
        expect(await tree.row("u-1").count()).toBe(0);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await treeFocus(board)).toEqual({ nodeId: "portal" });
        await unlock(run, tree);
        expect(await tree.row("u-1").count()).toBe(0);
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.counter.textContent()).toBe(NONE_YET);
        await expectUnchanged(run);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a lock while a delete asks drops the question, the focus on Cancel going to the tree, and the question does not come back",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        await board.page.keyboard.press("Delete");
        const question = deleteQuestion(
          board,
          "“Design” and the 3 nodes under it will be deleted.",
        );
        await question.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(question.getByRole("button", { name: "Cancel" }))).toBe(true);
        expect(await tree.counter.textContent()).toBe(NONE_YET);
        await lock(run, tree);
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await treeFocus(board)).toEqual({ nodeId: "design" });
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await tree.counter.textContent()).toBe(NONE_YET);
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "ux" });
        expect(await pressIn(board, "Delete")).toEqual({ nodeId: "ux" });
        expect(await deleteQuestion(board).count()).toBe(0);
        await unlock(run, tree);
        expect(await deleteQuestion(board).count()).toBe(0);
        expect(await tree.tools.allTextContents()).toEqual(TOOL_LABELS);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        await expectUnchanged(run);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
