// The board page with widget items, in each engine (widget-answers, task 5.1; view spec: Board
// documents with widget items): the board document of the UJ-2 plan, a question holding a Tree and
// a Gantt, builds the view on the session process and its question counts as visible. Every
// scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { planAsk } from "./fixtures/widget-asks.ts";
import { expectNoCspProblem, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { card, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the board page with widget items`, () => {
    const { start } = useEngine(engine);

    test(
      "the UJ-2 board document builds the view, and its question loads, showing the Tree and the plan",
      async () => {
        const run = await start(lifecycleScenario(planAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await card(board, "plan").waitFor({ timeout: 10_000 });
        expect(await board.view.getByRole("treegrid").count()).toBeGreaterThan(0);
        expect(await card(board, "plan").getAttribute("aria-busy")).not.toBe("true");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
