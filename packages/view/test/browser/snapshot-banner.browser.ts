// The Closed banner's Snapshot in each engine (snapshot task 7.2; view-and-widgets spec: A Snapshot
// from a closed board): an ask the agent closed offers "Snapshot" on its banner and shows the
// saved file's path beside it, while the board's acts stay refused; a discarded board offers no
// Snapshot, on the board or its banner. Asks sent as they are, so they run on the session process.

import { describe, expect, test } from "bun:test";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import type { Asker } from "./harness/asker.ts";
import {
  enabledCount,
  expectNoCspProblem,
  RECONNECT_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { barButton, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

/** The project the session process saves Snapshots under. */
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };

const bannerButton = (board: Board) =>
  board.page.getByRole("button", { name: "Snapshot", exact: true });
const bannerFeedback = (board: Board) => board.page.locator("[data-askboard-snapshot-feedback]");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Closed banner's Snapshot`, () => {
    const { start } = useEngine(engine);

    test(
      "an ask the agent closed: Snapshot on the banner, the path beside it, the acts still refused",
      async () => {
        const run = await start({ ...lifecycleScenario(twoAsk, dist), asker: ASKER });
        const board = await openBoard(run, ["database", "cache"]);
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await bannerButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await bannerFeedback(board)
          .filter({ hasText: "Snapshot saved:" })
          .waitFor({ timeout: RECONNECT_TIMEOUT_MS });
        const path = (await bannerFeedback(board).locator("code").textContent()) ?? "";
        expect(path).toMatch(new RegExp(`/\\.askboard/snapshots/${twoAsk.askId}-[^/]+\\.html$`));
        expect(await Bun.file(path).exists()).toBe(true);
        expect(await enabledCount(board.view.getByRole("radio"))).toBe(0);
        expect(await enabledCount(board.answer)).toBe(0);
        // The bar's Snapshot stays offered on a closed ask.
        expect(await barButton(board, "Snapshot").isDisabled()).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a discarded board: no Snapshot on the board or on its banner",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await barButton(board, "Snapshot").waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.exit();
        await board
          .banner(/discarded/i)
          .first()
          .waitFor({ timeout: RECONNECT_TIMEOUT_MS });
        await barButton(board, "Snapshot").waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await bannerButton(board).count()).toBe(0);
        expect(await bannerFeedback(board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
