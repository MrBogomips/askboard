// The atoms on the real board page and the session process, in each engine (atoms, task 6.1;
// view-and-widgets spec: Atoms end to end, An entry blocks Answer, Markdown links in the view, The
// board page opens Markdown links; core spec: Answers of atoms): a question of input atoms answered
// and `collect` returning the `results` map by item ID, `fetch` of one atom returning its result, an
// entry that disables "Answer" across a reload, and a Markdown link opening through the board
// page's `window.open` (stubbed here) with no opener and no referrer, sending the agent nothing.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/atoms-session.browser.ts

import { describe, expect, test } from "bun:test";
import { atomAsk, MARKDOWN_SOURCE } from "./fixtures/atom-documents.ts";
import { checkedEvents, checkedFetchItem } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const INTRO = { type: "text", id: "intro", props: { text: MARKDOWN_SOURCE, format: "markdown" } };
const NAME = { type: "text-field", id: "name", props: { label: "Name", maxLength: 40 } };
const NOTIFY = { type: "toggle", id: "notify", props: { label: "Notify me" } };
const DAYS = {
  type: "number-field",
  id: "days",
  props: { label: "Days", min: 0, max: 20, step: 0.5 },
};
const START = { type: "date-field", id: "start", props: { label: "Start" } };
const FEE = { type: "money-field", id: "fee", props: { label: "Fee", currency: "EUR", min: "0" } };
const ALL = [INTRO, NAME, NOTIFY, DAYS, START, FEE];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: atoms on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a question of input atoms is answered: collect returns one answer whose results hold each value by item ID, and fetch of one atom returns its result",
      async () => {
        const run = await start(lifecycleScenario(atomAsk(ALL), dist));
        const board = await openBoard(run, ["plan"]);
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await board.view.getByLabel("Name", { exact: true }).fill("Ada");
        await board.view.getByRole("switch", { name: "Notify me" }).click();
        await board.view.getByLabel("Days", { exact: true }).fill("3.5");
        await board.view.getByLabel("Start", { exact: true }).fill("3/2/2026");
        await board.view.getByLabel("Fee", { exact: true }).fill("1234.50");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(sentActs(run)).toEqual([]);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: "plan" });
        expect(events[0]?.results).toEqual({
          name: "Ada",
          notify: true,
          days: 3.5,
          start: "2026-03-02",
          fee: { amount: "1234.50", currency: "EUR" },
        });
        // The display atom holds no result.
        expect(events[0]?.results).not.toHaveProperty("intro");
        const item = checkedFetchItem(await run.session.fetch("days"));
        expect(item).toMatchObject({
          type: "number-field",
          id: "days",
          questionId: "plan",
          state: "answered",
          result: 3.5,
        });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an entry that is no value disables Answer across a reload and sends nothing; correcting it enables Answer",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([NAME, DAYS]), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Name", { exact: true }).fill("Ada");
        await board.view.getByLabel("Days", { exact: true }).fill("abc");
        await eventually(
          () => sentDrafts(run).some((record) => JSON.stringify(record).includes('"days":"abc"')),
          "the entry mirrored to the board page",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await reloadBoard(board, run, () =>
          board.view.getByLabel("Days", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS }),
        );
        const days = board.view.getByLabel("Days", { exact: true });
        await eventually(async () => (await days.inputValue()) === "abc", "the entry restored");
        expect(await board.view.getByLabel("Name", { exact: true }).inputValue()).toBe("Ada");
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await days.fill("2");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click on a Markdown link calls the board page's window.open once with _blank and noopener, noreferrer, and sends the agent nothing",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([INTRO, NAME]), dist));
        const board = await openBoard(run, ["plan"]);
        await board.page.evaluate(() => {
          const calls: unknown[][] = [];
          (window as unknown as { __opened: unknown[][] }).__opened = calls;
          window.open = ((...args: unknown[]) => {
            calls.push(args);
            return null;
          }) as typeof window.open;
        });
        const pages = run.browser.context.pages().length;
        await board.view.getByRole("link", { name: "docs" }).click();
        await eventually(
          async () =>
            (await board.page.evaluate(
              () => (window as unknown as { __opened: unknown[][] }).__opened.length,
            )) === 1,
          "the stubbed window.open call",
        );
        expect(
          await board.page.evaluate(
            () => (window as unknown as { __opened: unknown[][] }).__opened,
          ),
        ).toEqual([["https://example.com/docs", "_blank", "noopener,noreferrer"]]);
        expect(run.browser.context.pages().length).toBe(pages);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
