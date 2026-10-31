// The view spec's scenarios about the single-question board and answering, in each engine
// (specs/view-and-widgets): the plain-choice board, nothing chosen for the user, keys ignored until
// the user acts inside a new board, the draft, the answer and its receipt, the keyboard path, no
// browser storage, and a reload.

import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  answerWith,
  type BoardRun,
  enabledCount,
  eventually,
  expectNoCspProblem,
  expectNoTokenInView,
  expectPageHalf,
  isFocused,
  linkToken,
  QUESTION,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const { opening, answered, collected, reload } = replayTranscripts;
const [question] = plainChoiceBoardDocument.items;
const labels = question.props.options.map((option) => option.label);

const visible = (locator: ReturnType<Board["receipt"]>) =>
  locator.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });

// No option and no "Answer" the user can act on.
const expectReadOnly = async (board: Board) => {
  const enabled = {
    options: await enabledCount(board.options),
    answers: await enabledCount(board.answer),
  };
  expect(enabled).toEqual({ options: 0, answers: 0 });
};

// Only the connect has left the page: the board sent nothing for the user.
const expectOnlyConnect = async (run: BoardRun) => {
  await Bun.sleep(300);
  expect(run.browser.pageMessages().map(({ message }) => message)).toEqual([
    { version: "1.0", type: "connect", token: linkToken(run) },
  ]);
};

const checkedCount = async (board: Board) => {
  let checked = 0;
  for (const label of labels) if (await board.option(label).isChecked()) checked += 1;
  return checked;
};

// Presses Tab until the predicate holds for the focused element of the view, at most ten times.
const tabUntil = async (board: Board, matches: () => Promise<boolean>, what: string) => {
  for (let presses = 0; presses < 10; presses += 1) {
    await board.page.keyboard.press("Tab");
    if (await matches()) return;
  }
  throw new Error(`ten presses of Tab never reached ${what}`);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the board`, () => {
    const { start } = useEngine(engine);

    test(
      "the plain-choice board: tab title, header, chip, three options with descriptions",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        expect(await board.page.title()).toBe(`${plainChoiceBoardDocument.title} · AskBoard`);
        await board.header
          .getByText("Waiting", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.header.textContent()).toContain(plainChoiceBoardDocument.title);
        const card = board.question(QUESTION);
        await card.getByText("Database", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await card.getByText(question.props.text, { exact: true }).count()).toBeGreaterThan(
          0,
        );
        expect(await board.options.count()).toBe(3);
        for (const option of question.props.options) {
          await board.option(option.label).waitFor({ timeout: STEP_TIMEOUT_MS });
          await card.getByText(option.description ?? "").waitFor({ timeout: STEP_TIMEOUT_MS });
        }
        // The single-question board has no outline, delivery switch or Submit (EXPERIENCE).
        expect(await board.view.getByRole("navigation").count()).toBe(0);
        expect(await board.view.getByRole("switch").count()).toBe(0);
        expect(await board.view.getByRole("button", { name: "Submit" }).count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the board opens with no option selected and Answer disabled",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        expect(await checkedCount(board)).toBe(0);
        expect(await board.answer.isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a newly opened board ignores keys until the user clicks or focuses inside it",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        for (const key of ["Space", "Enter", "ArrowDown", "ArrowUp", "Home", "End", "1", "a"]) {
          await board.page.keyboard.press(key);
        }
        expect(await checkedCount(board)).toBe(0);
        expect(await board.answer.isDisabled()).toBe(true);
        const view = await board.viewFrame();
        expect(await view.evaluate(() => document.activeElement === document.body)).toBe(true);
        await expectOnlyConnect(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the arrow keys move focus only: nothing is selected and nothing is sent",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        await board.option(labels[0] ?? "").focus();
        for (const [key, label] of [
          ["ArrowDown", labels[1]],
          ["ArrowDown", labels[2]],
          ["ArrowUp", labels[1]],
        ] as const) {
          await board.page.keyboard.press(key);
          await eventually(() => isFocused(board.option(label ?? "")), `${key} to focus ${label}`);
          expect(await checkedCount(board)).toBe(0);
        }
        expect(await board.answer.isDisabled()).toBe(true);
        await expectOnlyConnect(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a choice goes into the draft: the option is selected, Answer enabled, nothing sent",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        await board.option("PostgreSQL").click({ timeout: STEP_TIMEOUT_MS });
        expect(await board.option("PostgreSQL").isChecked()).toBe(true);
        expect(await checkedCount(board)).toBe(1);
        expect(await board.answer.isEnabled()).toBe(true);
        await expectOnlyConnect(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the user answers: one answer command, the receipt at sent, the header Answered",
      async () => {
        const run = await start({ transcript: answered, view: dist });
        const board = await run.open();
        const clicked = await answerWith(board, "PostgreSQL");
        await visible(board.receipt("sent"));
        await board.header
          .getByText("Answered", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectReadOnly(board);
        expectPageHalf(run, clicked);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent collects: the receipt changes from sent to delivered to the agent",
      async () => {
        const run = await start({ transcript: collected, view: dist });
        const board = await run.open();
        const clicked = await answerWith(board, "PostgreSQL");
        await visible(board.receipt("sent"));
        await run.session.collected();
        await visible(board.receipt("delivered to the agent"));
        expect(await board.receipt("sent").count()).toBe(0);
        expectPageHalf(run, clicked);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "answering with the keyboard only: Tab to the options, Space, Tab to Answer, Enter",
      async () => {
        const run = await start({ transcript: answered, view: dist });
        const board = await run.open();
        const view = await board.viewFrame();
        await tabUntil(
          board,
          () => view.evaluate(() => document.activeElement?.getAttribute("role") === "radio"),
          "an option",
        );
        const ring = await view.evaluate(() => {
          const style = getComputedStyle(document.activeElement ?? document.body);
          return style.outlineStyle !== "none" || style.boxShadow !== "none";
        });
        expect(ring).toBe(true);
        await board.page.keyboard.press("Space");
        expect(await board.option("PostgreSQL").isChecked()).toBe(true);
        await tabUntil(board, () => isFocused(board.answer), "Answer");
        const from = Date.now();
        await board.page.keyboard.press("Enter");
        const clicked = { from, to: Date.now() };
        await visible(board.receipt("sent"));
        expectPageHalf(run, clicked);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after answering, the board origin's Web Storage, IndexedDB and cookies are empty",
      async () => {
        const run = await start({ transcript: answered, view: dist });
        const board = await run.open();
        await answerWith(board, "PostgreSQL");
        await visible(board.receipt("sent"));
        const state = await run.browser.context.storageState({ indexedDB: true });
        expect(state).toEqual({ cookies: [], origins: [] });
        const page = await board.page.evaluate(() => ({
          local: localStorage.length,
          session: sessionStorage.length,
          cookie: document.cookie,
        }));
        expect(page).toEqual({ local: 0, session: 0, cookie: "" });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a reload: the board comes back answered, delivered to the agent, read-only, with no token in the view",
      async () => {
        const run = await start({ transcript: reload, view: dist });
        const board = await run.open();
        await expectNoTokenInView(board, run);
        const clicked = await answerWith(board, "PostgreSQL");
        await visible(board.receipt("sent"));
        await run.session.collected();
        await visible(board.receipt("delivered to the agent"));
        await board.page.reload();
        await board.loaded(QUESTION).waitFor({ timeout: STEP_TIMEOUT_MS * 2 });
        await visible(board.receipt("delivered to the agent"));
        await board.header
          .getByText("Answered", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.option("PostgreSQL").isChecked()).toBe(true);
        await expectReadOnly(board);
        await expectNoTokenInView(board, run);
        await Bun.sleep(QUIET_MS);
        expect(await board.banner(/moved/i).count()).toBe(0);
        expectPageHalf(run, clicked);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
