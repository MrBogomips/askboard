// The answer key, in each engine and on the session process (board-keys, task 4.2; spec
// view-and-widgets: Answer by key, A blocked answer by key, Follow-up thread): `Mod+Enter` on a
// question's own controls takes the primary button's path, says why it sent nothing, and never
// sends what the user did not choose (NFR-10). Each primary is found by `[data-askboard-primary]`
// inside its card, and each case counts the act commands the board page sent.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/answer-key.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { answerKeyAsk } from "./fixtures/answer-key-asks.ts";
import { singleAnsweringAsk } from "./fixtures/answering-flow-asks.ts";
import { reviewedAsk } from "./fixtures/approval-asks.ts";
import { planAsk } from "./fixtures/widget-asks.ts";
import { decisionOf } from "./harness/approval-board.ts";
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
  actsDone,
  actsSent,
  buttonOf,
  card,
  composerOf,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { hostSettled, viewSettled } from "./harness/probes.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const IDS = ["db", "regions", "cache", "fields"];
const MOD_ENTER = "Control+Enter";

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  delivery: "immediate" | "submitted" = "immediate",
  config?: { readonly user?: unknown },
) => {
  const scenario = lifecycleScenario(
    answerKeyAsk(delivery, config === undefined ? "a1" : "n1"),
    dist,
  );
  const run = await start(config === undefined ? scenario : { ...scenario, config });
  return { run, board: await openBoard(run, IDS) };
};

/** A card's primary button, found by its attribute. */
const primaryOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-primary]");

/** The region's text once a message is there; the region is empty until something is said. */
const said = async (board: Board, text: string): Promise<void> =>
  eventually(async () => ((await board.status.textContent()) ?? "") === text, `"${text}" said`);

const choose = async (board: Board, id: string, label: string): Promise<void> => {
  await optionOf(board, id, label).check({ timeout: STEP_TIMEOUT_MS });
};

/** What the board page sent of the answers, as JSON text, for a content check. */
const sentText = (run: Parameters<typeof sentActs>[0]): string => JSON.stringify(sentActs(run));

/** A key that must do nothing: pressed, the page and the host settled, no command more. */
const expectSent = async (board: Board, run: Parameters<typeof sentActs>[0], count: number) => {
  await viewSettled(board);
  await hostSettled(board);
  expect(sentActs(run)).toHaveLength(count);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: Answer by key`, () => {
    const { start } = useEngine(engine);

    test(
      "immediate delivery: the choice is sent, the focused option is not selected, focus is on the heading, one command",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "db", "PostgreSQL");
        await optionOf(board, "db", "SQLite").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await actsSent(run, 1);
        await eventually(() => isFocused(headingOf(board, "db")), "focus on the heading");
        expect(sentText(run)).toContain("PostgreSQL");
        expect(sentText(run)).not.toContain("SQLite");
        await expectSent(board, run, 1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "submitted delivery: the answer is marked ready, the region says so, nothing is sent",
      async () => {
        const { run, board } = await open(start, "submitted");
        await choose(board, "db", "PostgreSQL");
        await board.page.keyboard.press(MOD_ENTER);
        await said(board, "Answer ready, not sent. 1 ready.");
        expect(await primaryOf(board, "db").getAttribute("aria-pressed")).toBe("true");
        await expectSent(board, run, 0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a multiple choice's box is not flipped by the key, and the answer keeps what was chosen",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "regions", "Frankfurt");
        await optionOf(board, "regions", "Oslo").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await actsSent(run, 1);
        expect(await optionOf(board, "regions", "Oslo").isChecked()).toBe(false);
        expect(sentText(run)).toContain("Frankfurt");
        expect(sentText(run)).not.toContain("Oslo");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "on a focused Postpone the question is answered, not postponed",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "db", "PostgreSQL");
        await buttonOf(board, "db", "Postpone").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await actsSent(run, 1);
        const acts = sentActs(run).flatMap((command) => command.acts.map((act) => act.type));
        expect(acts).toEqual(["answer"]);
        await expectSent(board, run, 1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the single-question board answers from the heading",
      async () => {
        const run = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const board = await openBoard(run, ["only"]);
        await optionOf(board, "only", "Yes").check({ timeout: STEP_TIMEOUT_MS });
        await headingOf(board, "only").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await actsSent(run, 1);
        await expectSent(board, run, 1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Tree: Mod+Enter on a row sends nothing",
      async () => {
        const run = await start(lifecycleScenario(planAsk, dist));
        const board = await openBoard(run, ["plan"]);
        const tree = treeGridOf(board);
        await tree.grid.waitFor({ timeout: STEP_TIMEOUT_MS });
        // A press on a row marks it current; the grid keeps the focus.
        await tree.cell("design", 0).click({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press(MOD_ENTER);
        await expectSent(board, run, 0);
        // The Tree's own Mod+Shift+Enter is not handled by the Tree yet (no handler reads
        // `add.child`), so only the card's half is checked here.
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a received verdict: the dialog opens, Cancel gives focus back to where the key was pressed, nothing is sent",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("immediate"), dist));
        const board = await openBoard(run, ["plan", "review"]);
        await decisionOf(board, "plan", "Approve").click({ timeout: STEP_TIMEOUT_MS });
        await primaryOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collectJson();
        await card(board, "plan")
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await decisionOf(board, "plan", "Reject").click({ timeout: STEP_TIMEOUT_MS });
        // A widget's own controls keep the key; the card's heading is where it acts.
        const revised = headingOf(board, "plan");
        await revised.focus();
        await board.page.keyboard.press(MOD_ENTER);
        const dialog = board.view.getByRole("alertdialog");
        await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(revised), "focus back where the key was pressed");
        await expectSent(board, run, 1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a held key answers once: the repeats on the heading and on the next question's option do nothing",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "db", "PostgreSQL");
        await choose(board, "cache", "Yes");
        await optionOf(board, "db", "SQLite").focus();
        await board.page.keyboard.down("Control");
        await board.page.keyboard.down("Enter");
        await actsSent(run, 1);
        await eventually(() => isFocused(headingOf(board, "db")), "focus on the heading");
        // Playwright sends the second down of a key already down with `repeat: true`.
        await board.page.keyboard.down("Enter");
        await optionOf(board, "cache", "Yes").focus();
        await board.page.keyboard.down("Enter");
        await board.page.keyboard.up("Enter");
        await board.page.keyboard.up("Control");
        await expectSent(board, run, 1);
        expect(sentText(run)).not.toContain("cache");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a user file giving the answer no key: Mod+Enter does nothing",
      async () => {
        const { run, board } = await open(start, "immediate", {
          user: { version: "1.0", keys: { "board.answer": [] } },
        });
        await choose(board, "db", "PostgreSQL");
        await eventually(
          async () => (await primaryOf(board, "db").getAttribute("aria-keyshortcuts")) === null,
          "no key on the primary",
        );
        await board.page.keyboard.press(MOD_ENTER);
        await expectSent(board, run, 0);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: A blocked answer by key`, () => {
    const { start } = useEngine(engine);

    test(
      "nothing chosen: the region says to choose first, nothing is sent",
      async () => {
        const { run, board } = await open(start);
        await optionOf(board, "db", "PostgreSQL").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await said(board, "Not answered. Choose an answer or write a note first.");
        await expectSent(board, run, 0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an agent change waiting: the region says to choose what to do first, nothing is sent, Keep mine stays unchosen",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "db", "PostgreSQL");
        await run.session.update([
          {
            action: "change",
            itemId: "db",
            props: {
              text: "Which database now?",
              options: [{ label: "PostgreSQL" }, { label: "SQLite" }],
            },
          },
        ]);
        const notice = card(board, "db").locator('[data-askboard-notice="agent-change"]');
        await notice.waitFor({ timeout: STEP_TIMEOUT_MS });
        await optionOf(board, "db", "SQLite").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await said(board, "Not answered. Choose what to do with the agent's update first.");
        expect(await notice.count()).toBe(1);
        await expectSent(board, run, 0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a field to fix: the region gives its reason, nothing is sent",
      async () => {
        const { run, board } = await open(start);
        await card(board, "fields")
          .getByRole("textbox", { name: /Service name/ })
          .fill("a");
        await card(board, "fields")
          .getByRole("textbox", { name: /Service name/ })
          .fill("");
        await headingOf(board, "fields").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await eventually(
          async () => ((await board.status.textContent()) ?? "").startsWith("Not answered."),
          "the blocked message",
        );
        await expectSent(board, run, 0);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: Follow-up thread`, () => {
    const { start } = useEngine(engine);

    test(
      "Enter adds a line, Mod+Enter sends the follow-up and answers nothing",
      async () => {
        const { run, board } = await open(start);
        await choose(board, "db", "PostgreSQL");
        await buttonOf(board, "db", "Ask a follow-up").click();
        const composer = composerOf(board, "db");
        await eventually(() => isFocused(composer), "focus on the composer");
        await board.page.keyboard.type("Why");
        await board.page.keyboard.press("Enter");
        await board.page.keyboard.type("this one?");
        expect(await composer.inputValue()).toBe("Why\nthis one?");
        expect(sentActs(run)).toHaveLength(0);
        await board.page.keyboard.press(MOD_ENTER);
        await actsSent(run, 1);
        const acts = sentActs(run).flatMap((command) => command.acts.map((act) => act.type));
        expect(acts).toEqual(["follow-up"]);
        await expectSent(board, run, 1);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
