// The board's keys, in each engine and on the session process (board-keys, task 3.4; spec
// view-and-widgets: Next and previous open by key, The board's keys are discoverable, The board's
// keys panel, The user's keys on the board's own keys): `N`, `Shift+N` and `?` outside text fields
// and widgets, the header's "Keys" and the user's file's keys. Every scenario runs on the session
// process; a jump is read from the focus that lands on a heading clear of the sticky bars.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/board-keys.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { singleAnsweringAsk } from "./fixtures/answering-flow-asks.ts";
import { boardKeysAsk, KEYS_QUESTIONS, type Presentation } from "./fixtures/board-keys-asks.ts";
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
  card,
  headingOf,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { viewSettled } from "./harness/probes.ts";
import { orderShown, rowOf } from "./harness/ranking-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const IDS = [...KEYS_QUESTIONS];

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  presentation: Presentation,
  config?: { readonly user?: unknown },
) => {
  const scenario = lifecycleScenario(
    boardKeysAsk(presentation, config === undefined ? "a1" : "j1"),
    dist,
  );
  const run = await start(config === undefined ? scenario : { ...scenario, config });
  return { run, board: await openBoard(run, IDS) };
};

const boardPanel = (board: Board): Locator =>
  board.view.getByRole("dialog", { name: "Board keys" });
const keysButton = (board: Board): Locator =>
  board.view.getByRole("banner").getByRole("button", { name: "Keys", exact: true });

type Box = { readonly top: number; readonly bottom: number };
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`no box for ${locator}`);
  return { top: box.y, bottom: box.y + box.height };
};

/** The heading has focus and lies wholly between the header's bottom and the bottom bar's top. */
const expectClearOfBars = async (board: Board, id: string): Promise<void> => {
  const heading = headingOf(board, id);
  await eventually(() => isFocused(heading), `focus on the ${id} heading`);
  const bounds = {
    header: await boxOf(board.view.getByRole("banner")),
    bar: await boxOf(board.view.getByRole("contentinfo")),
  };
  await eventually(async () => {
    const box = await boxOf(heading);
    return box.top >= bounds.header.bottom && box.bottom <= bounds.bar.top;
  }, `the ${id} heading between the header and the bottom bar`);
};

/** Focuses an option and waits until the view has taken its question as the one in view. */
const focusOption = async (board: Board, id: string): Promise<Locator> => {
  const option = optionOf(board, id, "Yes");
  await option.focus();
  await viewSettled(board);
  return option;
};

/** A key the view must leave alone: pressed, settled, and the focus did not move. */
const expectKeyIgnored = async (board: Board, key: string, held: Locator): Promise<void> => {
  await board.page.keyboard.press(key);
  await viewSettled(board);
  expect(await isFocused(held)).toBe(true);
  expect(await boardPanel(board).count()).toBe(0);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the board's keys`, () => {
    const { start } = useEngine(engine);

    test(
      "from an option, N, Shift+N and Shift+N go to the next, the previous and the last question, each heading clear of the bars",
      async () => {
        const { run, board } = await open(start, "sections");
        await focusOption(board, "q1");
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "q2");
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q1");
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q4");
        await viewSettled(board);
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "q1");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: N shows the next question",
      async () => {
        const { board } = await open(start, "one-per-view");
        await focusOption(board, "q1");
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "q2");
        expect(await card(board, "q2").isVisible()).toBe(true);
        expect(await card(board, "q1").isVisible()).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "tabs: N crosses to the other area, which becomes the active tab",
      async () => {
        const { board } = await open(start, "tabs");
        await focusOption(board, "q2");
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "rank");
        await eventually(
          async () =>
            (await board.view.getByRole("tab", { name: /^Data/ }).getAttribute("aria-selected")) ===
            "true",
          "the Data tab active",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "'n' typed in the note and in Other… is text: nothing moves",
      async () => {
        const { board } = await open(start, "sections");
        const note = noteOf(board, "q1");
        await note.focus();
        await board.page.keyboard.type("n N");
        await viewSettled(board);
        expect(await note.inputValue()).toBe("n N");
        expect(await isFocused(note)).toBe(true);
        await optionOf(board, "q1", "Other…").click();
        const other = card(board, "q1").getByRole("textbox").first();
        await other.focus();
        await board.page.keyboard.type("n");
        await viewSettled(board);
        expect(await other.inputValue()).toContain("n");
        expect(await isFocused(other)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Ranking's row: N moves nothing, and ? opens the Ranking's panel, not the board's",
      async () => {
        const { board } = await open(start, "sections");
        const before = await orderShown(board);
        const row = rowOf(board, "c");
        await row.focus();
        await viewSettled(board);
        await board.page.keyboard.press("n");
        await viewSettled(board);
        expect(await orderShown(board)).toEqual(before);
        expect(await isFocused(row)).toBe(true);
        await board.page.keyboard.press("?");
        await board.view
          .getByRole("dialog", { name: "Ranking keys" })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await boardPanel(board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a newly opened board hears nothing until the user clicks or tabs into it",
      async () => {
        const { board } = await open(start, "sections");
        await board.page.keyboard.press("n");
        await viewSettled(board);
        for (const id of IDS) expect(await isFocused(headingOf(board, id))).toBe(false);
        // After a click on blank space, the key reaches the view's document.
        await board.view.locator("main").click({ position: { x: 2, y: 2 } });
        await board.page.keyboard.press("n");
        await eventually(async () => {
          for (const id of IDS) if (await isFocused(headingOf(board, id))) return true;
          return false;
        }, "a heading focused after a click on the board");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "no other open question: N does nothing, and the single-question board has no jump",
      async () => {
        const run = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const board = await openBoard(run, ["only"]);
        const option = await focusOption(board, "only");
        await expectKeyIgnored(board, "n", option);
        await expectKeyIgnored(board, "Shift+N", option);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+N and Ctrl+N are the browser's",
      async () => {
        const { board } = await open(start, "sections");
        const option = await focusOption(board, "q1");
        await expectKeyIgnored(board, "Alt+n", option);
        await expectKeyIgnored(board, "Control+n", option);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "? from an option opens the board's panel; Escape gives the focus back to the option",
      async () => {
        const { board } = await open(start, "sections");
        const option = await focusOption(board, "q1");
        await board.page.keyboard.press("?");
        await boardPanel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await boardPanel(board).textContent()) ?? "";
        expect(text).toContain("Previous open");
        expect(text).toContain("Sending all held answers has no key.");
        await board.page.keyboard.press("Escape");
        await boardPanel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(option), "the focus back on the option");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the header's Keys button opens the panel, with ? in its description",
      async () => {
        const { board } = await open(start, "sections");
        expect(await keysButton(board).getAttribute("aria-keyshortcuts")).toBe("?");
        // After "Next open" and before the quick toggles' "Settings".
        const x = async (locator: Locator): Promise<number> => {
          const box = await locator.boundingBox();
          if (box === null) throw new Error(`no box for ${locator}`);
          return box.x;
        };
        const banner = board.view.getByRole("banner");
        const jump = banner.getByRole("button", { name: /^Next open/ });
        const settings = banner.getByRole("button", { name: "Settings", exact: true });
        expect(await x(jump)).toBeLessThan(await x(keysButton(board)));
        expect(await x(keysButton(board))).toBeLessThan(await x(settings));
        await keysButton(board).click();
        await boardPanel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await boardPanel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(keysButton(board)), "the focus back on Keys");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a user file giving next open J: J jumps, N does not, and the header says J",
      async () => {
        const { board } = await open(start, "sections", {
          user: { version: "1.0", keys: { "board.nextOpen": ["j"] } },
        });
        const jump = board.view.getByRole("banner").getByRole("button", { name: /^Next open/ });
        await eventually(async () => (await jump.getAttribute("aria-keyshortcuts")) === "J", "J");
        const option = await focusOption(board, "q1");
        await expectKeyIgnored(board, "n", option);
        await board.page.keyboard.press("j");
        await expectClearOfBars(board, "q2");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
