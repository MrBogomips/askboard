// The answer state ladder on every surface, in each engine (answering-flow-guidance, task 5.1;
// view-and-widgets spec: The answer state ladder, Delivery receipt on the board, Outline navigator,
// One question per view, Open prompt, Revising an answer; design D1). A state is read from
// `data-askboard-state` (the card's line, the outline entry's label) and its words from the text of
// that element; a state that must not show is counted, after a positive case has shown the locator
// finds it when it does. At 1280x800. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { answeringAsk, type Language, type Presentation } from "./fixtures/answering-flow-asks.ts";
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
  card,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const FIRST = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];

type Start = ReturnType<typeof useEngine>["start"];
type State =
  | "todo"
  | "draft"
  | "ready"
  | "not-sent-yet"
  | "sent"
  | "delivered"
  | "postponed"
  | "declined";

const open = async (
  start: Start,
  options: {
    delivery?: "immediate" | "submitted";
    language?: Language;
    presentation?: Presentation;
  } = {},
) => {
  const { delivery = "immediate", language = "en-US", presentation = "sections" } = options;
  const run = await start(lifecycleScenario(answeringAsk(presentation, language, delivery), dist));
  const board = await openBoard(run, presentation === "one-per-view" ? ["q1"] : FIRST);
  return { run, board };
};

const choose = (board: Board, id: string, language: Language = "en-US"): Promise<void> =>
  optionOf(board, id, language === "it-IT" ? "Sì" : "Yes").check({ timeout: STEP_TIMEOUT_MS });

/** The card's state line. */
const lineOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-state]");

/** The outline entry's state label. */
const entryOf = (board: Board, id: string): Locator =>
  board.view.locator(`[data-askboard-outline="${id}"] [data-askboard-state]`);

/** The question navigator's marker of the nth question, which names its state in its label. */
const markerOf = (board: Board, index: number): Locator =>
  board.view
    .getByRole("navigation", { name: "Question navigator" })
    .getByRole("button")
    .filter({ has: board.view.locator("span") })
    .nth(index);

/** Waits until a state line holds `state` and reads `label`. */
const reads = (line: Locator, state: State, label: string): Promise<void> =>
  eventually(async () => {
    if ((await line.count()) === 0) return false;
    return (
      (await line.getAttribute("data-askboard-state")) === state &&
      (await line.innerText()).trim() === label
    );
  }, `a state line reading ${label} (${state})`);

/** How many elements of the board hold a state. */
const holding = (board: Board, state: State): Promise<number> =>
  board.view.locator(`[data-askboard-state="${state}"]`).count();

const toDo = (board: Board, count: number): Promise<void> =>
  board.header.getByText(`${count} to do`, { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the answer state ladder`, () => {
    const { start } = useEngine(engine);

    test(
      "ready, not sent: the card, the outline entry and the tab, with the ask pill still Waiting",
      async () => {
        const { board } = await open(start, { delivery: "submitted", presentation: "tabs" });
        const scope = board.view.getByRole("tab", { name: /^Scope/ });
        await eventually(async () => (await scope.innerText()).includes("3 to do"), "Scope: 3");
        await choose(board, "q1");
        // A choice not yet confirmed is a draft, not ready: Ready needs the act.
        await reads(lineOf(board, "q1"), "draft", "Draft");
        expect(await holding(board, "ready")).toBe(0);
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "ready", "Ready, not sent");
        await reads(entryOf(board, "q1"), "ready", "Ready, not sent");
        // The tab no longer counts the confirmed question.
        await eventually(async () => (await scope.innerText()).includes("2 to do"), "Scope: 2");
        await toDo(board, 8);
        await board.header.getByText("Waiting", { exact: true }).waitFor();
        // Ready is not sent: nothing reads Sent or Delivered until Submit.
        expect(await holding(board, "sent")).toBe(0);
        expect(await holding(board, "delivered")).toBe(0);
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "sent", "Sent");
        expect(await holding(board, "ready")).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "delivered to the agent after collect, on the card and in the outline; Sent before",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "sent", "Sent");
        await reads(entryOf(board, "q1"), "sent", "Sent");
        expect(await holding(board, "delivered")).toBe(0);
        await actsDone(run, 1);
        await run.session.collect();
        await reads(lineOf(board, "q1"), "delivered", "Delivered to the agent");
        await reads(entryOf(board, "q1"), "delivered", "Delivered to the agent");
        expect(await holding(board, "sent")).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a draft: a choice not confirmed reads Draft and still counts as to do",
      async () => {
        const { board } = await open(start);
        await reads(lineOf(board, "q1"), "todo", "To do");
        await choose(board, "q1");
        await reads(lineOf(board, "q1"), "draft", "Draft");
        await reads(entryOf(board, "q1"), "draft", "Draft");
        await reads(lineOf(board, "q2"), "todo", "To do");
        await toDo(board, 9);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "not sent yet while the connection is lost, and Sent only once the board page has sent it",
      async () => {
        const { run, board } = await open(start);
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "not-sent-yet", "Not sent yet");
        await reads(entryOf(board, "q1"), "not-sent-yet", "Not sent yet");
        expect(await holding(board, "sent")).toBe(0);
        expect(await holding(board, "delivered")).toBe(0);
        await run.session.restore();
        await reads(lineOf(board, "q1"), "sent", "Sent");
        expect(await holding(board, "not-sent-yet")).toBe(0);
        // Logged once: the answer was sent on reconnect, not sent twice.
        expect(await actsDone(run, 1)).toHaveLength(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a revision reads Draft, keeps the answered question out of the count, and is no longer Delivered",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collect();
        await reads(lineOf(board, "q1"), "delivered", "Delivered to the agent");
        await toDo(board, 8);
        await optionOf(board, "q1", "No").check({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "draft", "Draft");
        await reads(entryOf(board, "q1"), "draft", "Draft");
        expect(await holding(board, "delivered")).toBe(0);
        // The card still shows the latest answer, the edit.
        expect(await optionOf(board, "q1", "No").isChecked()).toBe(true);
        // A revision is not to do: the count stays at 8, where a first draft would make it 9.
        await toDo(board, 8);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after collect, an answered question holding only a note reads Draft on the card and in the outline, never Delivered",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collect();
        await reads(lineOf(board, "q1"), "delivered", "Delivered to the agent");
        await noteOf(board, "q1").fill("Check this with the platform team.");
        await reads(lineOf(board, "q1"), "draft", "Draft");
        await reads(entryOf(board, "q1"), "draft", "Draft");
        expect(await holding(board, "delivered")).toBe(0);
        expect(await card(board, "q1").locator('[data-askboard-receipt="delivered"]').count()).toBe(
          0,
        );
        await toDo(board, 8);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after collect, an answered question holding only an unparsed typed entry reads Draft on the card and in the outline, never Delivered",
      async () => {
        const days = { type: "number-field", id: "days", props: { label: "Days", min: 0 } };
        const run = await start(
          lifecycleScenario(
            {
              askId: "ladder-entry-a1",
              title: "Entries",
              items: [
                {
                  type: "area",
                  id: "plan",
                  props: {
                    title: "Plan",
                    items: [
                      {
                        type: "question",
                        id: "first",
                        props: { text: "How long?", items: [days] },
                      },
                      {
                        type: "question",
                        id: "second",
                        props: { text: "Anything else?", options: [{ label: "No" }] },
                      },
                    ],
                  },
                },
              ],
            },
            dist,
          ),
        );
        const board = await openBoard(run, ["first", "second"]);
        const field = board.view.getByLabel("Days", { exact: true });
        await field.fill("3");
        await answerOf(board, "first").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collect();
        await reads(lineOf(board, "first"), "delivered", "Delivered to the agent");
        await field.fill("abc");
        await reads(lineOf(board, "first"), "draft", "Draft");
        await reads(entryOf(board, "first"), "draft", "Draft");
        expect(await holding(board, "delivered")).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the outline entry's state follows the question: confirm in All together",
      async () => {
        const { board } = await open(start, { delivery: "submitted" });
        await reads(entryOf(board, "q2"), "todo", "To do");
        await choose(board, "q2");
        await answerOf(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await reads(entryOf(board, "q2"), "ready", "Ready, not sent");
        // Only question 2 is ready: the others keep their own state.
        await reads(entryOf(board, "q1"), "todo", "To do");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: the navigator's markers name the state of each question",
      async () => {
        const { board } = await open(start, {
          delivery: "submitted",
          presentation: "one-per-view",
        });
        const first = markerOf(board, 0);
        await eventually(
          async () => ((await first.getAttribute("aria-label")) ?? "").endsWith(", To do"),
          "marker 1 reading To do",
        );
        await choose(board, "q1");
        await eventually(
          async () => ((await first.getAttribute("aria-label")) ?? "").endsWith(", Draft"),
          "marker 1 reading Draft",
        );
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () =>
            ((await first.getAttribute("aria-label")) ?? "").endsWith(", Ready, not sent"),
          "marker 1 reading Ready, not sent",
        );
        // The second question's marker is its own.
        expect(
          ((await markerOf(board, 1).getAttribute("aria-label")) ?? "").endsWith(", To do"),
        ).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Send the note leaves the question To do and shows Note sent under the prompt",
      async () => {
        const { run, board } = await open(start);
        const line = card(board, "q1").locator("[data-askboard-note-sent]");
        expect(await line.count()).toBe(0);
        await noteOf(board, "q1").fill("Ask ops first.");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await line.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect((await line.innerText()).trim()).toMatch(/^Note sent \d{1,2}:\d{2}/);
        await actsDone(run, 1);
        await reads(lineOf(board, "q1"), "todo", "To do");
        await reads(entryOf(board, "q1"), "todo", "To do");
        await toDo(board, 9);
        // Another question shows no such line.
        expect(await card(board, "q2").locator("[data-askboard-note-sent]").count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian ask reads the ladder in Italian",
      async () => {
        const { run, board } = await open(start, { delivery: "submitted", language: "it-IT" });
        await reads(lineOf(board, "q1"), "todo", "Da fare");
        await choose(board, "q1", "it-IT");
        await reads(lineOf(board, "q1"), "draft", "Bozza");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "ready", "Pronta, non inviata");
        await reads(entryOf(board, "q1"), "ready", "Pronta, non inviata");
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "sent", "Inviata");
        await actsDone(run, 1);
        await run.session.collect();
        await reads(lineOf(board, "q1"), "delivered", "Consegnata all'agente");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
