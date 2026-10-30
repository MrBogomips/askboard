// The view spec's scenarios about the board's connection, in each engine (specs/view-and-widgets):
// the plain-choice session with its takeover and discard, the session ending, a refused token on
// reconnect, a short drop and an answer given while disconnected. Each compares what the board
// page sent with the transcript's page half (task 8.6).

import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  answerWith,
  enabledCount,
  eventually,
  expectNoCspProblem,
  expectNoReconnect,
  expectPageHalf,
  QUESTION,
  RECONNECT_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const { plainChoice, sessionEnd, restartAfterOpen, shortDrop, resendAfterDrop } = replayTranscripts;

const CONNECTION_LOST = "Connection lost, retrying";
const DISCARDED = /discarded/i;
const MOVED = /moved/i;

const shows = (board: Board, text: string | RegExp, timeout = STEP_TIMEOUT_MS) =>
  board.banner(text).filter({ visible: true }).first().waitFor({ state: "visible", timeout });

// The discarded board: the banner holds the focus, the question stays readable, nothing answers.
const expectDiscarded = async (board: Board) => {
  await shows(board, DISCARDED, RECONNECT_TIMEOUT_MS);
  const focused = await board.page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(focused).toMatch(DISCARDED);
  await board
    .question(QUESTION)
    .getByText(plainChoiceBoardDocument.items[0].props.text, { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  expect(await enabledCount(board.options)).toBe(0);
  expect(await enabledCount(board.answer)).toBe(0);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the connection`, () => {
    const { start } = useEngine(engine);

    test(
      "the plain-choice session: answer, delivered, taken over by a second tab, discarded",
      async () => {
        const run = await start({ transcript: plainChoice, view: dist });
        const first = await run.open();
        const clicked = await answerWith(first, "PostgreSQL");
        await first.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.collected();
        await first.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const second = await run.open();
        await shows(first, MOVED);
        await first.continueHere.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        await second.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.exit();
        await shows(second, DISCARDED);
        await expectNoReconnect(run);
        expectPageHalf(run, clicked);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the session ends: the board shows the ask discarded, stays readable, accepts no answer",
      async () => {
        const run = await start({ transcript: sessionEnd, view: dist });
        const board = await run.open();
        await run.session.exit();
        await expectDiscarded(board);
        await expectNoReconnect(run);
        expectPageHalf(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the token is refused on reconnect after a restart: the board shows the ask discarded",
      async () => {
        const run = await start({ transcript: restartAfterOpen, view: dist });
        const board = await run.open();
        await run.session.restart();
        await expectDiscarded(board);
        await expectNoReconnect(run);
        expectPageHalf(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a short drop: Connection lost, retrying, then the board resumes in the ask's state",
      async () => {
        const run = await start({ transcript: shortDrop, view: dist });
        const board = await run.open();
        await run.session.drop();
        await shows(board, CONNECTION_LOST);
        await run.session.restore();
        await board
          .banner(CONNECTION_LOST)
          .waitFor({ state: "hidden", timeout: RECONNECT_TIMEOUT_MS });
        await board.header
          .getByText("Waiting", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await enabledCount(board.options)).toBe(3);
        expectPageHalf(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "answering while disconnected: not sent yet, sent once the new state shows it open, logged once",
      async () => {
        const run = await start({ transcript: resendAfterDrop, view: dist });
        const board = await run.open();
        await run.session.drop();
        await shows(board, CONNECTION_LOST);
        const clicked = await answerWith(board, "PostgreSQL");
        await board.receipt("not sent yet").waitFor({ timeout: STEP_TIMEOUT_MS });
        // Long enough that an answer stamped when it is sent, not when the user acted, shows.
        await Bun.sleep(1_500);
        await run.session.restore();
        await board.receipt("sent").waitFor({ timeout: RECONNECT_TIMEOUT_MS });
        await board.header
          .getByText("Answered", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => run.browser.pageMessages().length >= 3,
          "the queued answer on the new socket",
        );
        expectPageHalf(run, clicked);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
