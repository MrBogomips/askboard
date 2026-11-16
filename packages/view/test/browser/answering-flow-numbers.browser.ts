// The short question numbers in the browser (answering-flow-visual, task 7.1; view-and-widgets spec:
// Short question numbers, Draft mirror and restore "Numbers alone are not unsent work", Status
// messages for the answering flow "The question in view removed"). At 1280x800, with the board of
// nine questions: an addition takes the next number, a removal keeps the others and shows in the
// outline, a reload keeps them, the footer names the number, the single-question board shows none
// and numbers alone arm no leave-page prompt. A Snapshot's no-numbers case is in
// `snapshot-view.browser.ts`. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { answeringAsk, singleAnsweringAsk } from "./fixtures/answering-flow-asks.ts";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  optionOf,
  promptArmed,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
const STAY = { user: { version: "1.0", afterAnswer: "stay" } };

const staging = {
  type: "question",
  id: "staging",
  props: {
    text: "Is staging ready?",
    header: "Staging",
    options: [{ label: "Yes" }, { label: "No" }],
  },
};
const rollback = {
  type: "question",
  id: "rollback",
  props: {
    text: "Is the rollback ready?",
    header: "Rollback",
    options: [{ label: "Yes" }, { label: "No" }],
  },
};

/** The number each card shows, by question ID. */
const numbersOf = (board: Board, ids: readonly string[]): Promise<(string | null)[]> =>
  Promise.all(
    ids.map(async (id) => {
      const number = card(board, id).locator("[data-askboard-number]");
      return (await number.count()) === 0 ? null : await number.first().textContent();
    }),
  );

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the short question numbers`, () => {
    const { start } = useEngine(engine);

    test(
      "the cards show Q1 to Q9 in board order; the agent adds Staging after Q6 and it reads Q10, the others keep theirs",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist));
        const board = await openBoard(run, ALL);
        expect(await numbersOf(board, ALL)).toEqual(ALL.map((_, at) => `Q${at + 1}`));
        await run.session.update([{ action: "add", item: staging, parentId: "data", after: "q6" }]);
        await eventually(
          async () => (await numbersOf(board, ["staging"]))[0] === "Q10",
          "Staging reading Q10",
        );
        expect(await numbersOf(board, ALL)).toEqual(ALL.map((_, at) => `Q${at + 1}`));
        // The strip and the outline carry the numbers too.
        expect(await board.strip("staging").getAttribute("aria-label")).toContain("Q10");
        expect(
          await board.view.locator('[data-askboard-outline="staging"]').textContent(),
        ).toContain("Q10");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent removes Q3: the others keep their numbers, and the outline shows 'Q3 removed by the agent' where it was",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist));
        const board = await openBoard(run, ALL);
        await run.session.update([{ action: "delete", itemId: "q3" }]);
        await board.view
          .locator('[data-askboard-outline-removed="3"]')
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.view.locator('[data-askboard-outline-removed="3"]').textContent()).toBe(
          "Q3 removed by the agent",
        );
        const rest = ALL.filter((id) => id !== "q3");
        expect(await numbersOf(board, rest)).toEqual(rest.map((id) => `Q${Number(id.slice(1))}`));
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a reload keeps every number, and a question the agent added meanwhile takes the next never given",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist));
        const board = await openBoard(run, ALL);
        await run.session.update([{ action: "add", item: staging, parentId: "data", after: "q6" }]);
        await eventually(
          async () => (await numbersOf(board, ["staging"]))[0] === "Q10",
          "Staging reading Q10",
        );
        await run.session.update([{ action: "delete", itemId: "q3" }]);
        await mirrored(
          run,
          (record) => record.nextNumber === 11 && record.numbers?.q3 === undefined,
          "the numbers after the addition and the removal",
        );
        // The agent adds Rollback while the tab is going away.
        await run.session.update([
          { action: "add", item: rollback, parentId: "release", after: "q9" },
        ]);
        await board.page.reload();
        await board.view
          .locator('[data-askboard-question="rollback"]:not([aria-busy="true"])')
          .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS });
        const kept = ALL.filter((id) => id !== "q3");
        expect(await numbersOf(board, kept)).toEqual(kept.map((id) => `Q${Number(id.slice(1))}`));
        expect(await numbersOf(board, ["staging", "rollback"])).toEqual(["Q10", "Q11"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with Stay here, sending the first question while Cache is to do: the footer reads 'Sent · Next: Cache Q2'",
      async () => {
        const run = await start({ ...lifecycleScenario(twoAsk, dist), config: STAY });
        const board = await openBoard(run, ["database", "cache"]);
        await optionOf(board, "database", "SQLite").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "database").click({ timeout: STEP_TIMEOUT_MS });
        const footer = card(board, "database").locator("[data-askboard-footer]");
        await footer.waitFor({ timeout: STEP_TIMEOUT_MS });
        const read = async () =>
          ((await footer.textContent()) ?? "")
            .replace(/\s+/g, " ")
            .replace(/Edit.*/, "")
            .trim();
        expect(await read()).toBe("Sent · Next: Cache Q2");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a single-question board shows no number, and numbers alone arm no leave-page prompt",
      async () => {
        const single = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const alone = await openBoard(single, ["only"]);
        expect(await alone.view.locator("[data-askboard-number]").count()).toBe(0);
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist));
        const board = await openBoard(run, ALL);
        await mirrored(run, (record) => record.numbers !== undefined, "the numbers");
        expect(await promptArmed(board)).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the question in view removed: the status region names it by title",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist));
        const board = await openBoard(run, ALL);
        await card(board, "q2").getByRole("radio").first().focus();
        await run.session.update([{ action: "delete", itemId: "q2" }]);
        await eventually(
          async () =>
            ((await board.status.textContent()) ?? "").includes(
              "Question removed by the agent: Q2.",
            ),
          "the region naming the removed question",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
