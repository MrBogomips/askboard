// The result widgets held, restored and fetched on the real board page, in each engine
// (approval-scale-ranking, task 6.2; spec view-and-widgets: A widget result end to end, A revision
// keeps the widgets' results; core spec: Results of the shipped result widgets): a Scale value set
// and the tab reloaded shows the value with the leave-page prompt armed and nothing sent; a
// Ranking answered after a drag is returned by `fetch` of the Ranking alone as its `result` and by
// `collect` in the answer's `results`, both validated against their schemas; and a reopened
// question's "Start from my previous answer" puts the Scale's value in the draft. Every scenario
// runs on the session process.

import { describe, expect, test } from "bun:test";
import { rankingAsk } from "./fixtures/ranking-documents.ts";
import { scaleAsk } from "./fixtures/scale-documents.ts";
import { checkedEvents, checkedFetchItem } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  promptArmed,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  beginDrag,
  dragOver,
  expectDrop,
  HALF,
  handleOf,
  orderShown,
  release,
  rowOf,
} from "./harness/ranking-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const SLIDER = { min: 0, max: 100, step: 5 };
const value = (board: Board) => board.view.locator("[data-scale-value]");

// Sets the unset slider to its maximum with the keyboard and waits for the draft to hold it.
const setToMaximum = async (board: Board): Promise<void> => {
  await board.view.locator("[data-scale-unset]").focus();
  await board.page.keyboard.press("End");
  await eventually(async () => (await value(board).textContent()) === "100", "the maximum");
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the result widgets across a reload, a fetch and a reopening`, () => {
    const { start } = useEngine(engine);

    test(
      "a Scale value set and not answered survives a reload of the tab, with the leave-page prompt armed and nothing sent",
      async () => {
        const run = await start(lifecycleScenario(scaleAsk(SLIDER), dist));
        const board = await openBoard(run, ["plan"]);
        expect(await promptArmed(board)).toBe(false);
        await setToMaximum(board);
        await mirrored(
          run,
          (record) => draftHolds([record], "plan", "share", { value: 100 }),
          "the Scale's value in the draft",
        );
        await eventually(() => promptArmed(board), "the prompt to be armed");
        await reloadBoard(board, run, () =>
          board.view
            .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
            .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS }),
        );
        await eventually(async () => (await value(board).textContent()) === "100", "100 again");
        expect(await board.view.getByRole("slider").first().getAttribute("aria-valuenow")).toBe(
          "100",
        );
        await eventually(() => promptArmed(board), "the prompt to be armed after the reload");
        expect(await answerOf(board, "plan").isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Ranking answered after a drag: fetch of the Ranking alone returns its order as result, and collect returns the answer with the order in results",
      async () => {
        const run = await start(lifecycleScenario(rankingAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await beginDrag(board, handleOf(board, "comfort"));
        await dragOver(board, rowOf(board, "speed"), HALF.top);
        await expectDrop(board, "speed", "before");
        await release(board);
        const order = ["comfort", "speed", "cost"];
        await eventually(
          async () => JSON.stringify(await orderShown(board)) === JSON.stringify(order),
          "the dragged order",
        );
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "priorities", { order }),
          "the draft to hold the order",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: "answer",
          itemId: "plan",
          results: { priorities: { order } },
        });
        const item = checkedFetchItem(await run.session.fetch("priorities"));
        expect(item).toMatchObject({
          type: "ranking",
          id: "priorities",
          questionId: "plan",
          state: "answered",
          result: { order },
        });
        await card(board, "plan")
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a reopened question holding an answered Scale: Start from my previous answer puts the Scale's value in the draft and sends nothing until Answer",
      async () => {
        const run = await start(lifecycleScenario(scaleAsk(SLIDER), dist));
        const board = await openBoard(run, ["plan"]);
        await setToMaximum(board);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "plan").getByText("sent", { exact: true }).waitFor();
        await actsDone(run, 1);
        await run.session.update([{ action: "reopen", itemId: "plan" }]);
        const reopened = card(board, "plan").locator('[data-askboard-notice="reopened"]');
        await reopened.getByText("Reopened by the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await value(board).textContent()) === "Not set",
          "the reopened Scale to show nothing set",
        );
        expect(draftHolds(sentDrafts(run), "plan", "share", undefined)).toBe(true);
        await reopened.getByRole("button", { name: "Start from my previous answer" }).click();
        await eventually(async () => (await value(board).textContent()) === "100", "100 again");
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "share", { value: 100 }),
          "the draft to hold the previous value",
        );
        expect(sentActs(run)).toHaveLength(1);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        const [, again] = await actsDone(run, 2);
        expect(again?.acts[0]).toMatchObject({
          type: "answer",
          itemId: "plan",
          rev: 2,
          results: { share: { value: 100 } },
        });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
