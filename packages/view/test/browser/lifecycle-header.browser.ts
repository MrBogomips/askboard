// The header's second row, in each engine (ask-lifecycle, task 6.3; view spec: Counts and the
// next-open jump): a ready answer moves the open count and not the ask pill; the pill shows what
// the agent has received, "Partly answered n/m"; a question the agent adds is new, counted, and
// reached first by "Next open ↓"; and the header keeps two rows, row 1 holding the title until
// push-delivery's who-and-where row. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { flatTabsAsk, plain, submittedAsk } from "./fixtures/lifecycle-asks.ts";
import {
  eventually,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the header's counts`, () => {
    const { start } = useEngine(engine);

    test(
      "in submitted delivery, two ready answers drop the open count to 1, and the pill still shows Waiting",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, ["database", "cache", "audit"]);
        await board.header.getByText("3 open", { exact: true }).waitFor();
        await optionOf(board, "database", "SQLite").click();
        await answerOf(board, "database").click();
        await optionOf(board, "cache", "Yes").click();
        await answerOf(board, "cache").click();
        await board.header
          .getByText("1 open", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.header.getByText("Waiting", { exact: true }).count()).toBe(1);
        const outline = board.view.getByRole("navigation", { name: "Outline" });
        expect(await outline.getByText("Ready", { exact: true }).count()).toBe(2);
        expect(sentActs(run)).toEqual([]);
        // Row 1 holds the title; row 2 the pill and the counts.
        await board.header.getByRole("heading", { name: "Release checklist" }).waitFor();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answer the agent receives: Partly answered 1/4; a question the agent adds out of view counts as open, is New, and Next open reaches it first",
      async () => {
        const run = await start(lifecycleScenario(flatTabsAsk, dist));
        const board = await openBoard(run, ["one", "two", "three", "four"]);
        await optionOf(board, "one", "Yes").click();
        await answerOf(board, "one").click();
        await board.header
          .getByText("Partly answered 1/4", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByText("3 open", { exact: true }).waitFor();
        await run.session.update([
          {
            action: "add",
            item: plain("budget", "Is the budget approved?", "Budget"),
            after: "four",
          },
        ]);
        await board.header
          .getByText("4 open", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const outline = board.view.getByRole("navigation", { name: "Outline" });
        await outline.getByText("New", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByRole("button", { name: "Next open ↓" }).click();
        await eventually(
          () =>
            isFocused(
              card(board, "budget").getByRole("heading", { name: "Is the budget approved?" }),
            ),
          "focus on the new question's heading",
        );
        await outline
          .getByText("New", { exact: true })
          .waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await board.header.getByRole("button", { name: "Next open ↓" }).click();
        await eventually(
          () => isFocused(card(board, "two").getByRole("heading", { name: "Question two?" })),
          "focus on the next open question's heading, wrapping",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
