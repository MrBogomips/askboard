// An item that fails stops every act of its question, on the real board page and the session
// process, in each engine (document-review, tasks 6.21 and 6.24; Issue #103; spec view-and-widgets:
// The items follow the revision the card shows, "An item that fails stops every act of its
// question"; design decision 15, Appendix rows 40 and 44). In submitted delivery the user holds an
// answer for a question and for another; a widget item of the first then throws after the question
// counted as visible (a test-only TextField chunk, a button that throws once pressed): the card
// disables its "Answer", the failed question's held answer is released and its work stays in the
// draft, Submit sends the other question's answer alone, and, once the agent changes the failed
// question, its notice offers "Reload, losing my work", which shows the agent's revision.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/submit-failed-item-session.browser.ts

import { describe, expect, test } from "bun:test";
import { database, plain } from "./fixtures/lifecycle-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  barButton,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  optionOf,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild, withBreakingTextField } from "./harness/view-build.ts";

const dist = await withBreakingTextField(await readViewBuild());

// The Choice question `database` with a TextField `breaker`, and a plain question `cache`.
const [question] = [database()];
const ask = {
  askId: "failed-item-submit-t4u5",
  title: "A failing item",
  delivery: "submitted",
  items: [
    {
      ...question,
      props: {
        ...question.props,
        items: [{ type: "text-field", id: "breaker", props: { label: "Breaker" } }],
      },
    },
    plain("cache", "Should the order service cache reads?", "Cache"),
  ],
};

const held = async (board: Board, id: string, label: string) => {
  await optionOf(board, id, label).click({ timeout: STEP_TIMEOUT_MS });
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
  await eventually(
    async () => (await answerOf(board, id).getAttribute("aria-pressed")) === "true",
    `${id} held`,
  );
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an item that fails stops every act of its question, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a held answer whose question's item throws: Submit sends the other answer, the failed work stays in its draft, and Reload is offered",
      async () => {
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await held(board, "database", "SQLite");
        await held(board, "cache", "Yes");
        await mirrored(
          run,
          (record) =>
            record.questions.database?.held?.act === "answer" &&
            record.questions.cache?.held?.act === "answer",
          "both answers held",
        );
        expect(await barButton(board, "Submit").isDisabled()).toBe(false);
        await card(board, "database")
          .getByRole("button", { name: "Break breaker", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "database").getByRole("alert").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await answerOf(board, "database").count()).toBe(0);
        // The failed question's held answer is released, with its work kept; "cache" stays held.
        await eventually(async () => {
          const record = sentDrafts(run).at(-1)?.questions;
          return record?.database !== undefined && record.database.held === undefined;
        }, "the failed question's held answer to be released");
        const draft = sentDrafts(run).at(-1)?.questions;
        expect(JSON.stringify(draft?.database)).toContain("SQLite");
        expect(draft?.cache?.held?.act).toBe("answer");
        expect(await barButton(board, "Immediate").isDisabled()).toBe(false);
        await eventually(async () => !(await barButton(board, "Submit").isDisabled()), "Submit");
        await barButton(board, "Submit").click({ timeout: STEP_TIMEOUT_MS });
        const [command, ...rest] = await actsDone(run, 1);
        expect(rest).toEqual([]);
        expect(command?.acts.map((act) => `${act.type}:${act.itemId}`)).toEqual(["answer:cache"]);
        expect(JSON.stringify(sentDrafts(run).at(-1)?.questions.database)).toContain("SQLite");
        // The agent changes the failed question: its notice still offers Reload, losing my work.
        await run.session.update([
          {
            action: "change",
            itemId: "database",
            props: { ...question.props, text: "Which database, after all?" } as unknown,
          },
        ]);
        const notice = card(board, "database").locator('[data-askboard-notice="agent-change"]');
        await notice.waitFor({ timeout: STEP_TIMEOUT_MS });
        const reload = notice.getByRole("button", { name: "Reload, losing my work", exact: true });
        await eventually(() => reload.isEnabled(), "Reload to be enabled");
        await reload.click({ timeout: STEP_TIMEOUT_MS });
        await notice.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await card(board, "database")
          .getByText("Which database, after all?", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(sentActs(run).flatMap((each) => each.acts.map((act) => act.itemId))).toEqual([
          "cache",
        ]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
