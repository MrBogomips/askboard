// The answer state ladder on every surface, in each engine (answering-flow-guidance, task 5.1;
// view-and-widgets spec: The answer state ladder, Delivery receipt on the board, Outline navigator,
// One question per view, Open prompt, Revising an answer; design D1). A state is read from
// `data-askboard-state` (the card's line, the outline entry's label) and its words from the text of
// that element; a state that must not show is counted, after a positive case has shown the locator
// finds it when it does. At 1280x800. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { formatTime } from "@askboard/contract";
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
  chooseFromMore,
  focused,
  headingOf,
  labelText,
  lifecycleScenario,
  loggedReceiptOf,
  noteOf,
  openBoard,
  optionOf,
  postponeOf,
} from "./harness/lifecycle-test.ts";
import { viewSettled } from "./harness/probes.ts";
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

/** The progress strip's segment of the nth question (the navigator's markers moved there), whose name ends with its state. */
const markerOf = (board: Board, index: number): Locator => board.strip(`q${index + 1}`);

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

/** The icon a state's marker draws, by its Lucide name (answering-flow-guidance, D11). */
const ICONS: Readonly<Record<State, string>> = {
  todo: "circle",
  draft: "pencil",
  ready: "package",
  "not-sent-yet": "hourglass",
  sent: "send",
  delivered: "check-check",
  postponed: "clock",
  declined: "ban",
};

/** The state's marker is the state's icon: an svg of that name, hidden from assistive technology. */
const expectIcon = async (line: Locator, state: State): Promise<void> => {
  const marker = line.locator(`[data-askboard-marker="${state}"]`);
  expect(await marker.count()).toBe(1);
  expect(await marker.evaluate((element) => element.tagName.toLowerCase())).toBe("svg");
  expect(await marker.getAttribute("aria-hidden")).toBe("true");
  expect(await marker.getAttribute("class")).toContain(`lucide-${ICONS[state]}`);
};

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
      "one question per view: the strip's segments name the state of each question",
      async () => {
        const { board } = await open(start, {
          delivery: "submitted",
          presentation: "one-per-view",
        });
        const first = markerOf(board, 0);
        await eventually(
          async () => ((await first.getAttribute("aria-label")) ?? "").endsWith("To do"),
          "marker 1 reading To do",
        );
        await choose(board, "q1");
        await eventually(
          async () => ((await first.getAttribute("aria-label")) ?? "").endsWith("Draft"),
          "marker 1 reading Draft",
        );
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => ((await first.getAttribute("aria-label")) ?? "").endsWith("Ready, not sent"),
          "marker 1 reading Ready, not sent",
        );
        // The second question's marker is its own.
        expect(
          ((await markerOf(board, 1).getAttribute("aria-label")) ?? "").endsWith("To do"),
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
        const [sent] = await actsDone(run, 1);
        expect(sent?.acts.map((act) => act.type)).toEqual(["note"]);
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
      "a reopened question being edited reads Draft and still counts as to do (A reopened question being edited)",
      async () => {
        const { run, board } = await open(start);
        // Question 2 is declined in "One by one" and the decline is logged.
        await chooseFromMore(board, "q2", "Decline");
        await actsDone(run, 1);
        await reads(lineOf(board, "q2"), "declined", "Declined");
        await toDo(board, 8);
        // In "All together" Undo on it holds the reopen: question 2 is to do again.
        await board.delivery("submitted").click({ timeout: STEP_TIMEOUT_MS });
        await chooseFromMore(board, "q2", "Decline");
        await reads(lineOf(board, "q2"), "todo", "To do");
        await toDo(board, 9);
        // An option selected: a first draft over the undone decline, which counts as to do.
        await choose(board, "q2");
        await reads(lineOf(board, "q2"), "draft", "Draft");
        await reads(entryOf(board, "q2"), "draft", "Draft");
        await viewSettled(board);
        await toDo(board, 9);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note while the connection is lost reads Not sent yet and shows Note sent only once the note's command is done; one that is dropped never does",
      async () => {
        const { run, board } = await open(start);
        const sentLine = (id: string) => card(board, id).locator("[data-askboard-note-sent]");
        // Positive first: a note sent while connected shows the line, so the locator finds it.
        await noteOf(board, "q2").fill("Ask ops first.");
        await answerOf(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await sentLine("q2").waitFor({ timeout: STEP_TIMEOUT_MS });
        // (a) The connection is lost: the note is queued, and the line stays away.
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await noteOf(board, "q1").fill("Check with the platform team.");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "not-sent-yet", "Not sent yet");
        await viewSettled(board);
        expect(await sentLine("q1").count()).toBe(0);
        await run.session.restore();
        const acts = await actsDone(run, 2);
        expect(acts.map((command) => command.acts.map((act) => act.type))).toEqual([
          ["note"],
          ["note"],
        ]);
        await sentLine("q1").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect((await sentLine("q1").innerText()).trim()).toMatch(/^Note sent \d{1,2}:\d{2}/);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note held for Send shows Note sent only once Send's command is done (A note held for Send)",
      async () => {
        const { run, board } = await open(start, { delivery: "submitted" });
        const sentLine = card(board, "q1").locator("[data-askboard-note-sent]");
        await noteOf(board, "q1").fill("Ask ops first.");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        // Positive first: the note is held, so Send is enabled.
        await eventually(() => board.submit.isEnabled(), "Send enabled for the held note");
        await viewSettled(board);
        expect(await sentLine.count()).toBe(0);
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        const [sent] = await actsDone(run, 1);
        expect(sent?.acts.map((act) => act.type)).toEqual(["note"]);
        await sentLine.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect((await sentLine.innerText()).trim()).toMatch(/^Note sent \d{1,2}:\d{2}/);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a queued note shows the time the user sent it, not the time its command was done (A note while the connection is lost)",
      async () => {
        const run = await start(
          lifecycleScenario(answeringAsk("sections", "en-US", "immediate"), dist),
        );
        // Playwright's clock, installed before the board loads; time flows until the test moves it.
        await run.browser.context.clock.install();
        const board = await openBoard(run, FIRST);
        const sentLine = card(board, "q1").locator("[data-askboard-note-sent]");
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await noteOf(board, "q1").fill("Check with the platform team.");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "not-sent-yet", "Not sent yet");
        // The page's clock moves two hours ahead; no timer fires, so the reconnect keeps its pace.
        const moved = Date.now() + 2 * 60 * 60 * 1000;
        await board.page.clock.setSystemTime(moved);
        await run.session.restore();
        const [sent] = await actsDone(run, 1);
        const [note] = sent?.acts ?? [];
        const when = note?.type === "note" ? note.when : "";
        expect(Date.parse(when)).toBeLessThan(moved - 60 * 60 * 1000);
        await sentLine.waitFor({ timeout: STEP_TIMEOUT_MS });
        // The viewer's offset is the page's, which the test process may not share.
        const offset = await board.page.evaluate(
          (instant) => 0 - new Date(instant).getTimezoneOffset(),
          when,
        );
        const shown = (await sentLine.innerText()).trim();
        expect(shown).toBe(`Note sent ${formatTime(when, offset, "en-US")}`);
        expect(shown).not.toBe(
          `Note sent ${formatTime(new Date(moved).toISOString(), offset, "en-US")}`,
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note the agent's closing drops on reconnect never shows Note sent (the path taken: a note past the open prompt's bound cannot be built, since the prompt holds 10,000 characters and the message limit is far above it)",
      async () => {
        const { run, board } = await open(start);
        const sentLine = (id: string) => card(board, id).locator("[data-askboard-note-sent]");
        await noteOf(board, "q2").fill("Ask ops first.");
        await answerOf(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await sentLine("q2").waitFor({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await noteOf(board, "q1").fill("Check with the platform team.");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "not-sent-yet", "Not sent yet");
        // The agent closes the ask before the note returns; the note is dropped on reconnect.
        await run.session.update([{ action: "close" }]);
        await run.session.restore();
        await eventually(async () => (await holding(board, "not-sent-yet")) === 0, "the note gone");
        await viewSettled(board);
        expect(await sentLine("q1").count()).toBe(0);
        expect(await actsDone(run, 1)).toHaveLength(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the card's logged receipt turns from sent to delivered on collect while its state line still reads Ready, not sent",
      async () => {
        const { run, board } = await open(start, { delivery: "submitted" });
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        await loggedReceiptOf(board, "q1", "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        // A revision confirmed, not sent: the line reads Ready, the logged answer still Sent.
        await optionOf(board, "q1", "No").check({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "ready", "Ready, not sent");
        expect(await loggedReceiptOf(board, "q1", "delivered").count()).toBe(0);
        await run.session.collect();
        await loggedReceiptOf(board, "q1", "delivered").waitFor({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "ready", "Ready, not sent");
        expect(await loggedReceiptOf(board, "q1", "sent").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "revising after delivery: Draft with no receipt, then Sent, then Delivered to the agent",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collect();
        await reads(lineOf(board, "q1"), "delivered", "Delivered to the agent");
        await card(board, "q1")
          .locator('[data-askboard-receipt="delivered"]')
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await optionOf(board, "q1", "No").check({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "draft", "Draft");
        expect(await card(board, "q1").locator("[data-askboard-receipt]").count()).toBe(0);
        expect(await labelText(answerOf(board, "q1"))).toBe("Send the change");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "sent", "Sent");
        await eventually(() => focused(headingOf(board, "q1")), "focus on question 1's heading");
        await actsDone(run, 2);
        await run.session.collect();
        await reads(lineOf(board, "q1"), "delivered", "Delivered to the agent");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an answer the agent recorded reads Delivered to the agent on the card and in the outline",
      async () => {
        const { run, board } = await open(start);
        await reads(lineOf(board, "q2"), "todo", "To do");
        await run.session.update([{ action: "answer", itemId: "q2", answer: { choice: ["Yes"] } }]);
        await reads(lineOf(board, "q2"), "delivered", "Delivered to the agent");
        await reads(entryOf(board, "q2"), "delivered", "Delivered to the agent");
        expect(await lineOf(board, "q1").getAttribute("data-askboard-state")).toBe("todo");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "each state's icon stands beside its label, hidden from assistive technology: on the card's state line and in the outline",
      async () => {
        const { run, board } = await open(start);
        await expectIcon(lineOf(board, "q4"), "todo");
        await expectIcon(entryOf(board, "q4"), "todo");
        await choose(board, "q5");
        await reads(lineOf(board, "q5"), "draft", "Draft");
        await expectIcon(lineOf(board, "q5"), "draft");
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q1"), "sent", "Sent");
        await expectIcon(lineOf(board, "q1"), "sent");
        await postponeOf(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q2"), "postponed", "Postponed");
        await expectIcon(lineOf(board, "q2"), "postponed");
        await chooseFromMore(board, "q3", "Decline");
        await reads(lineOf(board, "q3"), "declined", "Declined");
        await expectIcon(lineOf(board, "q3"), "declined");
        await expectIcon(entryOf(board, "q3"), "declined");
        await run.session.collect();
        await reads(lineOf(board, "q1"), "delivered", "Delivered to the agent");
        await expectIcon(lineOf(board, "q1"), "delivered");
        await expectIcon(entryOf(board, "q1"), "delivered");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Ready, not sent has its icon on the card and in the outline",
      async () => {
        const { board } = await open(start, { delivery: "submitted" });
        await choose(board, "q7");
        await answerOf(board, "q7").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q7"), "ready", "Ready, not sent");
        await expectIcon(lineOf(board, "q7"), "ready");
        await expectIcon(entryOf(board, "q7"), "ready");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Not sent yet has its icon while the connection is lost",
      async () => {
        const { run, board } = await open(start);
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await choose(board, "q5");
        await answerOf(board, "q5").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q5"), "not-sent-yet", "Not sent yet");
        await expectIcon(lineOf(board, "q5"), "not-sent-yet");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a state line holds one marker beside its label and the header row none: Ready, Postponed, Declined, Delivered",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "q1");
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collect();
        await postponeOf(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await chooseFromMore(board, "q3", "Decline");
        // Not sent yet: the connection lost, which also disables the delivery switch.
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await choose(board, "q5");
        await answerOf(board, "q5").click({ timeout: STEP_TIMEOUT_MS });
        await reads(lineOf(board, "q5"), "not-sent-yet", "Not sent yet");
        expect(await card(board, "q5").locator("[data-askboard-marker]").count()).toBe(1);
        expect(
          await lineOf(board, "q5").locator('[data-askboard-marker="not-sent-yet"]').count(),
        ).toBe(1);
        await run.session.restore();
        await board.delivery("submitted").click({ timeout: STEP_TIMEOUT_MS });
        await choose(board, "q7");
        await answerOf(board, "q7").click({ timeout: STEP_TIMEOUT_MS });
        const cases = [
          ["q1", "delivered", "Delivered to the agent"],
          ["q2", "postponed", "Postponed"],
          ["q3", "declined", "Declined"],
          ["q7", "ready", "Ready, not sent"],
        ] as const;
        for (const [id, state, label] of cases) {
          await reads(lineOf(board, id), state, label);
          expect(await card(board, id).locator("[data-askboard-marker]").count()).toBe(1);
          expect(await lineOf(board, id).locator(`[data-askboard-marker="${state}"]`).count()).toBe(
            1,
          );
        }
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
