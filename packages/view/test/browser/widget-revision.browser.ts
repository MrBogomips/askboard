// Revising a widget answer on the real board page, in each engine (widget-answers, task 5.3; view
// spec: Revising a widget answer): after the answer is delivered the user renames one more node of
// the Tree; the change highlight still compares against the agent's original (both renames are
// marked), "Answer" sends the full edited values again, and the second event replaces the first
// with one more `set` while the first stays as it was. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { planAsk } from "./fixtures/widget-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { pressIn, tabIntoTree, treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const [{ props }] = planAsk.items;
const FIRST = "UX design, reviewed";
const SECOND = "Architecture, reviewed";

// Presses "Answer" once the focused cell's edit is committed.
const answer = (board: Board) => answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });

// Renames `ux` with the keyboard alone: into the Tree, down to the row, F2 on its name, Enter.
const renameUx = async (board: Board, name: string): Promise<void> => {
  const tree = treeGridOf(board);
  await tabIntoTree(board, props.text);
  await pressIn(board, "ArrowDown");
  await pressIn(board, "ArrowRight");
  await board.page.keyboard.press("F2");
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(name);
  await pressIn(board, "Enter");
  await answer(board);
};

// Renames `architecture` by clicking its name cell, since the focus stays in the Tree after the
// first answer: F2, the new name, Enter.
const renameArchitecture = async (board: Board, name: string): Promise<void> => {
  const tree = treeGridOf(board);
  await tree.cell("architecture", 0).click({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.press("F2");
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(name);
  await pressIn(board, "Enter");
  await answer(board);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: revising a widget answer`, () => {
    const { start } = useEngine(engine);

    test(
      "a revision renaming one more node logs a second event with replaces and one more set, the first unchanged",
      async () => {
        const run = await start(lifecycleScenario(planAsk, dist));
        const board = await openBoard(run, ["plan"]);
        const tree = treeGridOf(board);
        await renameUx(board, FIRST);
        const first = await run.session.collect();
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        // The draft starts from the logged value: the first rename is still marked against the
        // agent's original, and the Answer button is ready for the revision.
        await eventually(
          async () => (await tree.marks("renamed").count()) === 1,
          "one rename mark",
        );
        await renameArchitecture(board, SECOND);
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tree.marks("renamed").count()).toBe(2);
        const second = await run.session.collect();
        expect(first.events).toHaveLength(1);
        expect(second.events).toHaveLength(1);
        const [one] = first.events;
        const [two] = second.events;
        expect(one?.replaces).toBeUndefined();
        expect(one?.changes).toEqual([{ op: "set", target: "wbs.ux.label", value: FIRST }]);
        expect(two?.replaces).toBe(one?.cursor);
        expect(two?.changes).toHaveLength(2);
        expect(two?.changes).toEqual(
          expect.arrayContaining([
            { op: "set", target: "wbs.ux.label", value: FIRST },
            { op: "set", target: "wbs.architecture.label", value: SECOND },
          ]),
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
