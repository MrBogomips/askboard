// The keyboard core over the lifecycle's controls, in each engine (ask-lifecycle, task 6.8; view
// spec: Keyboard core; EXPERIENCE.md, Accessibility Floor): a newly opened board ignores keys until
// the user focuses inside it; then, with the keyboard alone, the user answers, postpones, sends a
// follow-up, declines, submits and switches delivery, the focus ring showing on each control and
// focus moving to the question's heading after Postpone and Decline. Every scenario runs on the
// session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { submittedAsk } from "./fixtures/lifecycle-asks.ts";
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
  composerOf,
  focused,
  headingOf,
  lifecycleScenario,
  menuItem,
  openBoard,
  optionOf,
  sentActs,
  tabTo,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const QUESTIONS = ["database", "cache", "audit"];

// The focus ring shows on a control the keyboard focused (`{components.focus-ring}`).
const ringShown = (locator: Locator): Promise<boolean> =>
  locator.evaluate(
    (element) =>
      element.matches(":focus-visible") && getComputedStyle(element).outlineStyle !== "none",
  );

const outlineSays = (board: Board, id: string, label: string) =>
  board.view
    .locator(`[data-askboard-outline="${id}"]`)
    .getByText(label, { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the keyboard core`, () => {
    const { start } = useEngine(engine);

    test(
      "with the keyboard alone the user answers, postpones, sends a follow-up, declines, submits and switches delivery; focus moves to the heading after Postpone and Decline",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        const { keyboard } = board.page;
        // A newly opened board ignores keys until the user focuses inside it.
        for (const key of ["Enter", " ", "Control+Enter", "ArrowDown"]) await keyboard.press(key);
        expect(await optionOf(board, "database", "PostgreSQL").isChecked()).toBe(false);
        expect(sentActs(run)).toEqual([]);

        // Answer: the options are one Tab stop; the arrows move, Space selects, Enter answers.
        await headingOf(board, "database").focus();
        await tabTo(board, optionOf(board, "database", "PostgreSQL"));
        await keyboard.press("ArrowDown");
        await eventually(() => focused(optionOf(board, "database", "SQLite")), "focus on SQLite");
        expect(await optionOf(board, "database", "SQLite").isChecked()).toBe(false);
        await keyboard.press(" ");
        await eventually(() => optionOf(board, "database", "SQLite").isChecked(), "SQLite chosen");
        await tabTo(board, answerOf(board, "database"));
        expect(await ringShown(answerOf(board, "database"))).toBe(true);
        await keyboard.press("Enter");
        await outlineSays(board, "database", "Ready");

        // Postpone, then focus on the question's heading.
        await tabTo(board, buttonOf(board, "cache", "Postpone"));
        expect(await ringShown(buttonOf(board, "cache", "Postpone"))).toBe(true);
        await keyboard.press("Enter");
        await eventually(() => focused(headingOf(board, "cache")), "focus on the cache heading");
        await outlineSays(board, "cache", "Postponed");

        // A follow-up: Enter on "Ask a follow-up" opens the composer; Ctrl+Enter sends at once.
        await tabTo(board, buttonOf(board, "audit", "Ask a follow-up"));
        await keyboard.press("Enter");
        await eventually(() => focused(composerOf(board, "audit")), "focus on the composer");
        await keyboard.type("Who owns the audit log?");
        await keyboard.press("Control+Enter");
        const [followUp] = await actsSent(run, 1);
        expect(followUp?.acts).toEqual([
          {
            type: "follow-up",
            itemId: "audit",
            rev: 1,
            text: "Who owns the audit log?",
            when: expect.any(String),
          },
        ]);

        // Decline through "More": Enter opens the menu, the arrows move, Enter chooses.
        await tabTo(board, buttonOf(board, "audit", "More"), { backward: true });
        await keyboard.press("Enter");
        await eventually(() => focused(menuItem(board, "Explain")), "focus on Explain");
        await keyboard.press("ArrowDown");
        await eventually(() => focused(menuItem(board, "Decline")), "focus on Decline");
        await keyboard.press("Enter");
        await eventually(() => focused(headingOf(board, "audit")), "focus on the audit heading");
        await outlineSays(board, "audit", "Declined");
        expect(sentActs(run)).toHaveLength(1);

        // Submit: one command, in the order the user produced the acts.
        await tabTo(board, barButton(board, "Submit"));
        expect(await ringShown(barButton(board, "Submit"))).toBe(true);
        await keyboard.press("Enter");
        const [, submitted] = await actsSent(run, 2);
        expect(submitted?.acts.map((act) => `${act.type}:${act.itemId}`)).toEqual([
          "answer:database",
          "postpone:cache",
          "decline:audit",
        ]);
        await card(board, "database").getByText("sent", { exact: true }).waitFor();
        await eventually(() => barButton(board, "Submit").isDisabled(), "nothing held");

        // The delivery switch: with nothing held, Enter switches at once.
        await tabTo(board, barButton(board, "Immediate"), { backward: true });
        await keyboard.press("Enter");
        await eventually(
          async () => (await barButton(board, "Immediate").getAttribute("aria-pressed")) === "true",
          "immediate delivery",
        );
        expect(sentActs(run)).toHaveLength(2);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent-change choices and the mode-switch confirmation work from the keyboard",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        const { keyboard } = board.page;
        await headingOf(board, "cache").focus();
        await tabTo(board, optionOf(board, "cache", "Yes"));
        await keyboard.press("Enter");
        await tabTo(board, answerOf(board, "cache"));
        await keyboard.press("Enter");
        await outlineSays(board, "cache", "Ready");
        await run.session.update([
          {
            action: "change",
            itemId: "cache",
            props: { text: "Should it cache reads for an hour?" },
          },
        ]);
        const keep = card(board, "cache").getByRole("button", { name: "Keep mine" });
        await keep.waitFor({ timeout: STEP_TIMEOUT_MS });
        // The notice took no focus; from the question's heading it is just before it.
        expect(await focused(keep)).toBe(false);
        await headingOf(board, "cache").focus();
        await tabTo(board, keep, { backward: true });
        await keyboard.press("Enter");
        await actsSent(run, 1);
        await keep.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(async () => !(await barButton(board, "Submit").isDisabled()), "Submit");
        await tabTo(board, barButton(board, "Immediate"));
        await keyboard.press("Enter");
        const dialog = board.view.getByRole("alertdialog");
        await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        // Focus stays in the dialog; Escape cancels and sends nothing.
        await keyboard.press("Tab");
        await keyboard.press("Tab");
        expect(
          await dialog.evaluate((element) => element.contains(element.ownerDocument.activeElement)),
        ).toBe(true);
        await keyboard.press("Escape");
        await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(sentActs(run)).toHaveLength(1);
        await tabTo(board, barButton(board, "Immediate"));
        await keyboard.press("Enter");
        await tabTo(board, dialog.getByRole("button", { name: "Send and switch" }));
        await keyboard.press("Enter");
        const [, sent] = await actsSent(run, 2);
        expect(sent?.acts).toEqual([
          { type: "answer", itemId: "cache", rev: 1, choice: ["Yes"], when: expect.any(String) },
        ]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
