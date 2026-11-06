// The Gantt's navigation scenarios, in each engine, on the widget host (gantt-widget design
// decisions 9 and 12; spec, "Gantt keyboard"): the grid is one Tab stop whose arrow keys, Home and
// End move the focus with the focus ring, and its keys change no value, send nothing, and neither
// scroll nor navigate the page.

import { describe, expect, test } from "bun:test";
import { schedule } from "./fixtures/gantt-documents.ts";
import {
  focusedCell,
  focusedItem,
  focusRing,
  pageState,
  tabIntoGrid,
  tabStops,
} from "./fixtures/gantt-input.ts";
import {
  barFacts,
  colour,
  GANTT_ID,
  ganttOf,
  rowTexts,
  withSecondGantt,
  withTasks,
} from "./fixtures/gantt-view.ts";
import { QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

// What the Tab key reaches in a Gantt without a zoom: the critical path switch, the TASK column's
// edge and the grid's one Tab stop.
const GANTT_STOPS = 3;

/** Presses a key until the condition holds, at most six times. */
const pressUntil = async (board: Board, key: string, reached: () => Promise<boolean>) => {
  for (let presses = 0; presses < 6 && !(await reached()); presses += 1) {
    await board.page.keyboard.press(key);
  }
};

// A Gantt taller than the view, so that a key the grid did not stop would scroll it.
const tallGantt = withTasks(
  Array.from({ length: 30 }, (_, index) => ({
    id: `t${index + 1}`,
    label: `Task ${index + 1}`,
    duration: 2,
    ...(index === 0 ? {} : { dependencies: [`t${index}`] }),
  })),
);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's keys`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "the grid is one Tab stop whose arrow keys, Home and End move the focus, with the focus ring",
      async () => {
        // A second Gantt after the first, so that Tab has somewhere to go in every engine.
        const run = await opened(withSecondGantt("second"));
        const gantt = ganttOf(run.board);
        expect(await tabStops(gantt)).toBe(GANTT_STOPS);
        expect(await tabStops(ganttOf(run.board, "second"))).toBe(GANTT_STOPS);
        expect(await tabIntoGrid(run.board)).toBe("ux.task");
        expect(await focusedItem(run.board)).toBe(GANTT_ID);
        const ring = colour("ring");
        const moves = [
          ["ArrowRight", "ux.start"],
          ["ArrowDown", "architecture.start"],
          ["End", "architecture.dependencies"],
          ["Home", "architecture.task"],
          ["ArrowUp", "ux.task"],
          ["ArrowUp", "ux.task"],
          ["ArrowLeft", "ux.task"],
          ["End", "ux.dependencies"],
          ["ArrowRight", "ux.dependencies"],
          ...Array.from({ length: 6 }, () => ["ArrowDown", "reporting.dependencies"]),
        ] as const;
        for (const [key, cell] of moves.slice(0, 9)) {
          await run.board.page.keyboard.press(key);
          expect({ key, cell: await focusedCell(run.board) }).toEqual({ key, cell });
          expect(await focusRing(run.board)).toEqual({ style: "solid", width: "2px", color: ring });
        }
        for (const [key] of moves.slice(9)) await run.board.page.keyboard.press(key);
        expect(await focusedCell(run.board)).toBe("reporting.dependencies");
        expect(await tabStops(gantt)).toBe(GANTT_STOPS);
        // On through the second Gantt's switch and column edge, to its grid, and back.
        await pressUntil(run.board, "Tab", async () => (await focusedItem(run.board)) === "second");
        await pressUntil(
          run.board,
          "Tab",
          async () => (await focusedCell(run.board)) !== undefined,
        );
        expect(await focusedItem(run.board)).toBe("second");
        expect(await focusedCell(run.board)).toBe("ux.task");
        await pressUntil(
          run.board,
          "Shift+Tab",
          async () => (await focusedItem(run.board)) === GANTT_ID,
        );
        expect(await focusedCell(run.board)).toBe("reporting.dependencies");
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the grid's keys change no value, send nothing, and neither scroll nor navigate the page",
      async () => {
        const run = await opened(tallGantt);
        const gantt = ganttOf(run.board);
        const before = { rows: await rowTexts(gantt), bars: await barFacts(gantt) };
        const page = await pageState(run.board);
        expect(await tabIntoGrid(run.board)).toBe("t1.task");
        // Then the keys that do nothing on a name: no "go back" for Backspace.
        const keys = ["End", "Home", "ArrowUp", "ArrowLeft", "ArrowDown", "End", "Home"];
        for (const key of [...keys, "Backspace", "Delete", "Enter", "F2"]) {
          await run.board.page.keyboard.press(key);
        }
        expect(await focusedCell(run.board)).toBe("t2.task");
        expect(await pageState(run.board)).toEqual(page);
        expect({ rows: await rowTexts(gantt), bars: await barFacts(gantt) }).toEqual(before);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
