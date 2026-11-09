// The result widgets held, restored and fetched on the real board page, in each engine
// (approval-scale-ranking, task 6.2; spec view-and-widgets: A widget result end to end, A revision
// keeps the widgets' results; core spec: Results of the shipped result widgets): a Scale value set
// and the tab reloaded shows the value with the leave-page prompt armed and nothing sent; a
// Ranking answered after a drag is returned by `fetch` of the Ranking alone as its `result` and by
// `collect` in the answer's `results`, both validated against their schemas; and a reopened
// question's "Start from my previous answer" puts the Scale's value in the draft. Every scenario
// runs on the session process.

import { describe, expect, test } from "bun:test";
import { RANKING_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { VERDICT } from "./fixtures/approval-asks.ts";
import { rankingAsk } from "./fixtures/ranking-documents.ts";
import { scaleAsk } from "./fixtures/scale-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { checkedEvents, checkedFetchItem, decisionOf } from "./harness/approval-board.ts";
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

// The question `plan` holding a Ranking, a Scale and an Approval, as the agent sends them.
const threeAsk = {
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: {
        ...plan.props,
        items: [RANKING_FIXTURE_ITEM, { type: "scale", id: "share", props: SLIDER }, VERDICT],
      },
    },
  ],
} as const;
const RISK = { id: "risk", label: "Risk" };
const ranked = (board: Board, name: string) =>
  board.view
    .getByRole("toolbar", { name: /Ranking tools/ })
    .getByRole("button", { name, exact: true });
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
      "a reopened and changed question holding an answered Scale: Start from my previous answer puts the Scale's value in the draft and sends nothing until Answer",
      async () => {
        const run = await start(lifecycleScenario(scaleAsk(SLIDER), dist));
        const board = await openBoard(run, ["plan"]);
        await setToMaximum(board);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "plan").getByText("sent", { exact: true }).waitFor();
        await actsDone(run, 1);
        // Reopened with the Scale's step changed in the same update: the question changed, so it
        // starts from the agent's version, and 100 still fits (reopen-start-from-answer, decision 3).
        await run.session.update([
          { action: "reopen", itemId: "plan" },
          { action: "change", itemId: "share", props: { ...SLIDER, step: 1 } },
        ]);
        const reopened = card(board, "plan").locator('[data-askboard-notice="reopened"]');
        await reopened.getByText("Reopened by the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await value(board).textContent()) === "Not set",
          "the reopened Scale to show nothing set",
        );
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "share", undefined),
          "the draft to hold no value for the reopened Scale",
        );
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
          rev: 3,
          results: { share: { value: 100 } },
        });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent reopens an answered Ranking, Scale and Approval and changes the Ranking and the Scale: Start from my previous answer puts back the decision alone, and Answer sends nothing the board host refuses",
      async () => {
        const run = await start(lifecycleScenario(threeAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await ranked(board, "Keep this order").click();
        await setToMaximum(board);
        await decisionOf(board, "plan", "Approve").click();
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "plan").getByText("sent", { exact: true }).waitFor();
        await actsDone(run, 1);
        await run.session.update([
          { action: "reopen", itemId: "plan" },
          {
            action: "change",
            itemId: "priorities",
            props: { items: [...RANKING_FIXTURE_ITEM.props.items, RISK] },
          },
          { action: "change", itemId: "share", props: { ...SLIDER, range: true } },
        ]);
        const reopened = card(board, "plan").locator('[data-askboard-notice="reopened"]');
        await reopened.getByText("Reopened by the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await reopened.getByRole("button", { name: "Start from my previous answer" }).click();
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "verdict", { decision: "approve" }),
          "the draft to hold the decision",
        );
        expect(draftHolds(sentDrafts(run), "plan", "priorities", undefined)).toBe(true);
        expect(draftHolds(sentDrafts(run), "plan", "share", undefined)).toBe(true);
        expect(
          ((await board.view.locator("[data-ranking-counter]").textContent()) ?? "").trim(),
        ).toBe("No changes");
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
        expect(await value(board).first().textContent()).toBe("Not set");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(2);
        expect(events[1]).toMatchObject({ type: "answer", itemId: "plan", rev: 4 });
        expect(events[1]?.results).toEqual({ verdict: { decision: "approve" } });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent reopens an answered Ranking, Scale and Approval and gives each ID another type: Start from my previous answer puts back no result, and Answer stays disabled",
      async () => {
        const run = await start(lifecycleScenario(threeAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await ranked(board, "Keep this order").click();
        await setToMaximum(board);
        await decisionOf(board, "plan", "Approve").click();
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "plan").getByText("sent", { exact: true }).waitFor();
        await actsDone(run, 1);
        // Each ID keeps its place and takes the next type: the Ranking's is now a Scale, the
        // Scale's an Approval, the Approval's a Ranking, so each holds another type's result.
        await run.session.update([
          { action: "reopen", itemId: "plan" },
          {
            action: "change",
            itemId: "plan",
            props: {
              ...threeAsk.items[0].props,
              items: [
                { type: "scale", id: RANKING_FIXTURE_ITEM.id, props: SLIDER },
                { type: "approval", id: "share", props: {} },
                { ...RANKING_FIXTURE_ITEM, id: "verdict" },
              ],
            },
          },
        ]);
        const reopened = card(board, "plan").locator('[data-askboard-notice="reopened"]');
        await reopened.getByText("Reopened by the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await reopened.getByRole("button", { name: "Start from my previous answer" }).click();
        await Bun.sleep(QUIET_MS);
        for (const id of [RANKING_FIXTURE_ITEM.id, "share", "verdict"]) {
          expect(draftHolds(sentDrafts(run), "plan", id, undefined), id).toBe(true);
        }
        expect(await value(board).first().textContent()).toBe("Not set");
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        expect(sentActs(run)).toHaveLength(1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    // A held Scale value, 100 of 100, and the agent's change of its `max` to 50.
    const heldThenLowered = async (run: Awaited<ReturnType<typeof start>>) => {
      const board = await openBoard(run, ["plan"]);
      await setToMaximum(board);
      await mirrored(
        run,
        (record) => draftHolds([record], "plan", "share", { value: 100 }),
        "the Scale's value in the draft",
      );
      await run.session.update([
        { action: "change", itemId: "share", props: { ...SLIDER, max: 50 } },
      ]);
      return board;
    };
    const changeNotice = (board: Board) =>
      card(board, "plan").locator('[data-askboard-notice="agent-change"]');

    test(
      "a held Scale value across the agent lowering its max: after a reload Keep mine drops the value the page now refuses and the Scale shows unset",
      async () => {
        const run = await start(lifecycleScenario(scaleAsk(SLIDER), dist));
        const board = await heldThenLowered(run);
        await reloadBoard(board, run, () =>
          board.view
            .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
            .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS }),
        );
        await changeNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await changeNotice(board).getByRole("button", { name: "Keep mine" }).click();
        await changeNotice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await value(board).first().textContent()) === "Not set",
          "the Scale to show nothing set",
        );
        await eventually(
          () => draftHolds(sentDrafts(run).slice(-1), "plan", "share", undefined),
          "the draft to hold no result",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a held Scale value across the agent lowering its max, on the page that saw the earlier revision: Keep mine keeps the value, which the revision it was made on accepts, and the answer names that revision",
      async () => {
        const run = await start(lifecycleScenario(scaleAsk(SLIDER), dist));
        const board = await heldThenLowered(run);
        await changeNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await changeNotice(board).getByRole("button", { name: "Keep mine" }).click();
        await changeNotice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await value(board).first().textContent()).toBe("100");
        expect(draftHolds(sentDrafts(run), "plan", "share", { value: 100 })).toBe(true);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.at(-1)).toMatchObject({
          type: "answer",
          rev: 1,
          results: { share: { value: 100 } },
        });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
