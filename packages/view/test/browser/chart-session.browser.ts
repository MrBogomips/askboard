// The Chart answered, held and fetched on the real board page, in each engine (chart-widget, task
// 6.1; spec view-and-widgets: A Chart's result end to end, A Chart's highlights as its result,
// scenario "Removed by the agent"; core spec: Chart results through ask-core): two points
// highlighted and answered come back from `collect` under `results`, the event validating, and
// from `fetch` of the item as its `result`; a held highlight is restored after a reload with the
// leave-page prompt armed and nothing sent; the agent's `update` removing a highlighted category
// leaves "Keep mine" dropping that point. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { BAR_PROPS, CHART_ID, chartAsk } from "./fixtures/chart-documents.ts";
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
import { type BarRig, clickBar, counterIs, ringOfBar } from "./harness/chart-steps.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  actTypes,
  answerOf,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  promptArmed,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

// BAR_PROPS: fix-a, fix-b, fix-c; fails [4, 9, 2], reruns [1, 3, null]; the axis ends at 10.
const THREE: BarRig = {
  layout: { categories: 3, series: 2, axisMax: 10 },
  values: [
    [4, 9, 2],
    [1, 3, null],
  ],
};
// The same chart once the agent has removed fix-c.
const TWO: BarRig = {
  layout: { categories: 2, series: 2, axisMax: 10 },
  values: [
    [4, 9],
    [1, 3],
  ],
};
const FIX_A = { series: "fails", category: "fix-a" };
const FIX_C = { series: "fails", category: "fix-c" };
const WITHOUT_C = {
  ...BAR_PROPS,
  categories: BAR_PROPS.categories.slice(0, 2),
  series: BAR_PROPS.series.map((series) => ({ ...series, values: series.values.slice(0, 2) })),
};

// Highlights fails in fix-c, then in fix-a (the result lists fix-a first all the same).
const highlightTwo = async (board: Board): Promise<void> => {
  await clickBar(board, THREE, 0, 2);
  await counterIs(board, "1 point highlighted");
  await clickBar(board, THREE, 0, 0);
  await counterIs(board, "2 points highlighted");
};

const whenLoaded = (board: Board) =>
  board.view
    .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
    .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Chart held, answered and fetched`, () => {
    const { start } = useEngine(engine);

    test(
      "two highlighted points answered: collect returns them under results, the event validating, and fetch of the item returns them as its result",
      async () => {
        const run = await start(lifecycleScenario(chartAsk(BAR_PROPS), dist));
        const board = await openBoard(run, ["plan"]);
        await highlightTwo(board);
        const points = [FIX_A, FIX_C];
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", CHART_ID, { points }),
          "the draft to hold both points",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: "plan" });
        expect(events[0]?.results).toEqual({ [CHART_ID]: { points } });
        const item = checkedFetchItem(await run.session.fetch(CHART_ID));
        expect(item).toMatchObject({
          type: "chart",
          id: CHART_ID,
          questionId: "plan",
          state: "answered",
          result: { points },
        });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        // The answered chart keeps both rings.
        expect(await ringOfBar(board, THREE, 0, 0)).toBe(true);
        expect(await ringOfBar(board, THREE, 0, 2)).toBe(true);
        expect(await ringOfBar(board, THREE, 0, 1)).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a held highlight survives a reload of the tab, with the leave-page prompt armed and nothing sent",
      async () => {
        const run = await start(lifecycleScenario(chartAsk(BAR_PROPS), dist));
        const board = await openBoard(run, ["plan"]);
        expect(await promptArmed(board)).toBe(false);
        await highlightTwo(board);
        await mirrored(
          run,
          (record) => draftHolds([record], "plan", CHART_ID, { points: [FIX_A, FIX_C] }),
          "the points in the draft",
        );
        await eventually(() => promptArmed(board), "the prompt to be armed");
        await reloadBoard(board, run, () => whenLoaded(board));
        await counterIs(board, "2 points highlighted");
        await eventually(() => ringOfBar(board, THREE, 0, 0), "the ring on fix-a again");
        expect(await ringOfBar(board, THREE, 0, 2)).toBe(true);
        expect(await ringOfBar(board, THREE, 0, 1)).toBe(false);
        await eventually(() => promptArmed(board), "the prompt to be armed after the reload");
        expect(await answerOf(board, "plan").isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    // fix-c highlighted alone, then the agent's change removing fix-c.
    const heldThenRemoved = async (run: Awaited<ReturnType<typeof start>>) => {
      const board = await openBoard(run, ["plan"]);
      await clickBar(board, THREE, 0, 2);
      await counterIs(board, "1 point highlighted");
      await mirrored(
        run,
        (record) => draftHolds([record], "plan", CHART_ID, { points: [FIX_C] }),
        "the point in the draft",
      );
      await run.session.update([{ action: "change", itemId: CHART_ID, props: WITHOUT_C }]);
      return board;
    };
    const changeNotice = (board: Board) =>
      card(board, "plan").locator('[data-askboard-notice="agent-change"]');

    test(
      "the agent removes the highlighted category: after a reload Keep mine drops the point the page now refuses, the counter reads none and Answer stays disabled",
      async () => {
        const run = await start(lifecycleScenario(chartAsk(BAR_PROPS), dist));
        const board = await heldThenRemoved(run);
        await reloadBoard(board, run, () => whenLoaded(board));
        await changeNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await changeNotice(board).getByRole("button", { name: "Keep mine" }).click();
        await changeNotice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await counterIs(board, "No points highlighted");
        await eventually(
          () => draftHolds(sentDrafts(run).slice(-1), "plan", CHART_ID, undefined),
          "the draft to hold no result",
        );
        expect(await ringOfBar(board, TWO, 0, 0)).toBe(false);
        expect(await ringOfBar(board, TWO, 0, 1)).toBe(false);
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        // Keep mine sends its own act, which answers nothing.
        expect(actTypes(run)).toEqual([["edit-choice"]]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent removes the highlighted category, on the page that saw the earlier revision: Keep mine keeps the point, which the revision it was made on accepts, and the answer names that revision",
      async () => {
        const run = await start(lifecycleScenario(chartAsk(BAR_PROPS), dist));
        const board = await heldThenRemoved(run);
        await changeNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await changeNotice(board).getByRole("button", { name: "Keep mine" }).click();
        await changeNotice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await counterIs(board, "1 point highlighted");
        expect(draftHolds(sentDrafts(run), "plan", CHART_ID, { points: [FIX_C] })).toBe(true);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.at(-1)).toMatchObject({
          type: "answer",
          rev: 1,
          results: { [CHART_ID]: { points: [FIX_C] } },
        });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
