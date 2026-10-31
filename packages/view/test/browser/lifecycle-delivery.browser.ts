// Delivery modes, in each engine (ask-lifecycle, task 6.6; view spec: Delivery mode, Submit, Select
// recommended, Mode-switch confirmation, Leave-page prompt): the switch in the requested mode and
// hidden on the single-question board, a ready question made not ready by an edit, Submit as one
// command in the user's order, a note held alone until Submit, "Select recommended" never replacing
// a choice, Submit blocked by an agent-change notice on held work, and the mode-switch confirmation
// as a modal Alert Dialog whose scroll lock runs under the view's policy. Every scenario runs on the
// session process.

import { describe, expect, test } from "bun:test";
import {
  recommendedAsk,
  singleRequestingMoreAsk,
  submittedAsk,
  twoAsk,
} from "./fixtures/lifecycle-asks.ts";
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
  actsSent,
  answerOf,
  barButton,
  buttonOf,
  card,
  focused,
  headingOf,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
  sentActs,
  viewText,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const QUESTIONS = ["database", "cache", "audit"];

const mode = (board: Board, name: "Immediate" | "Submitted") => barButton(board, name);

const ready = async (board: Board, id: string, label: string) => {
  await optionOf(board, id, label).click({ timeout: STEP_TIMEOUT_MS });
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
  await eventually(
    async () => (await answerOf(board, id).getAttribute("aria-pressed")) === "true",
    `${id} ready`,
  );
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: delivery modes`, () => {
    const { start } = useEngine(engine);

    test(
      "the switch starts in the mode the ask requests, immediate by default, and the single-question board has none",
      async () => {
        const immediate = await start(lifecycleScenario(twoAsk, dist));
        const two = await openBoard(immediate, ["database", "cache"]);
        expect(await mode(two, "Immediate").getAttribute("aria-pressed")).toBe("true");
        await viewText(two, "Answers go to the agent as you give them.").waitFor();
        expect(await barButton(two, "Submit").isDisabled()).toBe(true);
        const submitted = await start(lifecycleScenario(submittedAsk, dist));
        const three = await openBoard(submitted, QUESTIONS);
        expect(await mode(three, "Submitted").getAttribute("aria-pressed")).toBe("true");
        const single = await start(lifecycleScenario(singleRequestingMoreAsk, dist));
        const one = await openBoard(single, ["database"]);
        expect(await viewText(one, "Delivery").count()).toBe(0);
        expect(await one.view.getByRole("button", { name: "Submit" }).count()).toBe(0);
        expect(await one.view.getByRole("button", { name: "Select recommended" }).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a ready question is no longer ready once its choice changes, and Submit would not send it",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        await ready(board, "database", "SQLite");
        expect(await barButton(board, "Submit").isDisabled()).toBe(false);
        await optionOf(board, "database", "PostgreSQL").click();
        await eventually(
          async () => (await answerOf(board, "database").getAttribute("aria-pressed")) === "false",
          "database not ready",
        );
        expect(await barButton(board, "Submit").isDisabled()).toBe(true);
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Submit sends two ready answers and a postpone as one command, in the order the user produced them, and the receipts show sent",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        await ready(board, "cache", "Yes");
        await ready(board, "database", "SQLite");
        await buttonOf(board, "audit", "Postpone").click();
        expect(sentActs(run)).toEqual([]);
        await board.header.getByText("Waiting", { exact: true }).waitFor();
        await barButton(board, "Submit").click();
        const [command] = await actsSent(run, 1);
        expect(command?.acts).toEqual([
          { type: "answer", itemId: "cache", rev: 1, choice: ["Yes"], when: expect.any(String) },
          {
            type: "answer",
            itemId: "database",
            rev: 1,
            choice: ["SQLite"],
            when: expect.any(String),
          },
          { type: "postpone", itemId: "audit", rev: 1 },
        ]);
        for (const id of ["cache", "database"]) {
          await card(board, id)
            .getByText("sent", { exact: true })
            .waitFor({ timeout: STEP_TIMEOUT_MS });
        }
        await board.header
          .getByText("answered, 1 postponed", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await barButton(board, "Submit").isDisabled()).toBe(true);
        const { events } = await run.session.collect();
        expect(events.map((event) => `${event.type}:${event.itemId}`)).toEqual([
          "answer:cache",
          "answer:database",
          "postponed:audit",
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note alone is held in submitted delivery and leaves only with Submit",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        await noteOf(board, "audit").fill("Ask the compliance team.");
        await answerOf(board, "audit").click();
        await eventually(
          async () => (await answerOf(board, "audit").getAttribute("aria-pressed")) === "true",
          "the note held",
        );
        await board.header.getByText("3 open", { exact: true }).waitFor();
        expect(sentActs(run)).toEqual([]);
        await barButton(board, "Submit").click();
        const [command] = await actsSent(run, 1);
        expect(command?.acts).toEqual([
          {
            type: "note",
            itemId: "audit",
            rev: 1,
            note: "Ask the compliance team.",
            when: expect.any(String),
          },
        ]);
        await eventually(
          async () => (await noteOf(board, "audit").inputValue()) === "",
          "the note to leave the draft",
        );
        const { events } = await run.session.collect();
        expect(events.map((event) => event.type)).toEqual(["note"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Select recommended keeps the user's choice, selects the others' recommendation and sends nothing; Submit sends the selection left in place",
      async () => {
        const run = await start(lifecycleScenario(recommendedAsk, dist));
        const board = await openBoard(run, ["database", "flag", "cache"]);
        await optionOf(board, "database", "SQLite").click();
        await barButton(board, "Select recommended").click();
        await eventually(() => optionOf(board, "flag", "Yes").isChecked(), "flag selected");
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(true);
        expect(await optionOf(board, "database", "PostgreSQL").isChecked()).toBe(false);
        expect(await optionOf(board, "cache", "Yes").isChecked()).toBe(false);
        expect(sentActs(run)).toEqual([]);
        await barButton(board, "Submit").click();
        const [command] = await actsSent(run, 1);
        expect(command?.acts).toEqual([
          { type: "answer", itemId: "flag", rev: 1, choice: ["Yes"], when: expect.any(String) },
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an agent-change notice on a question with a ready answer disables Submit; the bar says how many updates need a choice and jumps to the first",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        await ready(board, "cache", "Yes");
        await run.session.update([
          {
            action: "change",
            itemId: "cache",
            props: { text: "Should the order service cache reads for an hour?" },
          },
        ]);
        await viewText(board, "The agent updated this")
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await barButton(board, "Submit").isDisabled()).toBe(true);
        const updates = barButton(board, "1 update needs a choice");
        await updates.click();
        await eventually(() => focused(headingOf(board, "cache")), "focus on the changed question");
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "switching to immediate with held work asks in a modal dialog: cancelling sends nothing and stays submitted; confirming sends the held work and switches; the scroll lock raises no CSP violation",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        await ready(board, "database", "SQLite");
        await mode(board, "Immediate").click();
        const dialog = board.view.getByRole("alertdialog");
        await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        const frame = await board.viewFrame();
        await eventually(
          () => frame.evaluate(() => getComputedStyle(document.body).overflow === "hidden"),
          "the page behind the dialog locked",
        );
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await mode(board, "Submitted").getAttribute("aria-pressed")).toBe("true");
        expect(sentActs(run)).toEqual([]);
        await mode(board, "Immediate").click();
        await dialog.getByRole("button", { name: "Send and switch" }).click();
        const [command] = await actsSent(run, 1);
        expect(command?.acts).toEqual([
          {
            type: "answer",
            itemId: "database",
            rev: 1,
            choice: ["SQLite"],
            when: expect.any(String),
          },
        ]);
        await eventually(
          async () => (await mode(board, "Immediate").getAttribute("aria-pressed")) === "true",
          "immediate delivery",
        );
        await card(board, "database").getByText("sent", { exact: true }).waitFor();
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
