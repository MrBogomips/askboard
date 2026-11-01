// The board page of the ask lifecycle, in each engine (ask-lifecycle, task 6.1; view spec: Draft
// mirror and restore, Leave-page prompt, Board banners): a reload and a takeover keep a ready
// answer, a chosen option and a note, and the question in view; an act sent across a drop lands
// once, under one action ID;
// the leave-page prompt is armed and disarmed; and the agent closing an ask with unsent work locks
// the board with the Closed banner, whose copy puts the work on the clipboard as text. Every
// scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { onePerViewAsk, submittedAsk, twoAsk } from "./fixtures/lifecycle-asks.ts";
import {
  enabledCount,
  eventually,
  expectNoCspProblem,
  RECONNECT_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  card,
  lifecycleScenario,
  mirrored,
  noteOf,
  openBoard,
  optionOf,
  promptArmed,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const QUESTIONS = ["database", "cache", "audit"];

// Submitted delivery: SQLite marked ready on the database question, a note on the cache question.
const work = async (board: Board) => {
  await optionOf(board, "database", "SQLite").click({ timeout: STEP_TIMEOUT_MS });
  await answerOf(board, "database").click({ timeout: STEP_TIMEOUT_MS });
  expect(await answerOf(board, "database").getAttribute("aria-pressed")).toBe("true");
  await noteOf(board, "cache").fill("Only for the catalogue.");
};

// The work is back: the ready answer, its option and the note, and nothing went to the agent.
const expectWork = async (board: Board) => {
  await eventually(
    async () => (await noteOf(board, "cache").inputValue()) === "Only for the catalogue.",
    "the note to come back",
  );
  expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
  expect(await answerOf(board, "database").getAttribute("aria-pressed")).toBe("true");
  await board.header.getByText("Waiting", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
};

const hasWork = (record: { questions: Record<string, { note?: string; held?: unknown }> }) =>
  record.questions.cache?.note === "Only for the catalogue." &&
  record.questions.database?.held !== undefined;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the lifecycle board page`, () => {
    const { start } = useEngine(engine);

    test(
      "a reload keeps the ready answer and the note, in submitted delivery, and nothing was sent",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        await work(board);
        await mirrored(run, hasWork, "the ready answer and the note");
        await board.page.reload();
        await openBoardAgain(board);
        await expectWork(board);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a takeover keeps the ready answer and the note: the older tab sends its last draft at once",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const first = await openBoard(run, QUESTIONS);
        await work(first);
        const second = await openBoard(run, QUESTIONS);
        await first.banner(/moved/i).first().waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectWork(second);
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the question in view comes back after a reload and after a takeover, and nothing was sent",
      async () => {
        const run = await start(lifecycleScenario(onePerViewAsk, dist));
        const ids = ["q1", "q2", "q3", "q4", "q5"];
        const first = await openBoard(run, ids);
        await navigatorOf(first).getByRole("button", { name: "Next", exact: true }).click();
        await navigatorOf(first).getByRole("button", { name: "Next", exact: true }).click();
        await inView(first, "Question 3 of 5", "q3");
        await mirrored(run, (record) => record.inView === "q3", "the question in view");
        await first.page.reload();
        await openBoardAgain(first, ids);
        await inView(first, "Question 3 of 5", "q3");
        const second = await openBoard(run, ids);
        await first.banner(/moved/i).first().waitFor({ timeout: STEP_TIMEOUT_MS });
        await inView(second, "Question 3 of 5", "q3");
        expect(sentActs(run)).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answer given across a drop is sent under one action ID and lands once",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await optionOf(board, "database", "SQLite").click();
        await answerOf(board, "database").click();
        await run.session.drop();
        await optionOf(board, "cache", "Yes").click();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "cache").click();
        await card(board, "cache").getByText("not sent yet", { exact: true }).waitFor();
        await run.session.restore();
        await card(board, "cache")
          .getByText("sent", { exact: true })
          .waitFor({ timeout: RECONNECT_TIMEOUT_MS });
        await board.header
          .getByText("Answered", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const byItem = new Map<string, Set<string>>();
        for (const { actionId, acts } of sentActs(run)) {
          for (const act of acts)
            byItem.set(act.itemId, (byItem.get(act.itemId) ?? new Set()).add(actionId));
        }
        expect([...byItem.values()].map((ids) => ids.size)).toEqual([1, 1]);
        const { events } = await run.session.collect();
        expect(
          events.filter((event) => event.type === "answer").map((event) => event.itemId),
        ).toEqual(["database", "cache"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the leave-page prompt is armed while unsent work is held, and disarmed once it is sent",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        expect(await promptArmed(board)).toBe(false);
        await noteOf(board, "cache").fill("Later.");
        await eventually(() => promptArmed(board), "the prompt to be armed");
        await answerOf(board, "cache").click();
        await eventually(async () => !(await promptArmed(board)), "the prompt to be disarmed");
        if (engine === "chromium") {
          await noteOf(board, "database").fill("Unsent.");
          await eventually(() => promptArmed(board), "the prompt to be armed again");
          const dialog = board.page.waitForEvent("dialog", { timeout: STEP_TIMEOUT_MS });
          await board.page.close({ runBeforeUnload: true });
          const shown = await dialog;
          expect(shown.type()).toBe("beforeunload");
          await shown.dismiss();
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent closes the ask with a note typed: the Closed banner takes the focus, the board locks, and the copy puts the note on the clipboard as text",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await noteOf(board, "cache").fill("Cache only the catalogue.");
        await mirrored(
          run,
          (record) => record.questions.cache?.note === "Cache only the catalogue.",
          "the note",
        );
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.banner("Your unsent work was not sent").waitFor();
        await eventually(
          async () =>
            ((await board.page.evaluate(() => document.activeElement?.textContent ?? "")) as string)
              .toLowerCase()
              .includes("closed"),
          "the focus on the Closed banner",
        );
        await board.header.getByText("Closed", { exact: true }).waitFor();
        expect(await enabledCount(board.view.getByRole("radio"))).toBe(0);
        expect(await noteOf(board, "cache").inputValue()).toBe("Cache only the catalogue.");
        await board.page.getByRole("button", { name: "Copy my unsent work" }).click();
        await eventually(() => run.browser.clipboard.length > 0, "the copy");
        expect(run.browser.clipboard[0]).toContain("Note for the agent: Cache only the catalogue.");
        expect(run.browser.clipboard[0]).toContain("Should the order service cache reads?");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// One question per view's navigator.
const navigatorOf = (board: Board) =>
  board.view.getByRole("navigation", { name: "Question navigator" });

// The navigator names the question in view, and its card is the one shown.
const inView = async (board: Board, position: string, id: string) => {
  await navigatorOf(board)
    .getByText(position, { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  await card(board, id).waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
};

// After a reload the same tab shows the board again.
const openBoardAgain = async (board: Board, ids: readonly string[] = QUESTIONS) => {
  for (const id of ids) {
    await board.view
      .locator(`[data-askboard-question="${id}"]:not([aria-busy="true"])`)
      .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS * 2 });
  }
};
