// Answered widget questions on the real board page, in each engine (widget-answers, task 5.2; view
// spec: Answered widget questions): the user renames a node of the Tree and presses "Answer"; the
// Tree then shows the edited name with the receipt "sent", then "delivered to the agent" once the
// agent collects, and the same after a reload and in a takeover's new tab, restored from the board
// state. The answer is logged with the Tree's change. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { planAsk } from "./fixtures/widget-asks.ts";
import {
  type BoardRun,
  eventually,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard, sentDrafts } from "./harness/lifecycle-test.ts";
import { pressIn, tabIntoTree, treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const [{ props }] = planAsk.items;
const NEW_NAME = "UX design, reviewed";

// Renames `ux` with the keyboard alone: into the Tree, down to the row, F2 on its name, Enter.
const renameUx = async (board: Board): Promise<void> => {
  const tree = treeGridOf(board);
  await tabIntoTree(board, props.text);
  await pressIn(board, "ArrowDown");
  await pressIn(board, "ArrowRight");
  await board.page.keyboard.press("F2");
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(NEW_NAME);
  await pressIn(board, "Enter");
  await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
};

// The Tree shows the edited name, read from its cell, with no editor open.
const expectEdited = async (board: Board): Promise<void> => {
  const tree = treeGridOf(board);
  await eventually(
    async () => ((await tree.cell("ux", 0).textContent()) ?? "").includes(NEW_NAME),
    "the Tree to show the edited name",
  );
  expect(await tree.editor.count()).toBe(0);
};

const reloadAndOpen = (run: BoardRun, board: Board) =>
  reloadBoard(board, run, async () => {
    await board.view
      .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
      .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS * 2 });
  });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: answered widget questions`, () => {
    const { start } = useEngine(engine);

    test(
      "after Answer the Tree shows the edited name with the receipt, then delivered once collected",
      async () => {
        const run = await start(lifecycleScenario(planAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await renameUx(board);
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectEdited(board);
        const { events } = await run.session.collect();
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectEdited(board);
        // The draft holds no value for the widgets once the answer is logged.
        await eventually(
          () => sentDrafts(run).at(-1)?.questions.plan?.values === undefined,
          "the draft record to hold no widget value",
        );
        expect(events.map((event) => event.type)).toEqual(["answer"]);
        expect(events[0]?.changes).toEqual([
          { op: "set", target: "wbs.ux.label", value: NEW_NAME },
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after a reload and in a takeover's new tab the Tree shows the edited name and the receipt",
      async () => {
        const run = await start(lifecycleScenario(planAsk, dist));
        const first = await openBoard(run, ["plan"]);
        await renameUx(first);
        await first.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await reloadAndOpen(run, first);
        await first.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectEdited(first);
        const second = await openBoard(run, ["plan"]);
        await second.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectEdited(second);
        await run.session.collected();
        await second.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
