// The Tree's undo, in each engine (tree-edit-undo; view spec, "Tree undo", "Tree undo history"):
// Ctrl or Cmd with Z in the tree and the toolbar's "Undo" put the Tree back as it was before the
// user's latest edit, the Gantt plans that edit changed with it, the draft as it was and nothing
// sent; each edit is undone latest first; the history is in memory only and goes when the Tree is
// read-only or when anything but the Tree changes what its latest edit wrote.

import { describe, expect, test } from "bun:test";
import {
  ganttPlanBoardDocument,
  treeBoardDocument,
  uj2ExpandedBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { keysTo } from "./fixtures/gantt-input.ts";
import { tabIntoPlanGrid } from "./fixtures/gantt-plan.ts";
import { ganttOf, panelOf, rowTexts } from "./fixtures/gantt-view.ts";
import { plan, wbs } from "./fixtures/tree-documents.ts";
import { draftValues } from "./fixtures/wbs-documents.ts";
import {
  eventually,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  buttonOf,
  lifecycleScenario,
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { type AskInput, askInputFor } from "./harness/scenario-ask.ts";
import { dragDrop, ZONE } from "./harness/tree-drag.ts";
import {
  deleteQuestion,
  pressIn,
  shiftTabToAddNode,
  toolFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import {
  expectNewNode,
  expectUnchanged,
  FIXTURE_IDS,
  focusPortal,
  pageOf,
  placeOf,
  readyIn,
  shownIds,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { placeSuffix, placesOf, widgetBoardFor } from "./harness/widget-board.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const UNDO = "Undo";
const ADJUST = "Adjust by %…";
const UNDONE = "Last change undone.";
const NONE = "No changes";
const PORTAL_QUESTION = "“Customer portal” will be deleted. 1 task in the plan depends on it.";

/** Ctrl or Cmd with Z, which the Tree reads with the focus in its grid. */
const undoKey = (board: Board) => board.page.keyboard.press("ControlOrMeta+z");

/** The Undo tool: found by its marker, which no language changes. */
const undoTool = (board: Board) => board.view.locator("[data-tree-undo]");

const undoDisabled = async (board: Board): Promise<boolean> =>
  (await undoTool(board).getAttribute("aria-disabled")) === "true";

const countsAs = (tree: ReturnType<typeof treeGridOf>, words: string) => () =>
  tree.counter.textContent().then((text) => text === words);

/** The key as the page's platform writes it in a tooltip. */
const keyWords = async (board: Board): Promise<string> =>
  (await board.page.evaluate(() => navigator.userAgent)).match(/Macintosh|Mac OS X/)
    ? "⌘Z"
    : "Ctrl+Z";

const italian: ViewDocument = { ...treeBoardDocument, language: "it-IT" };

/** Focuses `billing`, one row below `portal`. */
const focusBilling = async (run: WidgetHostRun, tree: ReturnType<typeof treeGridOf>) => {
  await focusPortal(run, tree);
  expect(await pressIn(run.board, "ArrowDown")).toEqual({ nodeId: "billing" });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const place of placesOf())
    describe(`${engine}: the Tree's undo${placeSuffix(place)}`, () => {
      const { host } = widgetBoardFor(engine, place);

      test(
        "Undo is in the toolbar from the start, disabled, with its key in the tooltip and in aria-keyshortcuts",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          expect(await undoTool(board).count()).toBe(1);
          expect(await tree.tool(UNDO).count()).toBe(1);
          expect(await undoDisabled(board)).toBe(true);
          expect(await undoTool(board).getAttribute("title")).toBe(
            `Undo (${await keyWords(board)})`,
          );
          expect(await undoTool(board).getAttribute("aria-keyshortcuts")).toBe("Control+Z Meta+Z");
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "billing dropped into portal by mistake, Ctrl or Cmd with Z puts it back: no changes, nothing sent, the page has not navigated",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const page = await pageOf(run);
          await dragDrop(board, tree, "billing", "portal", ZONE.into);
          await eventually(async () => (await placeOf(tree, "billing"))[0] === "3", "the nest");
          expect(await undoDisabled(board)).toBe(false);
          await undoKey(board);
          await eventually(async () => (await placeOf(tree, "billing"))[0] === "2", "the undo");
          expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
          await eventually(countsAs(tree, NONE), NONE, STEP_TIMEOUT_MS);
          expect(await undoDisabled(board)).toBe(true);
          expect(await board.view.getByRole("status").filter({ hasText: UNDONE }).count()).toBe(1);
          expect(await pageOf(run)).toEqual(page);
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "Undo from the toolbar after Indent: billing is back after portal, the focus stays on Undo and the current row is billing",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await tree.cell("billing", 0).click();
          await tree.tool("Indent").click();
          await eventually(async () => (await placeOf(tree, "billing"))[0] === "3", "the indent");
          await tree.tool(UNDO).focus();
          await tree.tool(UNDO).click();
          await eventually(async () => (await placeOf(tree, "billing"))[0] === "2", "the undo");
          expect(await placeOf(tree, "billing")).toEqual(["2", "2", "3"]);
          expect(await toolFocus(board)).toBe(UNDO);
          expect(await tree.row("billing").getAttribute("aria-current")).toBe("true");
          await eventually(countsAs(tree, NONE), NONE, STEP_TIMEOUT_MS);
          expect(await undoDisabled(board)).toBe(true);
          expect(await toolFocus(board)).toBe(UNDO);
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "a rename, a move and a delete are undone latest first, and the draft holds nothing at the end",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await focusPortal(run, tree);
          await typeIn(run, tree, "F2", "Portal v2");
          await board.page.keyboard.press("Enter");
          await pressIn(board, "ArrowDown");
          await pressIn(board, "Alt+Shift+ArrowUp");
          await pressIn(board, "ArrowDown");
          await pressIn(board, "ArrowDown");
          await pressIn(board, "Delete");
          await eventually(
            async () => !(await shownIds(tree)).includes("reporting"),
            "reporting to go",
          );
          await undoKey(board);
          await eventually(
            async () => (await shownIds(tree)).includes("reporting"),
            "reporting back",
          );
          expect((await shownIds(tree)).slice(5)).toEqual(["billing", "portal", "reporting"]);
          expect(await tree.cell("portal", 0).textContent()).toContain("Portal v2");
          await undoKey(board);
          await eventually(
            async () => (await shownIds(tree)).slice(5).join() === "portal,billing,reporting",
            "billing back in its place",
          );
          expect(await tree.cell("portal", 0).textContent()).toContain("Portal v2");
          await undoKey(board);
          await eventually(
            async () =>
              ((await tree.cell("portal", 0).textContent()) ?? "").includes("Customer portal"),
            "the old name",
          );
          await eventually(countsAs(tree, NONE), NONE, STEP_TIMEOUT_MS);
          expect(await undoDisabled(board)).toBe(true);
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "a bulk adjustment is undone in one step, from the toolbar",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await tree.grid.locator("[data-select-all]").click();
          await tree.tool(ADJUST).click();
          const panel = board.view.getByRole("dialog");
          await panel.getByLabel("Percentage", { exact: true }).fill("+10");
          await panel.getByRole("button", { name: "Apply" }).click();
          await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
          expect(await tree.marks("field").count()).toBeGreaterThan(0);
          await tree.tool(UNDO).click();
          await eventually(countsAs(tree, NONE), NONE, STEP_TIMEOUT_MS);
          expect(await tree.marks("field").count()).toBe(0);
          await expectUnchanged(run);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "Ctrl or Cmd with Z while a name is typed is the editor's own undo: the editor stays and no Tree edit is undone",
        async () => {
          const run = await host(dist, treeBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          await focusBilling(run, tree);
          await pressIn(board, "Alt+Shift+ArrowUp");
          await eventually(
            async () => (await shownIds(tree)).slice(5).join() === "billing,portal,reporting",
            "the move",
          );
          await typeIn(run, tree, "F2", "abc");
          await undoKey(board);
          expect(await tree.editor.count()).toBe(1);
          await board.page.keyboard.press("Escape");
          expect((await shownIds(tree)).slice(5)).toEqual(["billing", "portal", "reporting"]);
          expect(await undoDisabled(board)).toBe(false);
        },
        TEST_TIMEOUT_MS,
      );

      // The session process host builds its ask from the document's items, which carry no language:
      // the Italian board is the widget host's.
      if (place === "widget host") {
        test(
          "on an Italian board the tool reads Annulla with its key, and the undo announces Ultima modifica annullata.",
          async () => {
            const run = await host(dist, italian);
            await readyIn(run);
            const { board } = run;
            const tree = treeGridOf(board);
            await focusBilling(run, tree);
            await pressIn(board, "Alt+Shift+ArrowUp");
            await eventually(
              async () => (await shownIds(tree)).slice(5).join() === "billing,portal,reporting",
              "the move",
            );
            expect(((await undoTool(board).textContent()) ?? "").trim()).toBe("Annulla");
            expect(await undoTool(board).getAttribute("title")).toBe(
              `Annulla (${await keyWords(board)})`,
            );
            await undoKey(board);
            await eventually(
              async () =>
                (await board.view
                  .getByRole("status")
                  .filter({ hasText: "Ultima modifica annullata." })
                  .count()) === 1,
              "the announcement in Italian",
            );
            expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
          },
          TEST_TIMEOUT_MS,
        );
      }
    });

  describe(`${engine}: the Tree's undo with linked plans`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a package with a dependent deleted and confirmed comes back with Ctrl or Cmd with Z, and the plan's dependent holds its predecessors as before",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, "schedule");
        const before = await rowTexts(gantt);
        await focusPortal(run, tree);
        await board.page.keyboard.press("Delete");
        const question = deleteQuestion(board, PORTAL_QUESTION);
        await question.waitFor({ timeout: STEP_TIMEOUT_MS });
        await question.getByRole("button", { name: "Delete" }).click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => !(await shownIds(tree)).includes("portal"),
          "the portal to go",
        );
        expect(Object.keys(draftValues(run)).length).toBe(2);
        await tree.row("design").click();
        await undoKey(board);
        await eventually(async () => (await shownIds(tree)).includes("portal"), "the portal back");
        await eventually(
          async () => JSON.stringify(await rowTexts(gantt)) === JSON.stringify(before),
          "the plan as before",
        );
        await eventually(
          () => Object.keys(draftValues(run)).length === 0,
          "the draft to hold nothing",
        );
        await expectUnchanged(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a package added, then a dependency changed in the Gantt plan: Ctrl or Cmd with Z in the Tree undoes nothing and Undo is disabled",
      async () => {
        const run = await host(dist, ganttPlanBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, "schedule");
        await focusPortal(run, tree);
        expect(await shiftTabToAddNode(board)).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Customer portal: dashboards");
        await board.page.keyboard.press("Enter");
        await eventually(async () => (await shownIds(tree)).includes("u-1"), "the added package");
        expect(await undoDisabled(board)).toBe(false);
        await tabIntoPlanGrid(board);
        const tasks = ["ux", "architecture", "prototype", "portal", "u-1", "billing", "reporting"];
        await keysTo(
          board,
          "billing",
          "dependencies",
          tasks.map((id) => ({ id })),
        );
        await board.page.keyboard.press("Enter");
        const panel = panelOf(gantt, "billing");
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        for (let at = 0; at < 2; at += 1) await board.page.keyboard.press("ArrowDown");
        await board.page.keyboard.press("Space");
        await board.page.keyboard.press("Enter");
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        const plan = await rowTexts(gantt);
        await eventually(() => undoDisabled(board), "Undo to be disabled");
        await tree.row("design").click();
        await undoKey(board);
        expect(await shownIds(tree)).toContain("u-1");
        expect(await rowTexts(gantt)).toEqual(plan);
      },
      TEST_TIMEOUT_MS,
    );
  });

  if (placesOf().includes("session process"))
    describe(`${engine}: the Tree's undo history on the real board`, () => {
      const { start } = useEngine(engine);

      const ask = (): Promise<AskInput> =>
        askInputFor({
          name: treeBoardDocument.askId,
          askId: treeBoardDocument.askId,
          token: "",
          steps: [{ from: "host", message: { type: "board", document: treeBoardDocument } }],
        } as never);

      const open = async () => {
        const run = await start(lifecycleScenario(await ask(), dist));
        const board = await openBoard(run, [plan.id]);
        return { run, board, tree: treeGridOf(board) };
      };

      test(
        "a move survives a reload in the draft, and Undo is disabled after it",
        async () => {
          const { run, board, tree } = await open();
          await dragDrop(board, tree, "billing", "portal", ZONE.before);
          await eventually(countsAs(tree, "Your changes: 1"), "the change");
          await eventually(
            () => sentDrafts(run).some((record) => JSON.stringify(record).includes(wbs.id)),
            "the draft mirrored to the board page",
          );
          await reloadBoard(board, run, () => tree.grid.waitFor({ timeout: STEP_TIMEOUT_MS }));
          await eventually(countsAs(tree, "Your changes: 1"), "the move still in the draft");
          expect((await shownIds(tree)).slice(5)).toEqual(["billing", "portal", "reporting"]);
          expect(await undoDisabled(board)).toBe(true);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "after Answer and Edit, Undo is disabled until the next edit",
        async () => {
          const { run, board, tree } = await open();
          await dragDrop(board, tree, "billing", "portal", ZONE.before);
          await eventually(countsAs(tree, "Your changes: 1"), "the change");
          expect(await undoDisabled(board)).toBe(false);
          await answerOf(board, plan.id).click({ timeout: STEP_TIMEOUT_MS });
          await actsDone(run, 1);
          expect(await undoDisabled(board)).toBe(true);
          await buttonOf(board, plan.id, "Edit").click({ timeout: STEP_TIMEOUT_MS });
          await eventually(async () => (await tree.tool("Indent").count()) === 1, "the Tree");
          expect(await undoDisabled(board)).toBe(true);
          await tree.cell("reporting", 0).click();
          await tree.tool("Indent").click();
          await eventually(() => undoDisabled(board).then((disabled) => !disabled), "Undo enabled");
        },
        TEST_TIMEOUT_MS,
      );
    });
}
