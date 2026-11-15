// The status messages of the answering flow, in each engine (answering-flow-fixes, task 4.1;
// view-and-widgets spec: Status messages for the answering flow; #182). At 1280x800, on the board of
// nine questions: the one `role="status"` region outside the cards says what a command that was sent,
// an answer marked ready, Submit, "Select recommended", the agent's additions and removals and the
// agent pill did, and never claims delivery. Each wait is on the region's text; a silent step is
// asserted once the act's own effect shows. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { answeringAsk, type Language, type Presentation } from "./fixtures/answering-flow-asks.ts";
import { type Asker, withHeader } from "./harness/asker.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  LOAD_TIMEOUT_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  barButton,
  lifecycleScenario,
  mirrored,
  noteOf,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"],
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};
const DELIVERED = /delivered|consegnat/i;
const MAIN: Asker = { project: "order-service", gitUser: "Paola Greco", agent: {} };

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  options: {
    presentation?: Presentation;
    delivery?: "immediate" | "submitted";
    language?: Language;
  } = {},
) => {
  const { presentation = "sections", delivery = "immediate", language = "en-US" } = options;
  const scenario = lifecycleScenario(answeringAsk(presentation, language, delivery), dist);
  const run = await start(scenario);
  const board = await openBoard(run, FIRST_VIEW[presentation]);
  return { run, board };
};

const regionText = async (board: Board): Promise<string> =>
  (await board.status.textContent({ timeout: STEP_TIMEOUT_MS })) ?? "";

/** Waits until the region reads `text`, which never claims delivery. */
const said = (board: Board, text: string): Promise<void> =>
  eventually(async () => {
    const now = await regionText(board);
    expect(now).not.toMatch(DELIVERED);
    return now === text;
  }, `the status region reading "${text}"`);

/** A frame later: what a handler announced in the same task has rendered. */
const settled = (board: Board): Promise<unknown> =>
  board.page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(0))));

const chooseYes = async (board: Board, id: string): Promise<void> => {
  await optionOf(board, id, "Yes").check({ timeout: STEP_TIMEOUT_MS });
};
const answerYes = async (board: Board, id: string): Promise<void> => {
  await chooseYes(board, id);
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
};

const answerIt = (board: Board, id: string) =>
  board.question(id).locator("[data-askboard-primary]");

const added = (id: string) => ({
  action: "add",
  parentId: "release",
  item: {
    type: "question",
    id,
    props: {
      text: `Is step ${id} needed for the release?`,
      header: id.toUpperCase(),
      options: [{ label: "Yes" }, { label: "No" }],
    },
  },
});
const ADDED = added("q10");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the status messages of the answering flow`, () => {
    const { start } = useEngine(engine);

    test(
      "there is one status region outside the cards, from the first render, empty until something happens",
      async () => {
        const { board } = await open(start);
        expect(await board.status.count()).toBe(1);
        expect(await regionText(board)).toBe("");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answer sent names its option, and a delivered receipt adds nothing",
      async () => {
        const { run, board } = await open(start);
        await answerYes(board, "q1");
        await said(board, "Answer sent: Yes. Next: Q2, 2 of 9.");
        await actsSent(run, 1);
        await run.session.collected();
        await board.receipt("delivered").first().waitFor({ timeout: STEP_TIMEOUT_MS });
        await said(board, "Answer sent: Yes. Next: Q2, 2 of 9.");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answer not sent yet (connection lost) says nothing of sending",
      async () => {
        const { run, board } = await open(start);
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await answerYes(board, "q1");
        await board.receipt("queued").waitFor({ timeout: STEP_TIMEOUT_MS });
        await settled(board);
        expect(await regionText(board)).toBe("");
        await run.session.restore();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answer with no option says it was sent, without one",
      async () => {
        const { board } = await open(start);
        await board
          .question("q4")
          .getByRole("textbox", { name: "Service name" })
          .fill("billing", { timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q4").click({ timeout: STEP_TIMEOUT_MS });
        await said(board, "Answer sent. Next: Q5, 5 of 9.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note alone says the question is still to do",
      async () => {
        const { board } = await open(start);
        await noteOf(board, "q1").fill("Ask ops first.", { timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await said(board, "Note sent; the question is still to do.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answer marked ready says it is not sent, with the count of ready answers",
      async () => {
        const { run, board } = await open(start, { delivery: "submitted" });
        await answerYes(board, "q1");
        await said(board, "Answer ready, not sent. 1 ready. Next: Q2, 2 of 9.");
        await answerYes(board, "q2");
        await said(board, "Answer ready, not sent. 2 ready. Next: Q3, 3 of 9.");
        expect(await actsSent(run, 0)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note alone held announces nothing, and is left out of the ready count",
      async () => {
        const { board } = await open(start, { delivery: "submitted" });
        await noteOf(board, "q1").fill("Ask ops first.", { timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await settled(board);
        expect(await regionText(board)).toBe("");
        await answerYes(board, "q2");
        await said(board, "Answer ready, not sent. 1 ready. Next: Q3, 3 of 9.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Submit says how many answers it sent",
      async () => {
        const { run, board } = await open(start, { delivery: "submitted" });
        await answerYes(board, "q1");
        await answerYes(board, "q2");
        await said(board, "Answer ready, not sent. 2 ready. Next: Q3, 3 of 9.");
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await said(board, "2 answers sent.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Select recommended says how many it prefilled and that nothing was sent, every press, none included",
      async () => {
        const { run, board } = await open(start, { delivery: "submitted" });
        await board.prefill.click({ timeout: STEP_TIMEOUT_MS });
        await said(board, "4 questions prefilled. Nothing was sent.");
        await board.prefill.click({ timeout: STEP_TIMEOUT_MS });
        await said(board, "0 questions prefilled. Nothing was sent.");
        expect(await actsSent(run, 0)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question the agent adds is announced, and focus stays where it was",
      async () => {
        const { run, board } = await open(start);
        await optionOf(board, "q3", "Yes").focus();
        await run.session.update([ADDED]);
        await said(board, "The agent added 1 question: Q10.");
        expect(await isFocused(optionOf(board, "q3", "Yes"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the question in view removed by the agent is announced, in one question per view",
      async () => {
        const { run, board } = await open(start, { presentation: "one-per-view" });
        await board.view
          .getByRole("button", { name: "Next", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await board.question("q2").waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.update([{ action: "delete", itemId: "q2" }]);
        await said(board, "Question removed by the agent");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the question shown removed before any navigation is announced, in one question per view",
      async () => {
        const { run, board } = await open(start, { presentation: "one-per-view" });
        await run.session.update([{ action: "delete", itemId: "q1" }]);
        await said(board, "Question removed by the agent");
        await board.question("q2").waitFor({ timeout: STEP_TIMEOUT_MS });
        const navigator = board.view.getByRole("navigation", { name: "Question navigator" });
        await navigator
          .getByText("Question removed by the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await navigator.getByText("Question 1 of 8", { exact: true }).waitFor();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the update that carries a restore is no news, and the next one is announced",
      async () => {
        const { run, board } = await open(start, { delivery: "submitted" });
        await chooseYes(board, "q2");
        await mirrored(run, (record) => record.questions.q2 !== undefined, "q2's work");
        await reloadBoard(board, run, () =>
          board.question("q2").waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS }),
        );
        // The first update after a reload carries the restore: no news, nothing said.
        await eventually(() => optionOf(board, "q2", "Yes").isChecked(), "q2's work restored");
        await settled(board);
        expect(await regionText(board)).toBe("");
        await run.session.update([added("q11")]);
        await said(board, "The agent added 1 question: Q11.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent pill is no live region, and a change to waiting is announced",
      async () => {
        // The header's own scenario: its transcript names the question the waiting `collect` waits on.
        const run = await start({
          transcript: withHeader(replayTranscripts.opening, MAIN),
          view: dist,
          asker: MAIN,
        });
        const board = await run.open();
        await board.agentPill.waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => ((await board.agentPill.textContent()) ?? "") === "Agent: Working",
          "the agent pill reading Working",
        );
        expect(await board.agentPill.getAttribute("role")).toBeNull();
        expect(await regionText(board)).toBe("");
        await run.session.agentWaits();
        await eventually(
          async () =>
            ((await board.agentPill.textContent()) ?? "") === "Agent: Waiting for your answer",
          "the agent pill reading Waiting",
        );
        await said(board, "Agent: Waiting for your answer");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in Italian: an answer sent and answers marked ready follow the ask's language",
      async () => {
        const { board } = await open(start, { language: "it-IT" });
        await optionOf(board, "q1", "Sì").check({ timeout: STEP_TIMEOUT_MS });
        await answerIt(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await said(board, "Risposta inviata: Sì. Prossima: Q2, 2 di 9.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in Italian, submitted: ready with its plural forms",
      async () => {
        const { board } = await open(start, { language: "it-IT", delivery: "submitted" });
        await optionOf(board, "q1", "Sì").check({ timeout: STEP_TIMEOUT_MS });
        await answerIt(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await said(board, "Risposta pronta, non inviata. 1 pronta. Prossima: Q2, 2 di 9.");
        await optionOf(board, "q2", "Sì").check({ timeout: STEP_TIMEOUT_MS });
        await answerIt(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await said(board, "Risposta pronta, non inviata. 2 pronte. Prossima: Q3, 3 di 9.");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
