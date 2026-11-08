// An item that fails stops every act of its question, on the real board page and the session
// process, in each engine (document-review, task 6.21; Issue #103; spec view-and-widgets: The items
// follow the revision the card shows, "An item that fails stops every act of its question"; design
// decision 15, Appendix rows 40 and 44). In submitted delivery the user holds an answer for a
// question and for another; a widget item of the first then throws after the question counted as
// visible (a test-only TextField chunk, a button that throws once pressed): the card disables its
// "Answer", Submit is disabled and sends nothing, whatever it held for the question, and the other
// question's held answer stays held.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/submit-failed-item-session.browser.ts

import { describe, expect, test } from "bun:test";
import { database, plain } from "./fixtures/lifecycle-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  barButton,
  card,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentActs,
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
      "a held answer whose question's item throws: Submit is disabled and sends nothing, and the card offers no Answer",
      async () => {
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await held(board, "database", "SQLite");
        await held(board, "cache", "Yes");
        expect(await barButton(board, "Submit").isDisabled()).toBe(false);
        await card(board, "database")
          .getByRole("button", { name: "Break breaker", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "database").getByRole("alert").waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => barButton(board, "Submit").isDisabled(), "Submit to be disabled");
        expect(await answerOf(board, "database").count()).toBe(0);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
