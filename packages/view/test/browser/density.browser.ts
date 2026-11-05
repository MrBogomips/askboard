// The density tokens in each engine (settings-languages, task 8.1): `.comfortable` on the view's
// root re-points the control height and the header row, and compact is the default. The class is
// set by the test here; the board's own switch comes with the presentation update (task 8.2).

import { describe, expect, test } from "bun:test";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { buttonOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

/** The heights, in pixels, of a control and of header row 2. */
const measure = async (board: Board) => {
  const control = await buttonOf(board, "database", "Answer").boundingBox();
  const row = await board.view.locator('[data-askboard-header="who-and-where"]').boundingBox();
  return { control: control?.height, row: row?.height };
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the density tokens`, () => {
    const { start } = useEngine(engine);

    test(
      "a control is 28 px and a header row 32 px in Compact; 32 px and 40 px in Comfortable",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await buttonOf(board, "database", "Answer").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await measure(board)).toEqual({ control: 28, row: 32 });
        await board.view.locator("html").evaluate((root) => root.classList.add("comfortable"));
        expect(await measure(board)).toEqual({ control: 32, row: 40 });
        await board.view.locator("html").evaluate((root) => root.classList.remove("comfortable"));
        expect(await measure(board)).toEqual({ control: 28, row: 32 });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
