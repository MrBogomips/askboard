// The Chart's cursor on hover, in each engine (chart-widget, task 6.6; spec view-and-widgets: Chart
// tooltips; EXPERIENCE, Hover and focus feedback): the canvas shows the pointer cursor over a point
// a click can highlight and the default cursor over a chart to read (`highlights` none) and, once
// the ask closes, over a read-only chart. A hover changes no highlight and no colour. The session
// process serves every scenario.

import { describe, expect, test } from "bun:test";
import { BAR_PROPS, chartAsk } from "./fixtures/chart-documents.ts";
import {
  eventually,
  expectNoCspProblem,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { type BarRig, barOf, chartOf, counterOf, ringOfBar } from "./harness/chart-steps.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

// BAR_PROPS: fix-a, fix-b, fix-c; fails [4, 9, 2], reruns [1, 3, null]; the axis ends at 10.
const RIG: BarRig = {
  layout: { categories: 3, series: 2, axisMax: 10 },
  values: [
    [4, 9, 2],
    [1, 3, null],
  ],
};

// The cursor the chart's surface shows now: the library sets it on the element that holds the
// canvas, which the pointer is over.
const cursorOf = (board: Board): Promise<string> =>
  chartOf(board).evaluate((element) => {
    const canvas = element.querySelector("canvas");
    const surface = canvas?.parentElement ?? element;
    return getComputedStyle(surface).cursor;
  });

// Moves the pointer onto the first series' bar at `category`, a step at a time, as a hand would.
const hoverBar = async (board: Board, category: number): Promise<void> => {
  const { box, centre } = await barOf(board, RIG, 0, category);
  await board.page.mouse.move(box.x + centre.x - 8, box.y + centre.y);
  await board.page.mouse.move(box.x + centre.x, box.y + centre.y, { steps: 4 });
};

// Moves the pointer to an empty corner of the plot, above the shortest bars.
const hoverEmpty = async (board: Board): Promise<void> => {
  const { box } = await barOf(board, RIG, 0, 0);
  await board.page.mouse.move(box.x + box.width - 24, box.y + 60);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Chart's cursor`, () => {
    const { start } = useEngine(engine);

    test(
      "a pointer over a bar that a click highlights shows the pointer cursor, and leaving it shows the default; the hover highlights nothing",
      async () => {
        const run = await start(lifecycleScenario(chartAsk(BAR_PROPS), dist));
        const board = await openBoard(run, ["plan"]);
        await hoverBar(board, 1);
        await eventually(async () => (await cursorOf(board)) === "pointer", "the pointer cursor");
        await hoverEmpty(board);
        await eventually(async () => (await cursorOf(board)) === "default", "the default cursor");
        await hoverBar(board, 0);
        await eventually(async () => (await cursorOf(board)) === "pointer", "the pointer again");
        expect(await ringOfBar(board, RIG, 0, 0)).toBe(false);
        expect(await counterOf(board).textContent()).toBe("No points highlighted");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with highlights one the bar also shows the pointer cursor",
      async () => {
        const run = await start(
          lifecycleScenario(chartAsk({ ...BAR_PROPS, highlights: "one" }), dist),
        );
        const board = await openBoard(run, ["plan"]);
        await hoverBar(board, 2);
        await eventually(async () => (await cursorOf(board)) === "pointer", "the pointer cursor");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a chart to read (highlights none) shows the default cursor over a bar",
      async () => {
        const run = await start(
          lifecycleScenario(chartAsk({ ...BAR_PROPS, highlights: "none" }), dist),
        );
        const board = await openBoard(run, ["plan"]);
        await hoverBar(board, 1);
        // The tooltip answers a hover even here; only the cursor says a click does nothing.
        await board.page.waitForTimeout(300);
        expect(await cursorOf(board)).toBe("default");
        await hoverBar(board, 0);
        await board.page.waitForTimeout(300);
        expect(await cursorOf(board)).toBe("default");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "once the ask closes the chart is read-only and a bar shows the default cursor",
      async () => {
        const run = await start(lifecycleScenario(chartAsk(BAR_PROPS), dist));
        const board = await openBoard(run, ["plan"]);
        await hoverBar(board, 1);
        await eventually(async () => (await cursorOf(board)) === "pointer", "the pointer cursor");
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await hoverEmpty(board);
        await hoverBar(board, 1);
        await eventually(async () => (await cursorOf(board)) === "default", "the default cursor");
        expect(await counterOf(board).textContent()).toBe("No points highlighted");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
