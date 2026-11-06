// The Tree's drag is a change, as the buttons' moves are, in each engine, on the widget host and
// on the real board page (widget-editing-plus, spec "Tree drag has a keyboard path and is a
// change"): the Alt+Shift keys make the position a drag makes, "Your changes" counts the node once,
// the Gantt plan's tasks follow the Tree's order, "Answer" sends the moved Tree whose diff is one
// `move`, and a node dragged away and back leaves no change.

import { describe, expect, test } from "bun:test";
import { elementChanges, TREE_SHAPE, type TreeNode } from "@askboard/contract";
import { ganttPlanBoardDocument, treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import { planGantt, planQuestion, planTree } from "./fixtures/gantt-plan.ts";
import { ganttOf, rowTexts } from "./fixtures/gantt-view.ts";
import { wbs, withBuild } from "./fixtures/tree-documents.ts";
import { eventually, QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { dragDrop, ZONE } from "./harness/tree-drag.ts";
import { pressIn, treeFocus, treeGridOf } from "./harness/tree-grid.ts";
import { allPlaces, focusPortal, markedIds, readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { placeSuffix, placesOf, widgetBoardFor } from "./harness/widget-board.ts";

const dist = await readViewBuild();

/** Focuses `billing`, one row down from `portal`, by the keys. */
const focusBilling = async (
  run: Parameters<typeof focusPortal>[0],
  tree: ReturnType<typeof treeGridOf>,
): Promise<void> => {
  await focusPortal(run, tree);
  expect(await pressIn(run.board, "ArrowDown")).toEqual({ nodeId: "billing" });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const place of placesOf())
    describe(`${engine}: the Tree's drag as a change${placeSuffix(place)}`, () => {
      const { host } = widgetBoardFor(engine, place);

      test(
        "Alt+Shift+ArrowUp on billing leaves the Tree as a drop on the top of portal does, and Alt+Shift+ArrowRight as a drop into it",
        async () => {
          const places: Record<string, string[]> = {};
          for (const by of ["keys", "drag"] as const)
            for (const move of ["before", "into"] as const) {
              const run = await host(dist, treeBoardDocument);
              await readyIn(run);
              const tree = treeGridOf(run.board);
              if (by === "keys") {
                await focusBilling(run, tree);
                const key = move === "before" ? "Alt+Shift+ArrowUp" : "Alt+Shift+ArrowRight";
                expect(await pressIn(run.board, key)).toEqual({ nodeId: "billing" });
              } else {
                await dragDrop(run.board, tree, "billing", "portal", ZONE[move]);
              }
              await eventually(
                async () => (await tree.counter.textContent()) === "Your changes: 1",
                "the counter to read one change",
              );
              expect(await treeFocus(run.board)).toEqual({ nodeId: "billing" });
              places[`${by} ${move}`] = [
                ...(await allPlaces(tree)),
                ...(await markedIds(tree)),
                (await tree.counter.textContent()) ?? "",
              ];
            }
          expect(places["drag before"]).toEqual(places["keys before"] as string[]);
          expect(places["drag into"]).toEqual(places["keys into"] as string[]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "billing dragged before portal: the plan's tasks follow, and Answer sends the moved Tree, a single move",
        async () => {
          const run = await host(dist, ganttPlanBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const gantt = ganttOf(board, planGantt.id);
          expect((await rowTexts(gantt)).map(([task]) => task)).toEqual([
            "ux",
            "architecture",
            "prototype",
            "portal",
            "billing",
            "reporting",
          ]);
          await dragDrop(board, tree, "billing", "portal", ZONE.before);
          await eventually(
            async () => (await rowTexts(gantt)).map(([task]) => task).indexOf("billing") === 3,
            "the plan's tasks to follow the Tree's order",
          );
          expect((await rowTexts(gantt)).map(([task]) => task)).toEqual([
            "ux",
            "architecture",
            "prototype",
            "billing",
            "portal",
            "reporting",
          ]);
          expect(await tree.counter.textContent()).toBe("Your changes: 1");
          expect(await markedIds(tree)).toEqual(["billing moved"]);
          await board.answer.click({ timeout: STEP_TIMEOUT_MS });
          await eventually(() => run.messages.length > 1, "the answer message");
          await Bun.sleep(QUIET_MS);
          const answer = run.messages.find((message) => message.type === "answer");
          const value = answer?.type === "answer" ? answer.values?.[planTree.id] : undefined;
          const checked = validateTreeProps(value, "edited");
          expect(checked.ok).toBe(true);
          expect(value).toEqual(
            withBuild((children) => [children[1], children[0], ...children.slice(2)] as TreeNode[]),
          );
          if (checked.ok) {
            expect(elementChanges(planTree.id, planTree.props, checked.value, TREE_SHAPE)).toEqual([
              { op: "move", target: `${wbs.id}.billing`, parent: "build" },
            ]);
          }
          expect(answer?.type === "answer" ? answer.itemId : undefined).toBe(planQuestion.id);
          expect(run.browser.errors).toEqual([]);
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    });
}
