// Revisions and the agent's changes, in each engine (ask-lifecycle, task 6.7; view spec: Revising
// an answer, Agent changes without unsent work, Agent-change notice, Reopened question, Recorded
// answers on the board, Draft mirror and restore): a revision after delivery and its receipts, a
// change shown in place, a deleted question gone with its draft while one question per view moves
// on, the notice with both choices and the answer naming the kept revision, the reopened question,
// a recorded answer counted as answered, and restored work on a changed question raising the
// notice. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { onePerViewAsk, singleAsk, twoAsk } from "./fixtures/lifecycle-asks.ts";
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
  actsSent,
  answerOf,
  buttonOf,
  card,
  focused,
  headingOf,
  lifecycleScenario,
  mirrored,
  noteOf,
  openBoard,
  optionOf,
  sentActs,
  viewText,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const CHANGED = "Which database should the order service use from next quarter?";

const notice = (board: Board, id: string) =>
  card(board, id).locator('[data-askboard-notice="agent-change"]');

// The agent changes the database question's text: a new revision.
const changeDatabase = (run: {
  session: { update(actions: readonly unknown[]): Promise<unknown> };
}) => run.session.update([{ action: "change", itemId: "database", props: { text: CHANGED } }]);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: revisions and agent changes`, () => {
    const { start } = useEngine(engine);

    test(
      "a revision after delivery is sent, its receipt shows sent, then delivered to the agent once collected",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        await optionOf(board, "database", "PostgreSQL").click();
        await answerOf(board, "database").click();
        await card(board, "database").getByText("sent", { exact: true }).waitFor();
        await actsDone(run, 1);
        await run.session.collect();
        await card(board, "database")
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await answerOf(board, "database").isDisabled()).toBe(true);
        await optionOf(board, "database", "SQLite").click();
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
        await answerOf(board, "database").click();
        await card(board, "database")
          .getByText("sent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const [, revision] = await actsDone(run, 2);
        expect(revision?.acts).toEqual([
          {
            type: "answer",
            itemId: "database",
            rev: 1,
            choice: ["SQLite"],
            when: expect.any(String),
          },
        ]);
        const { events } = await run.session.collect();
        expect(events).toEqual([
          expect.objectContaining({
            type: "answer",
            choice: ["SQLite"],
            replaces: expect.any(String),
          }),
        ]);
        await card(board, "database")
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent's change to a question without unsent work shows in place, with no notice",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await changeDatabase(run);
        await headingOf(board, "database")
          .getByText(CHANGED, { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await viewText(board, "The agent updated this").count()).toBe(0);
        expect(await notice(board, "database").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a deleted question disappears with its draft; in one question per view the navigator moves on, says Question removed by the agent, and the focus goes to the next heading",
      async () => {
        const run = await start(lifecycleScenario(onePerViewAsk, dist));
        const board = await openBoard(run, ["q1", "q2", "q3", "q4", "q5"]);
        const navigator = board.view.getByRole("navigation", { name: "Question navigator" });
        await navigator.getByRole("button", { name: "Next", exact: true }).click();
        await navigator.getByText("Question 2 of 5", { exact: true }).waitFor();
        await noteOf(board, "q2").fill("Unsent on q2.");
        await mirrored(run, (record) => record.questions.q2 !== undefined, "the note on q2");
        await run.session.update([{ action: "delete", itemId: "q2" }]);
        await navigator
          .getByText("Question removed by the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await navigator.getByText("Question 2 of 4", { exact: true }).waitFor();
        expect(await card(board, "q2").count()).toBe(0);
        await eventually(() => focused(headingOf(board, "q3")), "focus on the next question");
        await mirrored(
          run,
          (record) => record.questions.q2 === undefined && record.inView === "q3",
          "the draft without q2",
        );
        await board.header.getByText("4 open", { exact: true }).waitFor();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent changes a question with unsent work: the notice, inline and not taking focus; Show the agent's change; Reload, losing my work sends a reload and drops the draft",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await optionOf(board, "database", "SQLite").click();
        await noteOf(board, "cache").focus();
        await changeDatabase(run);
        await notice(board, "database").waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice(board, "database").getByText("Your 1 change on this question").waitFor();
        expect(await focused(noteOf(board, "cache"))).toBe(true);
        await board.header.getByRole("button", { name: "The agent updated this" }).waitFor();
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
        await notice(board, "database")
          .getByRole("button", { name: "Show the agent's change" })
          .click();
        await notice(board, "database").locator("ins").getByText(CHANGED).waitFor();
        await notice(board, "database")
          .locator("del")
          .getByText("Which database should the order service use?")
          .waitFor();
        await notice(board, "database")
          .getByRole("button", { name: "Reload, losing my work" })
          .click();
        const [command] = await actsDone(run, 1);
        expect(command?.acts).toEqual([
          { type: "edit-choice", itemId: "database", rev: 2, edit: "reload" },
        ]);
        await notice(board, "database").waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await headingOf(board, "database").getByText(CHANGED, { exact: true }).waitFor();
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(false);
        const { events } = await run.session.collect();
        expect(events).toEqual([
          expect.objectContaining({ type: "edit-choice", edit: "reload", rev: 2 }),
        ]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Keep mine sends an ignore first, then the answer naming the earlier revision",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await optionOf(board, "database", "SQLite").click();
        await changeDatabase(run);
        await notice(board, "database").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await answerOf(board, "database").isDisabled()).toBe(true);
        await notice(board, "database").getByRole("button", { name: "Keep mine" }).click();
        await notice(board, "database").waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "database").click();
        await card(board, "database").getByText("sent", { exact: true }).waitFor();
        await actsDone(run, 2);
        expect(sentActs(run).map((command) => command.acts)).toEqual([
          [{ type: "edit-choice", itemId: "database", rev: 2, edit: "ignore", keptRev: 1 }],
          [
            {
              type: "answer",
              itemId: "database",
              rev: 1,
              choice: ["SQLite"],
              when: expect.any(String),
            },
          ],
        ]);
        const { events } = await run.session.collect();
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a reopened and reworded question shows Reopened by the agent, nothing chosen and the previous answer; Start from my previous answer fills the draft and sends nothing until Answer",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await optionOf(board, "database", "PostgreSQL").click();
        await answerOf(board, "database").click();
        await card(board, "database").getByText("sent", { exact: true }).waitFor();
        await actsDone(run, 1);
        // Reopened and reworded in one update: the question changed, so it starts from the agent's
        // version, not from the previous answer (reopen-start-from-answer, design decision 3).
        await run.session.update([
          { action: "reopen", itemId: "database" },
          { action: "change", itemId: "database", props: { text: "Which database now?" } },
        ]);
        const reopened = card(board, "database").locator('[data-askboard-notice="reopened"]');
        await reopened.getByText("Reopened by the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await reopened.getByText("PostgreSQL", { exact: true }).waitFor();
        await reopened.getByText("starts from the agent's version", { exact: false }).waitFor();
        expect(await optionOf(board, "database", "PostgreSQL").isChecked()).toBe(false);
        expect(await answerOf(board, "database").isDisabled()).toBe(true);
        await reopened.getByRole("button", { name: "Start from my previous answer" }).click();
        await eventually(() => optionOf(board, "database", "PostgreSQL").isChecked(), "the choice");
        expect(sentActs(run)).toHaveLength(1);
        await answerOf(board, "database").click();
        const [, again] = await actsSent(run, 2);
        expect(again?.acts).toEqual([
          {
            type: "answer",
            itemId: "database",
            rev: 3,
            choice: ["PostgreSQL"],
            when: expect.any(String),
          },
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent records an answer to a postponed question: the board shows it answered with that answer, and the postponed count drops",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await buttonOf(board, "database", "Postpone").click();
        await board.view
          .getByText("You have 1 postponed question: closing loses this ask", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.update([
          { action: "answer", itemId: "database", answer: { choice: ["SQLite"] } },
        ]);
        await board.view
          .locator('[data-askboard-outline="database"]')
          .getByText("Answered", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
        expect(
          await board.view
            .getByText("You have 1 postponed question: closing loses this ask", { exact: true })
            .count(),
        ).toBe(0);
        await board.header.getByText("1 open", { exact: true }).waitFor();
        await board.header.getByText("Partly answered 1/2", { exact: true }).waitFor();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "work restored for a question the agent changed meanwhile raises the notice",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const first = await openBoard(run, ["database", "cache"]);
        await optionOf(first, "database", "SQLite").click();
        await mirrored(
          run,
          (record) => record.questions.database?.values?.database !== undefined,
          "the choice",
        );
        await first.page.close();
        await changeDatabase(run);
        const board = await openBoard(run, ["database", "cache"]);
        await notice(board, "database").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
