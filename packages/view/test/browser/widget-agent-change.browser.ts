// The agent's change to a widget under unsent work, on the real board page, in each engine
// (widget-answers, task 5.4; view spec: The agent's change to a widget under unsent work): the user
// renames a node of the WBS Tree and does not answer; the agent changes the plan's data; the notice
// appears, "Show the agent's change" names the Gantt plan with its number of element operations,
// "Keep mine" settles the notice, the draft is intact, and "Answer" names the kept revision.
// Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { planAsk } from "./fixtures/widget-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { pressIn, tabIntoTree, treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const [{ props }] = planAsk.items;
const [, plan] = props.items;
const NEW_NAME = "UX design, reviewed";

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');

// Renames `ux` with the keyboard alone and leaves the edit unsent.
const renameUx = async (board: Board): Promise<void> => {
  const tree = treeGridOf(board);
  await tabIntoTree(board, props.text);
  await pressIn(board, "ArrowDown");
  await pressIn(board, "ArrowRight");
  await board.page.keyboard.press("F2");
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(NEW_NAME);
  await pressIn(board, "Enter");
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the agent's change to a widget`, () => {
    const { start } = useEngine(engine);

    test(
      "new data for the plan under unsent WBS edits: the notice names the plan and its operations, Keep mine answers against the kept revision, the draft intact",
      async () => {
        const run = await start(lifecycleScenario(planAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await renameUx(board);
        await run.session.update([
          {
            action: "change",
            itemId: "schedule",
            props: {
              tasks: {
                ...plan.props.tasks,
                prototype: { dependencies: [] },
                billing: { dependencies: ["ux"] },
              },
            },
          },
        ]);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice(board)
          .getByRole("button", { name: "Show the agent's change" })
          .click({ timeout: STEP_TIMEOUT_MS });
        const line = notice(board).locator('[data-askboard-widget="schedule"]');
        await line.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await line.textContent()).toBe("schedule, the Gantt: 2 changes by the agent");
        expect(await notice(board).locator('[data-askboard-widget="wbs"]').count()).toBe(0);
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await notice(board).getByRole("button", { name: "Keep mine" }).click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        const tree = treeGridOf(board);
        await eventually(
          async () => ((await tree.cell("ux", 0).textContent()) ?? "").includes(NEW_NAME),
          "the Tree to keep the unsent edit",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const [, answer] = sentActs(run).map((command) => command.acts);
        expect(answer).toEqual([
          expect.objectContaining({ type: "answer", itemId: "plan", rev: 1 }),
        ]);
        const { events } = await run.session.collect();
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.changes).toEqual([
          { op: "set", target: "wbs.ux.label", value: NEW_NAME },
        ]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
