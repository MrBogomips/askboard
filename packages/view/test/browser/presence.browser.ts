// The view spec's "The board's working signal", in each engine (task 5.3, design decision 10): the
// board page reports, in its presence message, whether the user works on it: focused, with a key or
// pointer input on the board page or in its view within the last minute. It sends it once after
// each connect and on each change, a flag and nothing else.
//
// Headless engines report every page focused and visible, so a lost focus and a hidden tab are
// what the browser would report: `document.hasFocus()` or `visibilityState` changed, then the
// event, to the window whose document holds the focus (`presence.ts`). A minute passes on
// Playwright's clock, installed before the board loads; a second, on that clock paused.

import { describe, expect, test } from "bun:test";
import { WORKING_WINDOW_MS } from "@askboard/contract";
import type { Page } from "playwright";
import { FOCUS_RECHECK_MS } from "../../src/board-page/working-signal.ts";
import {
  type BoardRun,
  eventually,
  expectNoCspProblem,
  expectPageHalf,
  QUIET_MS,
  RECONNECT_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { hideTab, loseFocus, regainFocus } from "./harness/presence.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const { opening, shortDrop } = replayTranscripts;

// The working flags the board page sent on a socket, in order.
const flags = (run: BoardRun, socket = 1): boolean[] =>
  run.browser
    .presenceMessages()
    .filter((sent) => sent.socket === socket)
    .map(({ message }) => (message as { working: boolean }).working);

const expectFlags = (run: BoardRun, expected: boolean[], socket = 1) =>
  eventually(
    () => JSON.stringify(flags(run, socket)) === JSON.stringify(expected),
    `socket ${socket}'s presence ${JSON.stringify(expected)}, after ${JSON.stringify(flags(run, socket))}`,
  );

// Nothing more is sent for a while.
const expectStill = async (run: BoardRun, expected: boolean[]) => {
  await Bun.sleep(QUIET_MS);
  expect(flags(run)).toEqual(expected);
};

// Stops the page's clock ahead of its time, which flows until then; from there only the test moves
// it. The jump fires each timer due on the way once, and stays well within the working window.
const pauseClock = async (page: Page) => {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + STEP_TIMEOUT_MS);
};

// A key on the board page itself, outside the view: the page holds the focus after it loads.
const keyOnPage = (board: Board) => board.page.keyboard.press("Shift");

// Each presence message holds the flag and nothing else, and the session side found no problem.
const expectOnlyFlags = (run: BoardRun) => {
  for (const { message } of run.browser.presenceMessages()) {
    expect(Object.keys(message as object).sort()).toEqual(["type", "version", "working"]);
  }
  expectPageHalf(run);
  expectNoCspProblem(run);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the working signal`, () => {
    const { start } = useEngine(engine);

    test(
      "after connect, a board without input reports that it is not working",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        await run.open();
        await expectFlags(run, [false]);
        await expectStill(run, [false]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click in the view makes it working, and a minute without input ends it",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        await run.browser.context.clock.install();
        const board = await run.open();
        await expectFlags(run, [false]);
        await board.option("PostgreSQL").click({ timeout: STEP_TIMEOUT_MS });
        await expectFlags(run, [false, true]);
        await Bun.sleep(QUIET_MS);
        await board.page.clock.fastForward(WORKING_WINDOW_MS - 10_000);
        await expectStill(run, [false, true]);
        await board.page.clock.fastForward(10_000);
        await expectFlags(run, [false, true, false]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a key on the board page makes it working",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        await expectFlags(run, [false]);
        await keyOnPage(board);
        await expectFlags(run, [false, true]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "focus moving into the view's frame does not end the signal",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        await keyOnPage(board);
        await expectFlags(run, [false, true]);
        await board.option("SQLite").click({ timeout: STEP_TIMEOUT_MS });
        await expectStill(run, [false, true]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the board's tab losing focus reports at once that it is not working",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        await keyOnPage(board);
        await expectFlags(run, [false, true]);
        // The focus is on the board page, so its window hears the blur.
        expect(await loseFocus(board)).toBe("page");
        await expectFlags(run, [false, true, false]);
        // Back within the minute, the input still counts.
        expect(await regainFocus(board)).toBe("page");
        await expectFlags(run, [false, true, false, true]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the window losing focus from inside the view reports within a second that it is not working",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        await run.browser.context.clock.install();
        const board = await run.open();
        await expectFlags(run, [false]);
        await board.option("PostgreSQL").click({ timeout: STEP_TIMEOUT_MS });
        await expectFlags(run, [false, true]);
        await pauseClock(board.page);
        // The focus is inside the view: only the view's window hears the blur, and the board
        // page hears nothing until it reads its focus again.
        expect(await loseFocus(board)).toBe("view");
        await expectStill(run, [false, true]);
        await board.page.clock.runFor(FOCUS_RECHECK_MS);
        await expectFlags(run, [false, true, false]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a hidden tab is not working",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const board = await run.open();
        await keyOnPage(board);
        await expectFlags(run, [false, true]);
        await hideTab(board);
        await expectFlags(run, [false, true, false]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a new connection after a drop sends the signal again",
      async () => {
        const run = await start({ transcript: shortDrop, view: dist });
        const board = await run.open();
        await keyOnPage(board);
        await expectFlags(run, [false, true]);
        await run.session.drop();
        await run.session.restore();
        // The reconnect takes its backoff.
        await eventually(
          () => flags(run, 2).length > 0,
          "the new socket's presence",
          RECONNECT_TIMEOUT_MS,
        );
        await expectStill(run, [false, true]);
        expect(flags(run, 2)).toEqual([true]);
        expectOnlyFlags(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
