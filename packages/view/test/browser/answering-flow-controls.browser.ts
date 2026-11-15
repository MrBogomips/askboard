// The bar's helper, the one next-open control and the visible reason, in each engine
// (answering-flow-fixes, task 5.1; view-and-widgets spec: Delivery mode, One question per view,
// Counts and the next-open jump, Answer names the field to fix; #183, #184, #185). At 1280x800.
// Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import {
  answeringAsk,
  type Language,
  type Presentation,
  singleAnsweringAsk,
} from "./fixtures/answering-flow-asks.ts";
import { onePerViewAsk } from "./fixtures/lifecycle-asks.ts";
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
  answerOf,
  barButton,
  buttonOf,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
  postponeOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ALL,
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};
const HELPER: Record<Language, { submitted: string; immediate: string }> = {
  "en-US": {
    submitted: 'Answers stay here until you press "Submit".',
    immediate: "Answers go to the agent as you give them.",
  },
  "it-IT": {
    submitted: "Le risposte restano qui finché non premi «Invia le risposte».",
    immediate: "Le risposte arrivano all'agente man mano che le dai.",
  },
};

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  presentation: Presentation,
  options: { delivery?: "immediate" | "submitted"; language?: Language } = {},
) => {
  const { delivery = "immediate", language = "en-US" } = options;
  const run = await start(lifecycleScenario(answeringAsk(presentation, language, delivery), dist));
  const board = await openBoard(run, FIRST_VIEW[presentation]);
  return { run, board };
};

const bar = (board: Board): Locator => board.view.getByRole("contentinfo");
const helper = (board: Board, text: string): Locator => bar(board).getByText(text, { exact: true });
const jump = (board: Board): Locator => board.header.locator("[data-askboard-next-to-do]");

type Box = { readonly top: number; readonly bottom: number };
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`no box for ${locator}`);
  return { top: box.y, bottom: box.y + box.height };
};

/** The reason beside "Answer" of a card: the button whose text names the field. */
const reasonOf = (board: Board, id: string): Locator =>
  board.question(id).getByRole("button", {
    name: /^(Complete|Correct) .+ first\.$|^(Completa|Correggi) prima .+\.$/,
  });

/** The text the button's `aria-describedby` points at, as the page resolves it. */
const descriptionOf = (answer: Locator): Promise<{ text: string; visible: boolean }> =>
  answer.evaluate((button) => {
    const target = button.ownerDocument.getElementById(
      button.getAttribute("aria-describedby") ?? "",
    );
    if (target === null) return { text: "", visible: false };
    const { width, height } = target.getBoundingClientRect();
    return { text: target.textContent ?? "", visible: width > 1 && height > 1 };
  });

const onePerViewBoard = async (start: ReturnType<typeof useEngine>["start"]) => {
  const run = await start(lifecycleScenario(onePerViewAsk, dist));
  const board = await openBoard(run, ["q1", "q2", "q3", "q4", "q5"]);
  return { run, board };
};

const yes = async (board: Board, id: string): Promise<void> => {
  await optionOf(board, id, "Yes").check({ timeout: STEP_TIMEOUT_MS });
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the bar's helper, one next-open control, the reason beside Answer`, () => {
    const { start } = useEngine(engine);

    test(
      "the submitted helper text in en-US and it-IT, changing with the mode, none on a single question",
      async () => {
        for (const language of ["en-US", "it-IT"] as const) {
          const { board } = await open(start, "sections", { delivery: "submitted", language });
          await helper(board, HELPER[language].submitted).waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await helper(board, HELPER[language].immediate).count()).toBe(0);
        }
        const { run, board } = await open(start, "sections", { delivery: "submitted" });
        await helper(board, HELPER["en-US"].submitted).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.delivery("immediate").click({ timeout: STEP_TIMEOUT_MS });
        await helper(board, HELPER["en-US"].immediate).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await helper(board, HELPER["en-US"].submitted).count()).toBe(0);
        await board.delivery("submitted").click({ timeout: STEP_TIMEOUT_MS });
        await helper(board, HELPER["en-US"].submitted).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await helper(board, HELPER["en-US"].immediate).count()).toBe(0);
        expectNoCspProblem(run);

        const single = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const only = await openBoard(single, ["only"]);
        expect(
          await bar(only)
            .getByText(/^Answers (stay|go)/)
            .count(),
        ).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: the header's jump is the only one, showing question 5 then question 2",
      async () => {
        const { run, board } = await onePerViewBoard(start);
        const navigator = board.view.getByRole("navigation", { name: "Question navigator" });
        await navigator.getByText("Question 1 of 5", { exact: true }).waitFor();
        expect(await navigator.locator("[data-askboard-next-to-do]").count()).toBe(0);
        expect(await jump(board).count()).toBe(1);
        const next = navigator.getByRole("button", { name: "Next", exact: true });
        await yes(board, "q1");
        await next.click();
        await next.click();
        await yes(board, "q3");
        await next.click();
        await yes(board, "q4");
        await jump(board).click({ timeout: STEP_TIMEOUT_MS });
        await navigator.getByText("Question 5 of 5", { exact: true }).waitFor();
        await eventually(() => isFocused(headingOf(board, "q5")), "focus on question 5's heading");
        await jump(board).click({ timeout: STEP_TIMEOUT_MS });
        await navigator.getByText("Question 2 of 5", { exact: true }).waitFor();
        await eventually(() => isFocused(headingOf(board, "q2")), "focus on question 2's heading");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    for (const presentation of ["sections", "tabs"] as const) {
      test(
        `${presentation}: the header's jump stays, and no navigator holds one`,
        async () => {
          const { board } = await open(start, presentation);
          expect(await jump(board).count()).toBe(1);
          expect(
            await board.view.getByRole("navigation", { name: "Question navigator" }).count(),
          ).toBe(0);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "a single-question board has neither a jump nor a navigator",
      async () => {
        const run = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const board = await openBoard(run, ["only"]);
        expect(await jump(board).count()).toBe(0);
        expect(
          await board.view.getByRole("navigation", { name: "Question navigator" }).count(),
        ).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the reason shows beside Answer and is its accessible description",
      async () => {
        const { board } = await open(start, "sections");
        const answer = answerOf(board, "q4");
        await reasonOf(board, "q4").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await answer.isDisabled()).toBe(true);
        const described = await descriptionOf(answer);
        expect(described).toEqual({ text: "Complete Service name first.", visible: true });
        // Beside the button: on its row, before it.
        const reason = await boxOf(reasonOf(board, "q4"));
        const button = await boxOf(answer);
        expect(Math.abs(reason.top - button.top)).toBeLessThan(button.bottom - button.top);
        await board.question("q4").getByLabel("Service name").fill("api");
        await board.question("q4").getByLabel("Ticket").fill("ab-1234");
        await eventually(
          async () => (await descriptionOf(answer)).text === "Correct Ticket first.",
          "the reason naming Ticket",
        );
        expect(await reasonOf(board, "q4").isVisible()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the reason in Italian, the required field first",
      async () => {
        const { board } = await open(start, "sections", { language: "it-IT" });
        await board.question("q4").getByLabel("Ticket").fill("ab-1234");
        const rispondi = board.question("q4").locator("[data-askboard-primary]");
        await board
          .question("q4")
          .getByRole("button", { name: "Completa prima Nome del servizio." })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await rispondi.isDisabled()).toBe(true);
        expect(await descriptionOf(rispondi)).toEqual({
          text: "Completa prima Nome del servizio.",
          visible: true,
        });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the reason leads to the field, which lies between the bars",
      async () => {
        const { board } = await open(start, "sections");
        await board.question("q4").getByLabel("Service name").fill("api");
        await board.question("q4").getByLabel("Ticket").fill("ab-1234");
        await reasonOf(board, "q4").evaluate((button) => button.scrollIntoView({ block: "end" }));
        await reasonOf(board, "q4").click({ timeout: STEP_TIMEOUT_MS });
        const ticket = board.question("q4").getByLabel("Ticket");
        await eventually(() => isFocused(ticket), "focus in Ticket");
        const header = await boxOf(board.header);
        const footer = await boxOf(bar(board));
        const field = await boxOf(ticket);
        expect(field.top).toBeGreaterThanOrEqual(header.bottom);
        expect(field.bottom).toBeLessThanOrEqual(footer.top);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a field in a hidden tab: its tab is selected and focus is in the field",
      async () => {
        const { board } = await open(start, "sections");
        const second = board.question("q6").getByRole("tab", { name: "Second" });
        expect(await second.getAttribute("aria-selected")).toBe("false");
        await reasonOf(board, "q6").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await second.getAttribute("aria-selected")) === "true",
          "the second tab selected",
        );
        await eventually(
          () => isFocused(board.question("q6").getByLabel("Owner")),
          "focus in Owner",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "every field passes: the reason is gone and Answer is enabled",
      async () => {
        const { board } = await open(start, "sections");
        await board.question("q4").getByLabel("Service name").fill("api");
        await board.question("q4").getByLabel("Ticket").fill("ab-1234");
        await board.question("q4").getByLabel("Ticket").fill("AB-1234");
        await eventually(async () => (await reasonOf(board, "q4").count()) === 0, "no reason");
        await eventually(() => answerOf(board, "q4").isEnabled(), "Answer enabled");
        expect((await descriptionOf(answerOf(board, "q4"))).text).toBe("");
        expect(await postponeOf(board, "q4").isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
