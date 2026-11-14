// Revising a widget answer on the real board page, in each engine (widget-answers, task 5.3; view
// spec: Revising a widget answer): after the answer is delivered the user renames one more node of
// the Tree; the change highlight still compares against the agent's original (both renames are
// marked), "Answer" sends the full edited values again, and the second event replaces the first
// with one more `set` while the first stays as it was. Every scenario runs on the session process.
// Reopen-start-from-answer (view spec: A revision keeps the widgets' edits): a revision that moves
// one more Kanban card carries the Timeline's earlier move too, as the card shows it.

import { describe, expect, test } from "bun:test";
import { kanbanItem } from "./fixtures/kanban-documents.ts";
import { timelineItem } from "./fixtures/timeline-documents.ts";
import { planAsk } from "./fixtures/widget-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { beginDrag, cardOf, cardsIn, columnOf, dragOver, release } from "./harness/kanban-drag.ts";
import { answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { dragEntry, entryOf, laneMiddle, PER_DAY, zoomOf } from "./harness/timeline-drag.ts";
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

  describe(`${engine}: revising one of two edited widgets`, () => {
    const { start } = useEngine(engine);

    test(
      "a revision moving one more Kanban card carries the Timeline's earlier move: collect gives its sets and both Kanban moves",
      async () => {
        const ask = {
          askId: "two-widgets-r4q7",
          title: "Two widgets",
          items: [
            {
              type: "question",
              id: "plan",
              props: { text: "Plan the quarter", items: [timelineItem(), kanbanItem()] },
            },
          ],
        };
        const run = await start(lifecycleScenario(ask as never, dist));
        const board = await openBoard(run, ["plan"]);
        const zoom = await zoomOf(board);
        await dragEntry(board, "checkout", {
          dx: 7 * PER_DAY[zoom],
          y: await laneMiddle(board, "mobile"),
        });
        await release(board);
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await release(board);
        await eventually(async () => (await cardsIn(board, "doing")).join() === "a", "a in doing");
        await answer(board);
        const first = await run.session.collect();
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(first.events).toHaveLength(1);
        // One more move, of the Kanban alone: the Timeline's earlier move must still be sent.
        await beginDrag(board, cardOf(board, "c"));
        await dragOver(board, columnOf(board, "done"));
        await release(board);
        await eventually(async () => (await cardsIn(board, "done")).join() === "b,c", "c in done");
        await answer(board);
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const second = await run.session.collect();
        const changes = (second.events[0]?.changes ?? []) as readonly { readonly target: string }[];
        expect(changes.map(({ target }) => target).sort()).toEqual([
          "board.a.column",
          "board.c.column",
          "roadmap.checkout.end",
          "roadmap.checkout.lane",
          "roadmap.checkout.start",
        ]);
        expect(second.events[0]?.replaces).toBe(first.events[0]?.cursor);
        expect(await entryOf(board, "checkout").getAttribute("data-change")).toBe("moved");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
