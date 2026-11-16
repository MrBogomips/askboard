// Prefill recommended, in each engine (answering-flow-guidance, task 8.1; view-and-widgets spec:
// Select recommended, Undo of a prefill, Recommended option, Submit; D8; #168). At 1280x800, on the
// board of nine questions in three areas, four of which recommend an option (q1, q2, q5, q7): the
// button counts the questions it can fill and is absent at 0; it fills drafts only, in either
// delivery mode, never replaces a choice and sends nothing; "Undo" takes focus, clears what is
// still as filled and ends with the user's next edit; Submit sends only what the user confirmed.
// Controls are found by their hooks. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { answeringAsk, type Language } from "./fixtures/answering-flow-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  buttonOf,
  card,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { hostSettled } from "./harness/probes.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
const RECOMMENDED = ["q1", "q2", "q5", "q7"];

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  delivery: "immediate" | "submitted" = "submitted",
  language: Language = "en-US",
) => {
  const run = await start(lifecycleScenario(answeringAsk("sections", language, delivery), dist));
  return { run, board: await openBoard(run, ALL) };
};

const undoOf = (board: Board): Locator => board.view.locator("[data-askboard-undo]");
const resultOf = (board: Board): Locator => board.view.locator("[data-askboard-prefilled]");
const stateOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-state]");
const text = async (locator: Locator): Promise<string> =>
  ((await locator.textContent({ timeout: STEP_TIMEOUT_MS })) ?? "").trim();
const regionText = async (board: Board): Promise<string> =>
  (await board.status.textContent({ timeout: STEP_TIMEOUT_MS })) ?? "";

/** Whether each question holds the "Yes" selection. */
const picked = async (board: Board, ids: readonly string[]): Promise<boolean[]> =>
  Promise.all(ids.map((id) => optionOf(board, id, "Yes").isChecked()));

const prefilled = async (board: Board): Promise<void> => {
  await board.prefill.click({ timeout: STEP_TIMEOUT_MS });
  await resultOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: prefill recommended`, () => {
    const { start } = useEngine(engine);

    for (const delivery of ["submitted", "immediate"] as const) {
      test(
        `${delivery === "submitted" ? "All together" : "One by one"}: the drafts are filled, nothing is ready or sent, the count is in the label and the button goes at 0`,
        async () => {
          const { run, board } = await open(start, delivery);
          expect(await text(board.prefill)).toBe("Prefill recommended (4)");
          await prefilled(board);
          expect(await picked(board, RECOMMENDED)).toEqual([true, true, true, true]);
          for (const id of RECOMMENDED) {
            expect(await text(stateOf(board, id))).toContain("Draft");
          }
          expect(await text(resultOf(board))).toBe("4 questions prefilled. Nothing was sent.");
          expect(await board.prefill.count()).toBe(0);
          if (delivery === "submitted") expect(await board.submit.isDisabled()).toBe(true);
          await hostSettled(board);
          expect(sentActs(run)).toEqual([]);
          expectNoCspProblem(run);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "the result line has Undo, which takes focus",
      async () => {
        const { board } = await open(start);
        await prefilled(board);
        await eventually(() => isFocused(undoOf(board)), "focus on Undo");
        expect(await text(undoOf(board))).toBe("Undo");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Undo restores the drafts, says so and focuses Prefill recommended (4)",
      async () => {
        const { run, board } = await open(start);
        await prefilled(board);
        await undoOf(board).click({ timeout: STEP_TIMEOUT_MS });
        expect(await picked(board, RECOMMENDED)).toEqual([false, false, false, false]);
        await eventually(async () => (await regionText(board)) === "Prefill undone.", "the region");
        await eventually(() => isFocused(board.prefill), "focus on the prefill button");
        expect(await text(board.prefill)).toBe("Prefill recommended (4)");
        expect(await resultOf(board).count()).toBe(0);
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an edit ends the undo: the selections stay as they are",
      async () => {
        const { board } = await open(start);
        await prefilled(board);
        await optionOf(board, "q2", "No").check({ timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await undoOf(board).count()) === 0, "Undo gone");
        expect(await picked(board, ["q1", "q2", "q5", "q7"])).toEqual([true, false, true, true]);
        expect(await optionOf(board, "q2", "No").isChecked()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a choice is never replaced: the question keeps the user's pick and the others take theirs",
      async () => {
        const { run, board } = await open(start);
        await optionOf(board, "q1", "No").check({ timeout: STEP_TIMEOUT_MS });
        expect(await text(board.prefill)).toBe("Prefill recommended (3)");
        await prefilled(board);
        expect(await optionOf(board, "q1", "No").isChecked()).toBe(true);
        expect(await picked(board, ["q2", "q5", "q7"])).toEqual([true, true, true]);
        expect(await text(resultOf(board))).toBe("3 questions prefilled. Nothing was sent.");
        await hostSettled(board);
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Send 1 answer after one confirm sends only it; the other prefilled drafts stay drafts",
      async () => {
        const { run, board } = await open(start, "submitted");
        await prefilled(board);
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await text(board.submit)) === "Send 1 answer",
          "Send reading Send 1 answer",
        );
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        const [command] = await actsSent(run, 1);
        expect(command?.acts).toEqual([
          { type: "answer", itemId: "q1", rev: 1, choice: ["Yes"], when: expect.any(String) },
        ]);
        for (const id of ["q2", "q5", "q7"]) {
          expect(await optionOf(board, id, "Yes").isChecked()).toBe(true);
          expect(await text(stateOf(board, id))).toContain("Draft");
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Accept recommended is on the option's row and goes once the question is answered, ready or declined",
      async () => {
        const { board } = await open(start, "submitted");
        const accept = (id: string) => buttonOf(board, id, "Accept recommended");
        for (const id of RECOMMENDED) expect(await accept(id).count()).toBe(1);
        await accept("q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await accept("q1").count()) === 0, "q1 ready, no accept");
        expect(await accept("q2").count()).toBe(1);
        expect(await accept("q3").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the label is Italian in an it-IT board",
      async () => {
        const { board } = await open(start, "submitted", "it-IT");
        expect(await text(board.prefill)).toBe("Precompila le consigliate (4)");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
