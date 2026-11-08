// The WBS's edits carried into its plan, in each engine, on the widget host (molecules design
// decisions 11 and 12; F20; view spec, "An added package's predecessors", "Linked edits within a
// plan's limits", "A linked edit on an answered question", "Deleting a package with dependents"): a
// package named after, or under, another gets that package's predecessors in the plan in the same
// draft update, nothing leaving the view; an addition taken back writes nothing; a linked edit past
// a plan's limit is refused at the name, writing nothing; on an answered question the plan's draft
// value starts from its answer; and a package other tasks depend on is deleted only once the user
// confirms, its dependents then depending on its predecessors; and a leaf that holds an estimate or
// is a task of the plan becomes a group (a drop into it, an indent under it, "Add child" on it) only
// once the user answers the group question, "Cancel" and Escape changing nothing (wbs-gantt-
// consistency; view spec, "Making a work package a group asks first", "Answering the group question").

import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_PLAN_SHAPE } from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { ViewDocument } from "../../src/view-document.ts";
import { ganttOf, rowTexts } from "./fixtures/gantt-view.ts";
import {
  answeredStateOf,
  cellTexts,
  crowdedDocument,
  draftValues,
  planWith,
  portalUnderBillingDocument,
  portalWithChildDocument,
  railDocument,
  reportingBeforeBillingDocument,
  rowDocument,
  rowPortalNamedDocument,
  totalRow,
  uxNamedDocument,
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
import { expectWrapped, groupLayout, wordsReadLeftToRight } from "./harness/group-layout.ts";
import { dragDrop, ZONE } from "./harness/tree-drag.ts";
import {
  deleteQuestion,
  groupQuestion,
  pressIn,
  pressTool,
  shiftTabToAddNode,
  type TreeGrid,
  toolFocus,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  allPlaces,
  askedGroup,
  continueGroup,
  expectNewNode,
  expectSteps,
  expectUnchanged,
  focusPortal,
  placeOf,
  readyIn,
  shownIds,
  typeIn,
} from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const DASHBOARDS = "Customer portal: dashboards";

/** The refusal of a package named after the portal on the crowded plan. */
const PAST_DEPENDENTS =
  "Clickable prototype would have more than 50 dependent tasks, the most a task can have.";

/** The predecessors the portal has, which a package named after it gets. */
const PORTAL_PREDECESSORS = ["architecture", "prototype"];

/** The question before the portal, an estimated task one other task depends on, becomes a group. */
const PORTAL_GROUP =
  "“Customer portal” becomes a group: its estimates leave the totals while it has children, and its task leaves the plan. 1 task in the plan depends on it.";

/** The question before reporting, on which no task depends, becomes a group. */
const REPORTING_GROUP =
  "“Reporting” becomes a group: its estimates leave the totals while it has children, and its task leaves the plan.";

/** The same question in Italian, for the portal. */
const ITALIAN_GROUP =
  "“Customer portal” diventa un gruppo: le sue stime escono dai totali finché ha figli, e la sua attività esce dal piano. 1 attività del piano dipende da esso.";

/** The question before deleting the portal, on which reporting depends. */
const PORTAL_QUESTION = "“Customer portal” will be deleted. 1 task in the plan depends on it.";

/** The plan's row of `task`: its ID, name, start, duration and predecessors. */
const rowOf = async (run: WidgetHostRun, task: string) =>
  (await rowTexts(ganttOf(run.board, wbsPlan.id))).find(([id]) => id === task);

/** Opens "Add node" on the focused node from the toolbar and names the new package `label`. */
const addAndName = async (run: WidgetHostRun, tree: TreeGrid, tool: "Add node" | "Add child") => {
  expect(await shiftTabToAddNode(run.board)).toBe("Add node");
  if (tool === "Add child") expect(await pressTool(run.board, "ArrowRight")).toBe("Add child");
  await run.board.page.keyboard.press("Enter");
  // "Add child" on an estimated leaf of the plan's Tree asks first; "Continue" starts the name.
  if (tool === "Add child") await continueGroup(run);
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
        const cells = tree.row("u-1").locator("[data-cell]");
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
  describe(`${engine}: making a work package a group asks first`, () => {
    const { host } = useWidgetHost(engine);

    /** Opens the UJ-2 board, with the places of its rows and the Total's cells before any edit. */
    const opened = async (document: ViewDocument = uj2ExpandedBoardDocument as ViewDocument) => {
      const run = await host(dist, document);
      await readyIn(run);
      const tree = treeGridOf(run.board);
      return { run, tree, places: await allPlaces(tree), totals: await cellTexts(totalRow(tree)) };
    };

    /** Drops `billing` on the middle of the portal: the question, with nothing moved. */
    const dropBillingIntoPortal = async (
      run: WidgetHostRun,
      tree: TreeGrid,
      message = PORTAL_GROUP,
    ) => {
      await dragDrop(run.board, tree, "billing", "portal", ZONE.into);
      return askedGroup(run, message);
    };

    test(
      "billing dropped on the middle of the portal asks first, in the toolbar row in place of the tools, with the focus on Cancel and nothing moved, drafted or sent",
      async () => {
        const { run, tree, places, totals } = await opened();
        await dropBillingIntoPortal(run, tree);
        expect(await tree.toolbar.count()).toBe(0);
        expect(await deleteQuestion(run.board).count()).toBe(0);
        expect(await allPlaces(tree)).toEqual(places);
        expect(await cellTexts(totalRow(tree))).toEqual(totals);
        expect((await rowOf(run, "portal"))?.[0]).toBe("portal");
        expect(draftValues(run)).toEqual({});
        await expectUnchanged(run);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    /** Whether the focus is inside a part of the Tree: false when the part is not drawn. */
    const focusWithin = async (part: Locator) =>
      (await part.count()) === 1 &&
      (await part.evaluate((element) => element.contains(element.ownerDocument.activeElement)));

    /** Whether the focus is inside the treegrid or its toolbar, never on the page body or the card. */
    const focusInTree = async (tree: TreeGrid) =>
      (await focusWithin(tree.grid)) || (await focusWithin(tree.toolbar));

    test(
      "the agent giving the portal a child while the question is open closes it with nothing applied, and the focus stays in the Tree",
      async () => {
        const { run, tree } = await opened();
        await dropBillingIntoPortal(run, tree);
        const next = portalWithChildDocument();
        await run.update({ type: "state", state: openStateOf(next), document: next });
        await groupQuestion(run.board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await shownIds(tree)).toContain("gateway");
        expect((await placeOf(tree, "billing"))[0]).toBe("2");
        expect(draftValues(run)).toEqual({});
        expect(await focusInTree(tree)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    /** Opens the indent question on billing, which names the portal: the question and its tree. */
    const askedToIndentBilling = async () => {
      const opened_ = await opened();
      const { run, tree } = opened_;
      await focusPortal(run, tree);
      expect(await pressIn(run.board, "ArrowDown")).toEqual({ nodeId: "billing" });
      await run.board.page.keyboard.press("Alt+Shift+ArrowRight");
      return { ...opened_, question: await askedGroup(run, PORTAL_GROUP) };
    };

    test(
      "the agent moving reporting before billing while the indent question names the portal closes it with nothing applied: no question names Reporting, billing stays under build and the focus stays in the Tree",
      async () => {
        const { run, tree } = await askedToIndentBilling();
        const next = reportingBeforeBillingDocument();
        await run.update({ type: "state", state: openStateOf(next), document: next });
        await eventually(
          async () =>
            (await shownIds(tree)).join() ===
            "design,ux,architecture,prototype,build,portal,reporting,billing",
          "the Tree to show the agent's order",
        );
        await groupQuestion(run.board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await groupQuestion(run.board, /Reporting/).count()).toBe(0);
        expect(await placeOf(tree, "billing")).toEqual(["2", "3", "3"]);
        expect(await tree.row("reporting").getAttribute("aria-expanded")).toBeNull();
        expect(await placeOf(tree, "reporting")).toEqual(["2", "2", "3"]);
        expect(draftValues(run)).toEqual({});
        expect(await focusInTree(tree)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an agent update that leaves the leaf as it was, renaming another package, keeps the question open with its words, and Continue puts billing under the portal",
      async () => {
        const { run, tree } = await askedToIndentBilling();
        const next = uxNamedDocument("UX and research");
        await run.update({ type: "state", state: openStateOf(next), document: next });
        await eventually(
          async () =>
            (await tree.cell("ux", 0).textContent())?.includes("UX and research") === true,
          "the Tree to show the new name",
        );
        const question = await askedGroup(run, PORTAL_GROUP);
        await question.getByRole("button", { name: "Continue", exact: true }).click({
          timeout: STEP_TIMEOUT_MS,
        });
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await placeOf(tree, "billing"))[0] === "3",
          "billing to indent",
        );
        expect(await placeOf(tree, "billing")).toEqual(["3", "1", "1"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent moving the portal under billing, then Continue, changes nothing, closes the question and leaves the focus on the grid",
      async () => {
        const { run, tree } = await opened();
        await dropBillingIntoPortal(run, tree);
        const next = portalUnderBillingDocument();
        await run.update({ type: "state", state: openStateOf(next), document: next });
        const question = groupQuestion(run.board);
        await question.waitFor({ timeout: STEP_TIMEOUT_MS });
        const before = await allPlaces(tree);
        await question.getByRole("button", { name: "Continue", exact: true }).click({
          timeout: STEP_TIMEOUT_MS,
        });
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await allPlaces(tree)).toEqual(before);
        expect(draftValues(run)).toEqual({});
        // A confirmed drop that no longer applies leaves the focus on the grid, as decision 3 says.
        expect(await focusWithin(tree.grid)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a second drop of billing onto reporting while the question is open asks anew, with the focus on Cancel",
      async () => {
        const { run, tree } = await opened();
        await dropBillingIntoPortal(run, tree);
        await dragDrop(run.board, tree, "billing", "reporting", ZONE.into);
        await askedGroup(run, REPORTING_GROUP);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Continue puts billing under the portal: the totals lose the portal's expected effort, the plan has no row for the portal, reporting shows the field error and only the Tree is drafted; dragged back, the draft is gone",
      async () => {
        const { run, tree, places, totals } = await opened();
        const question = await dropBillingIntoPortal(run, tree);
        await question.getByRole("button", { name: "Continue", exact: true }).click();
        await eventually(
          async () => (await placeOf(tree, "billing"))[0] === "3",
          "billing to move",
        );
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await placeOf(tree, "billing")).toEqual(["3", "1", "1"]);
        expect(await tree.row("portal").getAttribute("aria-expanded")).toBe("true");
        expect(await treeFocus(run.board)).toEqual({ nodeId: "billing" });
        await expectDraftOf(run, [wbsTree.id]);
        // The portal, a parent, no longer counts: the Total loses its expected effort.
        const after = await cellTexts(totalRow(tree));
        expect(after.slice(0, 4)).toEqual(totals.slice(0, 4));
        expect(after.slice(4)).not.toEqual(totals.slice(4));
        expect(Number.parseFloat(after[4] ?? "")).toBeCloseTo(
          Number.parseFloat(totals[4] ?? "") - 12.7,
          1,
        );
        await eventually(
          async () => (await rowOf(run, "portal")) === undefined,
          "the portal to leave the plan",
        );
        const gantt = ganttOf(run.board, wbsPlan.id);
        await gantt.note("reporting").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(((await gantt.note("reporting").textContent()) ?? "").trim()).toBe(
          "No dates: its predecessor portal names no task.",
        );
        // Dragged back under Build, right after the portal, the Tree is the agent's again.
        await dragDrop(run.board, tree, "billing", "portal", ZONE.after);
        await eventually(
          async () => (await placeOf(tree, "billing"))[0] === "2",
          "billing to leave",
        );
        expect(await allPlaces(tree)).toEqual(places);
        expect(await cellTexts(totalRow(tree))).toEqual(totals);
        await expectDraftOf(run, []);
        await eventually(
          async () => (await rowOf(run, "portal")) !== undefined,
          "the portal's row",
        );
        expect(await gantt.note("reporting").count()).toBe(0);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await groupQuestion(run.board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    for (const [how, cancel] of [
      ["Cancel", "Enter"],
      ["Escape", "Escape"],
    ] as const) {
      test(
        `${how} on the question changes nothing and returns the focus to billing's row`,
        async () => {
          const { run, tree, places, totals } = await opened();
          const question = await dropBillingIntoPortal(run, tree);
          await run.board.page.keyboard.press(cancel);
          await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
          expect(await tree.toolbar.count()).toBe(1);
          await eventually(
            async () => (await treeFocus(run.board))?.nodeId === "billing",
            "the focus to return to billing's row",
          );
          expect(await treeFocus(run.board)).toEqual({ nodeId: "billing" });
          expect(await allPlaces(tree)).toEqual(places);
          expect(await cellTexts(totalRow(tree))).toEqual(totals);
          expect(draftValues(run)).toEqual({});
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "Alt+Shift+ArrowRight on billing asks the same question with nothing moved; Escape cancels it, and again with Continue it indents billing",
      async () => {
        const { run, tree, places } = await opened();
        await focusPortal(run, tree);
        expect(await pressIn(run.board, "ArrowDown")).toEqual({ nodeId: "billing" });
        await run.board.page.keyboard.press("Alt+Shift+ArrowRight");
        const question = await askedGroup(run, PORTAL_GROUP);
        expect(await allPlaces(tree)).toEqual(places);
        expect(draftValues(run)).toEqual({});
        await run.board.page.keyboard.press("Escape");
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await treeFocus(run.board))?.nodeId === "billing",
          "the focus to return",
        );
        expect(await allPlaces(tree)).toEqual(places);
        await expectUnchanged(run);
        await run.board.page.keyboard.press("Alt+Shift+ArrowRight");
        await continueGroup(run);
        await eventually(
          async () => (await placeOf(tree, "billing"))[0] === "3",
          "billing to indent",
        );
        expect(await placeOf(tree, "billing")).toEqual(["3", "1", "1"]);
        expect(await treeFocus(run.board)).toEqual({ nodeId: "billing" });
        await expectDraftOf(run, [wbsTree.id]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      '"Add child" on reporting asks before any name editor; Cancel returns to the tool; Continue starts the name, and Escape there adds no node and no draft value',
      async () => {
        const { run, tree } = await opened();
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "billing" }],
          ["ArrowDown", { nodeId: "reporting" }],
        ]);
        expect(await shiftTabToAddNode(run.board)).toBe("Add node");
        expect(await pressTool(run.board, "ArrowRight")).toBe("Add child");
        await run.board.page.keyboard.press("Enter");
        const question = await askedGroup(run, REPORTING_GROUP);
        expect(await tree.editor.count()).toBe(0);
        expect(await shownIds(tree)).not.toContain("u-1");
        expect(draftValues(run)).toEqual({});
        // Cancel: the focus is back on the tool.
        await run.board.page.keyboard.press("Escape");
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await toolFocus(run.board)) === "Add child",
          "the focus on the tool",
        );
        await run.board.page.keyboard.press("Enter");
        await continueGroup(run);
        await expectNewNode(tree, "u-1");
        expect(await pressIn(run.board, "Escape")).toEqual({ nodeId: "reporting" });
        expect(await shownIds(tree)).not.toContain("u-1");
        expect(draftValues(run)).toEqual({});
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      '"Add node" on an estimated leaf never asks',
      async () => {
        const { run, tree } = await opened();
        await focusPortal(run, tree);
        await addAndName(run, tree, "Add node");
        expect(await groupQuestion(run.board).count()).toBe(0);
        expect(await pressIn(run.board, "Escape")).toEqual({ nodeId: "portal" });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an it-IT board asks in Italian, with Annulla and Continua",
      async () => {
        const { run, tree } = await opened({
          ...uj2ExpandedBoardDocument,
          language: "it-IT",
        } as unknown as ViewDocument);
        await dragDrop(run.board, tree, "billing", "portal", ZONE.into);
        const question = await askedGroup(run, ITALIAN_GROUP);
        expect(await question.getByRole("button").allTextContents()).toEqual([
          "Annulla",
          "Continua",
        ]);
        await run.board.page.keyboard.press("Escape");
        await question.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );
  });

  // View spec, "The group question's layout" ("At the viewport floor"; review 3.3 S-1): at 1,280 px
  // the sentence wraps with the leaf's name whole, "Cancel" and "Continue" under it, and the toolbar
  // row grows to hold it. The window is the harness's 1,280 x 800.
  describe(`${engine}: the group question's layout at the viewport floor`, () => {
    const { host } = useWidgetHost(engine);

    /** Drops billing into the portal on `document` and measures the question that opens. */
    const askedOn = async (document: ViewDocument, message?: string) => {
      const run = await host(dist, document);
      await readyIn(run);
      const tree = treeGridOf(run.board);
      await dragDrop(run.board, tree, "billing", "portal", ZONE.into);
      await askedGroup(run, message);
      return { run, layout: await groupLayout(run.board) };
    };

    test(
      "the Tree and plan in a Row: the name is whole, no words run under a button or past the toolbar row",
      async () => {
        const { layout } = await askedOn(rowDocument, PORTAL_GROUP);
        expectWrapped(layout);
        expect(layout.lines).toBeGreaterThan(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the question beside a second one, with the outline rail: the same",
      async () => {
        const { run, layout } = await askedOn(railDocument, PORTAL_GROUP);
        expect(await run.board.view.getByRole("navigation", { name: "Outline" }).count()).toBe(1);
        expectWrapped(layout);
        expect(layout.toolbarWidth).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in Italian, in a Row: the same",
      async () => {
        const italian = { ...rowDocument, language: "it-IT" } as unknown as ViewDocument;
        const { layout } = await askedOn(italian, ITALIAN_GROUP);
        expectWrapped(layout);
      },
      TEST_TIMEOUT_MS,
    );

    // DESIGN and EXPERIENCE, "Agent-written labels" (F-64; review 3.10 X-1): an unterminated
    // right-to-left override in the label ends with the label, so AskBoard's own words still read
    // left to right.
    test(
      "a leaf named with an unterminated right-to-left override: AskBoard's words after it read left to right",
      async () => {
        const run = await host(dist, rowPortalNamedDocument("Customer portal\u202E"));
        await readyIn(run);
        await dragDrop(run.board, treeGridOf(run.board), "billing", "portal", ZONE.into);
        await askedGroup(run);
        expect(await wordsReadLeftToRight(run.board)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a leaf named with 200 characters and no space: the name wraps inside its paragraph",
      async () => {
        const { layout } = await askedOn(rowPortalNamedDocument("P".repeat(200)));
        expectWrapped(layout);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
