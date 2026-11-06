// The WBS's edits carried into its plan, in each engine, on the widget host (molecules design
// decisions 11 and 12; F20; view spec, "An added package's predecessors", "Linked edits within a
// plan's limits", "A linked edit on an answered question", "Deleting a package with dependents"): a
// package named after, or under, another gets that package's predecessors in the plan in the same
// draft update, nothing leaving the view; an addition taken back writes nothing; a linked edit past
// a plan's limit is refused at the name, writing nothing; on an answered question the plan's draft
// value starts from its answer; and a package other tasks depend on is deleted only once the user
// confirms, its dependents then depending on its predecessors.

import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_PLAN_SHAPE } from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { ganttOf, rowTexts } from "./fixtures/gantt-view.ts";
import {
  answeredStateOf,
  crowdedDocument,
  draftValues,
  planWith,
  wbsPlan,
  wbsTree,
} from "./fixtures/wbs-documents.ts";
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
  pressIn,
  pressTool,
  type TreeGrid,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  expectNewNode,
  expectSteps,
  expectUnchanged,
  focusPortal,
  readyIn,
  shownIds,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const DASHBOARDS = "Customer portal: dashboards";

/** The refusal of a package named after the portal on the crowded plan. */
const PAST_DEPENDENTS =
  "Clickable prototype would have more than 50 dependent tasks, the most a task can have.";

/** The predecessors the portal has, which a package named after it gets. */
const PORTAL_PREDECESSORS = ["architecture", "prototype"];

/** The question before deleting the portal, on which reporting depends. */
const PORTAL_QUESTION = "“Customer portal” will be deleted. 1 task in the plan depends on it.";

/** The plan's row of `task`: its ID, name, start, duration and predecessors. */
const rowOf = async (run: WidgetHostRun, task: string) =>
  (await rowTexts(ganttOf(run.board, wbsPlan.id))).find(([id]) => id === task);

/** Opens "Add node" on the focused node from the toolbar and names the new package `label`. */
const addAndName = async (run: WidgetHostRun, tree: TreeGrid, tool: "Add node" | "Add child") => {
  expect(await pressTool(run.board, "Shift+Tab")).toBe("Add node");
  if (tool === "Add child") expect(await pressTool(run.board, "ArrowRight")).toBe("Add child");
  await run.board.page.keyboard.press("Enter");
  await expectNewNode(tree, "u-1");
};

/** Delete on the focused portal: the question, once it shows, with the focus on "Cancel". */
const askToDeletePortal = async (run: WidgetHostRun) => {
  await run.board.page.keyboard.press("Delete");
  const question = deleteQuestion(run.board, PORTAL_QUESTION);
  await question.waitFor({ timeout: STEP_TIMEOUT_MS });
  expect(await question.getByRole("button").allTextContents()).toEqual(["Cancel", "Delete"]);
  expect(await isFocused(question.getByRole("button", { name: "Cancel" }))).toBe(true);
  return question;
};

/** The draft holds a value for exactly these items, once the view has mirrored it. */
const expectDraftOf = async (run: WidgetHostRun, itemIds: readonly string[]) => {
  await eventually(
    () => Object.keys(draftValues(run)).length === itemIds.length,
    `draft values for ${itemIds.join(", ")}`,
  );
  expect(Object.keys(draftValues(run)).sort()).toEqual([...itemIds].sort());
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the WBS's linked edits`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a package named after the portal depends on Architecture and Clickable prototype in the plan and starts after the prototype, both items in the draft and nothing sent",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await addAndName(run, tree, "Add node");
        await run.board.page.keyboard.type(DASHBOARDS);
        expect(await pressIn(run.board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        await expectDraftOf(run, [wbsTree.id, wbsPlan.id]);
        expect(draftValues(run)[wbsPlan.id]).toEqual(
          planWith({ "u-1": { dependencies: PORTAL_PREDECESSORS } }),
        );
        expect((await rowOf(run, "u-1"))?.[4]).toBe("Architecture, Clickable prototype");
        // Estimated at 4, 7 and 12, it lasts 8 working days, from the day after the prototype ends.
        for (const [at, estimate] of ["4", "7", "12"].entries()) {
          expect(await pressIn(run.board, "ArrowRight")).toEqual({ nodeId: "u-1", cell: at + 1 });
          await typeIn(run, tree, "F2", estimate);
          expect(await pressIn(run.board, "Enter")).toEqual({ nodeId: "u-1", cell: at + 1 });
        }
        await eventually(
          async () => (await rowOf(run, "u-1"))?.[2] === "Tue 11/17",
          "u-1 to start on 11/17/2026",
        );
        expect(await rowOf(run, "u-1")).toEqual([
          "u-1",
          DASHBOARDS,
          "Tue 11/17",
          "8 d",
          "Architecture, Clickable prototype",
        ]);
        expect(await run.board.answer.isDisabled()).toBe(false);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: "plan" }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a child named under reporting depends on the portal, as reporting does",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "billing" }],
          ["ArrowDown", { nodeId: "reporting" }],
        ]);
        await addAndName(run, tree, "Add child");
        await run.board.page.keyboard.type("Reporting: exports");
        expect(await pressIn(run.board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        await expectDraftOf(run, [wbsTree.id, wbsPlan.id]);
        expect(draftValues(run)[wbsPlan.id]).toEqual(
          planWith({ "u-1": { dependencies: ["portal"] } }),
        );
        expect((await rowOf(run, "u-1"))?.[4]).toBe("Customer portal");
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: "plan" }]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      '"Add node" then Escape leaves neither the Tree nor the plan a draft value',
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await addAndName(run, tree, "Add node");
        expect(await pressIn(run.board, "Escape")).toEqual({ nodeId: "portal" });
        expect(await rowOf(run, "u-1")).toBeUndefined();
        await expectUnchanged(run);
        expect(draftValues(run)).toEqual({});
      },
      TEST_TIMEOUT_MS,
    );

    test(
      '"Add node" shows the new row at once with the added mark, "—" for its roll-ups and no error',
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await addAndName(run, tree, "Add node");
        const cells = tree.row("u-1").locator("td");
        expect(await tree.row("u-1").getAttribute("data-change")).toBe("added");
        const texts = await cells.allTextContents();
        expect(texts.slice(-2)).toEqual(["\u2014", "\u2014"]);
        expect(await run.board.view.getByText("could not be computed").count()).toBe(0);
        expect(await pressIn(run.board, "Escape")).toEqual({ nodeId: "portal" });
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a package whose linked edit would give Clickable prototype more than 50 dependents is refused at its name, which keeps the focus, and nothing is written",
      async () => {
        const run = await host(dist, crowdedDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await addAndName(run, tree, "Add node");
        await run.board.page.keyboard.type(DASHBOARDS);
        await run.board.page.keyboard.press("Enter");
        await run.board.view
          .getByText(PAST_DEPENDENTS, { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(tree.editor)).toBe(true);
        expect(await tree.editor.getAttribute("aria-invalid")).toBe("true");
        expect(draftValues(run)).toEqual({});
        // Taken back with Escape, the addition leaves nothing either.
        expect(await pressIn(run.board, "Escape")).toEqual({ nodeId: "portal" });
        await expectUnchanged(run);
        expect(draftValues(run)).toEqual({});
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "on an answered question whose answer edits the plan, a package named after the portal makes the plan's draft value the answered plan with its predecessors",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const answered = planWith({ billing: { dependencies: ["architecture", "prototype"] } });
        await run.update({
          type: "state",
          state: answeredStateOf({ [wbsPlan.id]: answered }),
        });
        await eventually(
          async () => (await rowOf(run, "billing"))?.[4] === "Architecture, Clickable prototype",
          "the plan to show its answer",
        );
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await addAndName(run, tree, "Add node");
        await run.board.page.keyboard.type(DASHBOARDS);
        expect(await pressIn(run.board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        await expectDraftOf(run, [wbsTree.id, wbsPlan.id]);
        expect(draftValues(run)[wbsPlan.id]).toEqual({
          ...answered,
          tasks: { ...answered.tasks, "u-1": { dependencies: PORTAL_PREDECESSORS } },
        });
        expect((await rowOf(run, "u-1"))?.[4]).toBe("Architecture, Clickable prototype");
        expect((await rowOf(run, "billing"))?.[4]).toBe("Architecture, Clickable prototype");
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: "plan" }]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Delete on the portal asks first, inline, saying one task depends on it, with the focus on Cancel; Cancel leaves the Tree and the plan unchanged",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        const ids = await shownIds(tree);
        const question = await askToDeletePortal(run);
        await run.board.page.keyboard.press("Enter");
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await shownIds(tree)).toEqual(ids);
        expect((await rowOf(run, "reporting"))?.[4]).toBe("Customer portal");
        await expectUnchanged(run);
        expect(draftValues(run)).toEqual({});
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: "plan" }]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the portal's delete confirmed connects reporting to Architecture and Clickable prototype, the plan's diff one set of reporting's predecessors",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        const question = await askToDeletePortal(run);
        await question.getByRole("button", { name: "Delete" }).click({ timeout: STEP_TIMEOUT_MS });
        await expectDraftOf(run, [wbsTree.id, wbsPlan.id]);
        expect(await shownIds(tree)).not.toContain("portal");
        expect(
          elementChanges(
            wbsPlan.id,
            wbsPlan.props,
            draftValues(run)[wbsPlan.id] as object,
            GANTT_PLAN_SHAPE,
          ),
        ).toEqual([
          {
            op: "set",
            target: `${wbsPlan.id}.reporting.dependencies`,
            value: PORTAL_PREDECESSORS,
          },
        ]);
        await eventually(
          async () => (await rowOf(run, "reporting"))?.[4] === "Architecture, Clickable prototype",
          "reporting to depend on Architecture and Clickable prototype",
        );
        expect(await run.board.answer.isDisabled()).toBe(false);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: "plan" }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the portal split into u-1, then u-1 deleted, leaves neither the Tree nor the plan a draft value and Answer disabled",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        await focusPortal(run, tree);
        await addAndName(run, tree, "Add node");
        await run.board.page.keyboard.type(DASHBOARDS);
        expect(await pressIn(run.board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        await expectDraftOf(run, [wbsTree.id, wbsPlan.id]);
        // No task depends on u-1: it goes at once, with no question, the focus on its next sibling.
        expect(await pressIn(run.board, "Delete")).toEqual({ nodeId: "billing", cell: 0 });
        expect(await deleteQuestion(run.board, /will be deleted\./).count()).toBe(0);
        await expectDraftOf(run, []);
        expect(await rowOf(run, "u-1")).toBeUndefined();
        await expectUnchanged(run);
        expect(await run.board.answer.isDisabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: "plan" }]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
