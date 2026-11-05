// UJ-1's context ask on the session process, in each engine (excerpts, task 7.2): the same ask the
// conformance suite sends. The board shows every item, the reading panel opens at the anchor, and
// the excerpt that did not resolve leaves "Answer" usable.

import { describe, expect, test } from "bun:test";
import {
  UJ1_ADR,
  UJ1_SOURCE_LINES,
  UJ1_WRITTEN,
  uj1Ask,
  uj1Files,
} from "./fixtures/context-asks.ts";
import {
  expectNoCspProblem,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: UJ-1's context ask`, () => {
    const { start } = useEngine(engine);

    test(
      "the board shows every item, the reading panel opens at the anchor, and the unresolved pointer leaves Answer usable",
      async () => {
        const run = await start({ ...lifecycleScenario(uj1Ask, dist), files: uj1Files });
        const board = await openBoard(run, ["fix"]);
        const column = card(board, "fix").locator('[data-askboard-context="beside"]');
        await column.waitFor({ timeout: STEP_TIMEOUT_MS });
        for (const id of ["retry-adr", "settings", "retry-src", "gone"]) {
          await column.locator(`[data-askboard-item="${id}"]`).waitFor();
        }
        await column.getByText("We retry a failed payment three times", { exact: false }).waitFor();
        await column.getByText(UJ1_WRITTEN.split("\n")[0] ?? "", { exact: false }).waitFor();
        await column.locator('[data-askboard-item="gone"]').getByText("Unresolved").waitFor();
        await card(board, "fix").locator('[data-askboard-item="shot"] img').waitFor();

        // The reading panel opens at the anchor: the ADR's Decision section, from line 7 on.
        await board.view
          .locator('[data-askboard-item="retry-adr"]')
          .getByRole("button", { name: "Open in reading panel" })
          .click();
        const panel = board.page.locator('aside[aria-label="Reading panel"]');
        await panel.getByText(UJ1_ADR, { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
        const source = board.page.frameLocator('aside[aria-label="Reading panel"] iframe');
        await source.locator("#L7").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await source.locator("#L7.hit").count()).toBe(1);
        await panel.getByRole("button", { name: "Close reading panel" }).click();
        await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });

        // The FILE reference opens the source at its own range.
        await column.locator('[data-askboard-item="retry-src"]').getByRole("button").click();
        await source.locator("#L1").waitFor({ timeout: STEP_TIMEOUT_MS });
        await source.getByText(UJ1_SOURCE_LINES[0] ?? "", { exact: false }).waitFor();
        await panel.getByRole("button", { name: "Close reading panel" }).click();

        // The missing pointer leaves the question answerable.
        await optionOf(board, "fix", "Fix A").click();
        expect(await answerOf(board, "fix").isEnabled()).toBe(true);
        await answerOf(board, "fix").click();
        await card(board, "fix")
          .getByText("sent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
