// Postpone, "More", Explain, Decline and the follow-up thread, in each engine (ask-lifecycle, task
// 6.5; view spec: Postpone, Decline, Explain, Follow-up thread, Unread replies, Agent content as
// text): undo in both delivery modes, a decline held over the held undo of a sent postpone, which
// gives the undo back when taken back, focus to the question's heading, the composer's keys, replies
// with author and time, Explain disabled until its reply, a reply raising no agent-change notice,
// and an off-screen reply counted in the header. Every scenario runs on the session process, and
// the agent's side is read and written through `collect` and `update`.

import { describe, expect, test } from "bun:test";
import { longAsk, singleAsk, submittedAsk, twoAsk } from "./fixtures/lifecycle-asks.ts";
import {
  type BoardRun,
  eventually,
  expectNoCspProblem,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  actTypes,
  answerOf,
  barButton,
  buttonOf,
  card,
  chooseFromMore,
  composerOf,
  focused,
  headingOf,
  lifecycleScenario,
  menuItem,
  noteOf,
  openBoard,
  optionOf,
  promptArmed,
  sentActs,
  viewText,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const EXPLAIN = "Why are you asking, and what changes with each option?";

const pressed = (board: Board, id: string) =>
  buttonOf(board, id, "Postpone").getAttribute("aria-pressed");

// The outline entry's state label of a question.
const outlineSays = (board: Board, id: string, label: string) =>
  board.view
    .locator(`[data-askboard-outline="${id}"]`)
    .getByText(label, { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });

// The agent's reply to the latest follow-up of a question, through `update`.
const reply = async (run: BoardRun, itemId: string, text: string) => {
  const { events } = await run.session.collect();
  const followUp = events.findLast(
    (event) => event.type === "follow-up" && event.itemId === itemId,
  );
  if (followUp === undefined) throw new Error(`no follow-up on ${itemId} to reply to`);
  await run.session.update([{ action: "reply", itemId, followUp: followUp.cursor, text }]);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: Postpone, More and the follow-up thread`, () => {
    const { start } = useEngine(engine);

    test(
      "the plain-choice board's card: the chip, three options with their descriptions, the open prompt, Postpone, More and Answer",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        const view = card(board, "database");
        await view.getByText("Database", { exact: true }).waitFor();
        for (const description of [
          "Relational, with the team's existing tooling.",
          "Embedded, one file.",
          "Managed key-value store.",
        ]) {
          await view.getByText(description, { exact: true }).waitFor();
        }
        await noteOf(board, "database").waitFor();
        const names = await view.getByRole("button").allTextContents();
        const order = ["Postpone", "More", "Answer"].map((name) => names.indexOf(name));
        expect(order.every((at) => at >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(await buttonOf(board, "database", "More").isDisabled()).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in immediate delivery a postpone and its undo reach board-host, focus moves to the heading, and the question is open again",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await buttonOf(board, "database", "Postpone").click();
        await eventually(() => focused(headingOf(board, "database")), "focus on the heading");
        await actsSent(run, 1);
        await outlineSays(board, "database", "Postponed");
        await eventually(async () => (await pressed(board, "database")) === "true", "pressed");
        // A postponed question open on the board arms the leave-page prompt (FR-25).
        await eventually(() => promptArmed(board), "the prompt armed by the postponed question");
        await board.view
          .getByText("You have 1 postponed question: closing loses this ask", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await buttonOf(board, "database", "Postpone").click();
        await actsSent(run, 2);
        await outlineSays(board, "database", "Unanswered");
        expect(sentActs(run).map((command) => command.acts)).toEqual([
          [{ type: "postpone", itemId: "database", rev: 1 }],
          [{ type: "reopen", itemId: "database" }],
        ]);
        const { events } = await run.session.collect();
        expect(events.map((event) => event.type)).toEqual(["postponed", "reopened"]);
        await board.header.getByText("2 open", { exact: true }).waitFor();
        await eventually(async () => !(await promptArmed(board)), "the prompt disarmed");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in submitted delivery a postpone is held and its undo only changes the draft; Postpone is disabled on a ready question",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, ["database", "cache", "audit"]);
        await buttonOf(board, "audit", "Postpone").click();
        await outlineSays(board, "audit", "Postponed");
        await buttonOf(board, "cache", "Postpone").click();
        await board.view
          .getByText("You have 2 postponed questions: closing loses this ask", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await buttonOf(board, "cache", "Postpone").click();
        await outlineSays(board, "cache", "Unanswered");
        expect(await pressed(board, "cache")).toBe("false");
        await optionOf(board, "database", "SQLite").click();
        await answerOf(board, "database").click();
        await outlineSays(board, "database", "Ready");
        expect(await buttonOf(board, "database", "Postpone").isDisabled()).toBe(true);
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "declining in submitted delivery: the question shows declined, nothing is sent, and Submit sends the decline with its reason",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, ["database", "cache", "audit"]);
        await noteOf(board, "audit").fill("The compliance team decides this.");
        await chooseFromMore(board, "audit", "Decline");
        await eventually(() => focused(headingOf(board, "audit")), "focus on the heading");
        await outlineSays(board, "audit", "Declined");
        expect(sentActs(run)).toEqual([]);
        await barButton(board, "Submit").click();
        const [command] = await actsSent(run, 1);
        expect(command?.acts).toEqual([
          {
            type: "decline",
            itemId: "audit",
            rev: 1,
            note: "The compliance team decides this.",
            when: expect.stringMatching(/Z$/),
          },
        ]);
        await card(board, "audit").getByText("sent", { exact: true }).waitFor();
        const { events } = await run.session.collect();
        expect(events).toEqual([
          expect.objectContaining({
            type: "answer",
            itemId: "audit",
            declined: true,
            note: "The compliance team decides this.",
          }),
        ]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in immediate delivery Decline goes at once, is disabled on an answered question, and chosen again sends a reopen",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await chooseFromMore(board, "cache", "Decline");
        await actsSent(run, 1);
        await outlineSays(board, "cache", "Declined");
        await chooseFromMore(board, "cache", "Decline");
        await actsSent(run, 2);
        await outlineSays(board, "cache", "Unanswered");
        expect(actTypes(run)).toEqual([["decline"], ["reopen"]]);
        await optionOf(board, "database", "SQLite").click();
        await answerOf(board, "database").click();
        await card(board, "database").getByText("sent", { exact: true }).waitFor();
        await buttonOf(board, "database", "More").click();
        expect(await menuItem(board, "Decline").getAttribute("aria-disabled")).toBe("true");
        expect(await buttonOf(board, "database", "Postpone").isDisabled()).toBe(true);
        await board.page.keyboard.press("Escape");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Explain in submitted delivery is sent at once and disabled until the agent replies; the reply shows with its author and time and raises no notice",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, ["database", "cache", "audit"]);
        await optionOf(board, "database", "SQLite").click();
        await chooseFromMore(board, "database", "Explain");
        const [command] = await actsSent(run, 1);
        expect(command?.acts).toEqual([
          {
            type: "follow-up",
            itemId: "database",
            rev: 1,
            text: EXPLAIN,
            when: expect.any(String),
          },
        ]);
        await card(board, "database")
          .getByText("1 message", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await buttonOf(board, "database", "More").click();
        expect(await menuItem(board, "Explain").getAttribute("aria-disabled")).toBe("true");
        await board.page.keyboard.press("Escape");
        await reply(run, "database", "SQLite keeps it in one file; PostgreSQL scales writes.");
        await card(board, "database")
          .getByText("2 messages", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await buttonOf(board, "database", "More").click();
        await eventually(
          async () => (await menuItem(board, "Explain").getAttribute("aria-disabled")) === null,
          "Explain enabled again",
        );
        await board.page.keyboard.press("Escape");
        await buttonOf(board, "database", "Ask a follow-up").click();
        const thread = card(board, "database").getByRole("region", { name: "Follow-up" });
        await thread.getByText("Agent", { exact: true }).waitFor();
        await thread.getByText(EXPLAIN, { exact: true }).waitFor();
        const times = await thread.locator("time").allTextContents();
        expect(times).toHaveLength(2);
        for (const time of times) expect(time).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
        expect(await viewText(board, "The agent updated this").count()).toBe(0);
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in submitted delivery Decline on a sent postpone whose undo is held holds a decline over the undo; chosen again, the undo is back; Submit sends the decline, which closes the postponed question (AD-20)",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, ["database", "cache", "audit"]);
        await buttonOf(board, "audit", "Postpone").click();
        await barButton(board, "Submit").click();
        await actsSent(run, 1);
        // The postpone is sent and the board heard it: Postpone shows it, and can undo it.
        await eventually(
          async () =>
            (await barButton(board, "Submit").isDisabled()) &&
            !(await buttonOf(board, "audit", "Postpone").isDisabled()) &&
            (await pressed(board, "audit")) === "true",
          "the postpone sent",
        );
        await buttonOf(board, "audit", "Postpone").click();
        await outlineSays(board, "audit", "Unanswered");
        await chooseFromMore(board, "audit", "Decline");
        await outlineSays(board, "audit", "Declined");
        await chooseFromMore(board, "audit", "Decline");
        await outlineSays(board, "audit", "Unanswered");
        expect(await pressed(board, "audit")).toBe("false");
        await chooseFromMore(board, "audit", "Decline");
        await outlineSays(board, "audit", "Declined");
        expect(sentActs(run)).toHaveLength(1);
        await barButton(board, "Submit").click();
        const commands = await actsSent(run, 2);
        expect(commands[1]?.acts).toEqual([
          { type: "decline", itemId: "audit", rev: 1, when: expect.stringMatching(/Z$/) },
        ]);
        await card(board, "audit").getByText("sent", { exact: true }).waitFor();
        const { events } = await run.session.collect();
        expect(events).toEqual([
          expect.objectContaining({ type: "postponed", itemId: "audit" }),
          expect.objectContaining({ type: "answer", itemId: "audit", declined: true }),
        ]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "two rounds of follow-ups before answering: Enter adds a line, Ctrl+Enter and Send send at once, both follow-ups and replies show in order, replies as text",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        await buttonOf(board, "database", "Ask a follow-up").click();
        const composer = composerOf(board, "database");
        await eventually(() => focused(composer), "focus on the composer");
        await board.page.keyboard.type("Why");
        await board.page.keyboard.press("Enter");
        await board.page.keyboard.type("PostgreSQL?");
        expect(await composer.inputValue()).toBe("Why\nPostgreSQL?");
        expect(sentActs(run)).toEqual([]);
        await board.page.keyboard.press("Control+Enter");
        await actsSent(run, 1);
        await eventually(async () => (await composer.inputValue()) === "", "the composer cleared");
        await reply(run, "database", "<script>alert(1)</script>The team runs it.");
        await composer.fill("And SQLite?");
        await buttonOf(board, "database", "Send").click();
        await actsSent(run, 2);
        await reply(run, "database", "One file, one writer.");
        const thread = card(board, "database").getByRole("region", { name: "Follow-up" });
        await thread.getByText("4 messages", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
        const messages = await thread
          .locator("[data-askboard-message] > span + span")
          .allTextContents();
        expect(messages).toEqual([
          "Why\nPostgreSQL?",
          "<script>alert(1)</script>The team runs it.",
          "And SQLite?",
          "One file, one writer.",
        ]);
        const frame = await board.viewFrame();
        expect(await frame.evaluate(() => document.querySelectorAll("li script").length)).toBe(0);
        await optionOf(board, "database", "PostgreSQL").click();
        await answerOf(board, "database").click();
        await card(board, "database").getByText("sent", { exact: true }).waitFor();
        const { events } = await run.session.collect();
        expect(events.map((event) => event.type)).toEqual(["answer"]);
        expect(actTypes(run)).toEqual([["follow-up"], ["follow-up"], ["answer"]]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a reply that arrives for a question scrolled out of view: the header shows 1 new reply, and activating it brings the reply into view and clears the mark",
      async () => {
        const run = await start(lifecycleScenario(longAsk, dist));
        const ids = ["first", "second", "third", "fourth", "fifth", "sixth"];
        const board = await openBoard(run, ids);
        await buttonOf(board, "first", "Ask a follow-up").click();
        await composerOf(board, "first").fill("Is it needed for the pilot?");
        await buttonOf(board, "first", "Send").click();
        await actsSent(run, 1);
        await card(board, "sixth").scrollIntoViewIfNeeded();
        await eventually(
          async () =>
            !(await card(board, "first").isVisible()) || !(await inViewport(board, "first")),
          "the first question out of view",
        );
        await reply(run, "first", "Yes, the pilot needs it.");
        const count = board.header.getByRole("button", { name: "1 new reply" });
        await count.waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.view
          .locator('[data-askboard-outline="first"]')
          .getByText("↩ 1")
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await count.click();
        const latest = card(board, "first").getByText("Yes, the pilot needs it.", { exact: true });
        await latest.waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => inViewport(board, "first"), "the reply in view");
        await count.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// Whether any of a question's card shows inside the view's viewport.
const inViewport = (board: Board, id: string): Promise<boolean> =>
  card(board, id).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.bottom > 0 && box.top < window.innerHeight;
  });
