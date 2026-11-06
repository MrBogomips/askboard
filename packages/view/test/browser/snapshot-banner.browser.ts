// The Closed banner's Snapshot in each engine (snapshot task 7.2; view-and-widgets spec: A Snapshot
// from a closed board): an ask the agent closed offers "Snapshot" on its banner and shows the
// saved file's path beside it, while the board's acts stay refused; a discarded board offers no
// Snapshot, on the board or its banner. Asks sent as they are, so they run on the session process.

import { describe, expect, test } from "bun:test";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import type { Asker } from "./harness/asker.ts";
import {
  enabledCount,
  eventually,
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
        // The text is cut in the middle; the tooltip holds the full path.
        const path = (await bannerFeedback(board).locator("code").getAttribute("title")) ?? "";
        expect(path).toMatch(new RegExp(`/\\.askboard/snapshots/${twoAsk.askId}-[^/]+\\.html$`));
        expect(await Bun.file(path).exists()).toBe(true);
        // Review F-06: the message is on one line, the path project-relative and cut in the
        // middle, "Copy path" beside it, the feedback on its own line under the message.
        const banner = board.banner(/closed/i).first();
        const message = banner.getByText(/This ask was closed/);
        const lineHeight = await message.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).lineHeight),
        );
        expect((await message.boundingBox())?.height ?? 0).toBeLessThan(lineHeight * 1.5);
        const shown = (await bannerFeedback(board).locator("code").textContent()) ?? "";
        expect(shown.startsWith(".askboard/snapshots/")).toBe(true);
        expect(shown).toContain("…");
        await bannerFeedback(board).getByRole("button", { name: "Copy path" }).waitFor();
        const feedbackBox = await bannerFeedback(board).boundingBox();
        const messageBox = await message.boundingBox();
        if (feedbackBox === null || messageBox === null) throw new Error("no box");
        expect(feedbackBox.y).toBeGreaterThanOrEqual(messageBox.y + messageBox.height);
        // The density and theme toggles are radios too, and stay usable; only the questions' are refused.
        const answers = board.view.locator("[data-askboard-question]").getByRole("radio");
        expect(await answers.count()).toBeGreaterThan(0);
        expect(await enabledCount(answers)).toBe(0);
        expect(await enabledCount(board.answer)).toBe(0);
        // The bar's Snapshot stays offered on a closed ask.
        expect(await barButton(board, "Snapshot").isDisabled()).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a closed ask looks closed: no open count, next-open jump or agent pill, and options and Ask a follow-up disabled",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const view = board.view;
        await eventually(async () => (await view.getByText(/\d+ open/).count()) === 0, "no count");
        expect(await view.getByRole("button", { name: /Next open/ }).count()).toBe(0);
        expect(await board.agentPill.count()).toBe(0);
        const follow = view.getByRole("button", { name: "Ask a follow-up" }).first();
        expect(await follow.isDisabled()).toBe(true);
        const option = view.locator("[data-askboard-question]").getByRole("radio").first();
        expect(await option.evaluate((node) => getComputedStyle(node).opacity)).toBe("0.5");
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
