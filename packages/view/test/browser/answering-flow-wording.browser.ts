// The wording of the answering flow and the two primaries, in each engine (answering-flow-guidance,
// task 4.1; view-and-widgets spec: The question's primary button, Delivery mode, Submit,
// Single-question board, The board's interface in the ask's language; design D5; PO answers Q1 and
// Q2 on #168). The controls are found by their hooks, and their labels are read, never searched
// for. At 1280x800. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { answeringAsk, type Language } from "./fixtures/answering-flow-asks.ts";
import { singleAsk } from "./fixtures/lifecycle-asks.ts";
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
  buttonOf,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
  postponeOf,
  receiptOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const FIRST = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];

type Start = ReturnType<typeof useEngine>["start"];

/** The text a control shows, as the user reads it. */
const labelOf = async (control: Locator): Promise<string> => (await control.innerText()).trim();

/** Waits until a control reads `expected`. */
const reads = (control: Locator, expected: string): Promise<void> =>
  eventually(
    async () => (await control.count()) > 0 && (await labelOf(control)) === expected,
    `a control reading ${expected}`,
  );

const open = async (
  start: Start,
  options: { delivery?: "immediate" | "submitted"; language?: Language } = {},
) => {
  const { delivery = "immediate", language = "en-US" } = options;
  const run = await start(lifecycleScenario(answeringAsk("sections", language, delivery), dist));
  const board = await openBoard(run, FIRST);
  return { run, board };
};

const yes = (board: Board, id: string, language: Language = "en-US"): Locator =>
  optionOf(board, id, language === "it-IT" ? "Sì" : "Yes");

const bar = (board: Board): Locator => board.view.getByRole("contentinfo");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the wording and the two primaries`, () => {
    const { start } = useEngine(engine);

    test(
      "in One by one the primary reads Send answer and the bar has no Send",
      async () => {
        const { run, board } = await open(start);
        await yes(board, "q1").check({ timeout: STEP_TIMEOUT_MS });
        await reads(answerOf(board, "q1"), "Send answer");
        expect(await board.submit.count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in All together the primary reads Confirm, then Edit with focus kept, then Confirm",
      async () => {
        const { board } = await open(start, { delivery: "submitted" });
        await yes(board, "q1").check({ timeout: STEP_TIMEOUT_MS });
        const primary = answerOf(board, "q1");
        await reads(primary, "Confirm");
        await primary.click({ timeout: STEP_TIMEOUT_MS });
        await reads(primary, "Edit");
        await eventually(() => isFocused(primary), "focus kept on the primary");
        await primary.click({ timeout: STEP_TIMEOUT_MS });
        await reads(primary, "Confirm");
        await eventually(() => isFocused(primary), "focus kept on the primary after Edit");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note alone makes the primary read Send the note",
      async () => {
        const { board } = await open(start);
        await noteOf(board, "q1").fill("Check with the platform team.");
        await reads(answerOf(board, "q1"), "Send the note");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a revision makes the primary read Send the change",
      async () => {
        const { board } = await open(start);
        await yes(board, "q1").check({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await receiptOf(board, "q1", "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await optionOf(board, "q1", "No").check({ timeout: STEP_TIMEOUT_MS });
        await reads(answerOf(board, "q1"), "Send the change");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in All together Send counts the ready answers: Send 2 answers",
      async () => {
        const { board } = await open(start, { delivery: "submitted" });
        for (const id of ["q1", "q2"]) {
          await yes(board, id).check({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
        }
        await reads(board.submit, "Send 2 answers");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with only a postpone held, Send reads Send, with no count",
      async () => {
        const { board } = await open(start, { delivery: "submitted" });
        await postponeOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(board.submit, "Send");
        expect(await board.submit.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the mode names and their helper texts, in en-US and it-IT",
      async () => {
        const texts: Record<Language, readonly string[]> = {
          "en-US": [
            "Sending answers",
            "One by one",
            "All together",
            "Each answer goes to the agent as soon as you send it.",
            'Answers stay here until you press "Send answers".',
          ],
          "it-IT": [
            "Invio delle risposte",
            "Una alla volta",
            "Tutte insieme",
            "Ogni risposta parte appena la invii.",
            "Le risposte restano qui finché non premi «Invia le risposte».",
          ],
        };
        for (const language of ["en-US", "it-IT"] as const) {
          const [heading, immediate, submitted, immediateHelp, submittedHelp] = texts[language];
          const { board } = await open(start, { language });
          const text = (value: string | undefined) =>
            bar(board).getByText(value ?? "", { exact: true });
          await text(heading).waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await labelOf(board.delivery("immediate"))).toBe(immediate ?? "");
          expect(await labelOf(board.delivery("submitted"))).toBe(submitted ?? "");
          await text(immediateHelp).waitFor({ timeout: STEP_TIMEOUT_MS });
          await board.delivery("submitted").click({ timeout: STEP_TIMEOUT_MS });
          await text(submittedHelp).waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await text(immediateHelp).count()).toBe(0);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      'leaving All together with held work asks Switch to "One by one"?',
      async () => {
        const { board } = await open(start, { delivery: "submitted" });
        await yes(board, "q1").check({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await board.delivery("immediate").click({ timeout: STEP_TIMEOUT_MS });
        await board.view
          .getByRole("alertdialog")
          .getByText('Switch to "One by one"?', { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the card's Postpone reads Later and its menu More; an Italian ask reads Invia risposta, Più tardi, Altro and Impostazioni",
      async () => {
        const { board } = await open(start);
        expect(await labelOf(postponeOf(board, "q1"))).toBe("Later");
        await buttonOf(board, "q1", "More").waitFor({ timeout: STEP_TIMEOUT_MS });
        const italian = await open(start, { language: "it-IT" });
        await yes(italian.board, "q1", "it-IT").check({ timeout: STEP_TIMEOUT_MS });
        await reads(answerOf(italian.board, "q1"), "Invia risposta");
        expect(await labelOf(postponeOf(italian.board, "q1"))).toBe("Più tardi");
        await buttonOf(italian.board, "q1", "Altro").waitFor({ timeout: STEP_TIMEOUT_MS });
        await italian.board.view
          .getByRole("button", { name: "Impostazioni", exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the single-question board: Send answer, Later, no Send and no mode switch",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        await optionOf(board, "database", "PostgreSQL").check({ timeout: STEP_TIMEOUT_MS });
        await reads(answerOf(board, "database"), "Send answer");
        expect(await labelOf(postponeOf(board, "database"))).toBe("Later");
        expect(await board.submit.count()).toBe(0);
        expect(await board.delivery("immediate").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the header reads {n} to do and the jump reads Next to do",
      async () => {
        const { board } = await open(start);
        await board.header.getByText("9 to do", { exact: true }).waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
        expect((await labelOf(board.nextToDo)).startsWith("Next to do")).toBe(true);
        const italian = await open(start, { language: "it-IT" });
        await italian.board.header
          .getByText("9 da fare", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect((await labelOf(italian.board.nextToDo)).startsWith("Prossima da fare")).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
