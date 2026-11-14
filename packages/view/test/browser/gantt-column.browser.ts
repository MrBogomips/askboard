// The Gantt's TASK column resize, in each engine, on the widget host (widget-editing-plus design
// decision 7; view spec, "Gantt task column resize" and "Gantt task column resize by keyboard and
// fit"): the header's edge dragged by the pointer, held between 120 px and 60% of the widget,
// stepped, set to its limits and fitted by the keyboard, a cut name's title, and the width as view
// state: no message leaves the view, "Answer" stays disabled, and the counter reads "No changes".
// The edge takes its keys with exactly the holds its table names (keyboard-shortcuts-help, review
// 1.6 S-1): Shift with Enter, Home or End leaves the width alone and the key's default unprevented.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { schedule } from "./fixtures/gantt-documents.ts";
import { planGantt } from "./fixtures/gantt-plan.ts";
import { type GanttParts, ganttOf, withTasks } from "./fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { recordedKeys, recordKeys } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const LONG_NAME = "A task whose name is far wider than the column it opens in, to be cut";

/** The TASK column's header and the widget's frame, as pixel widths. */
const widths = (gantt: GanttParts) =>
  gantt.root.evaluate((root) => {
    const header = root.querySelector<HTMLElement>('th[scope="col"]');
    return {
      column: Math.round(header?.getBoundingClientRect().width ?? 0),
      frame: Math.round(root.getBoundingClientRect().width),
      chart: Math.round(root.querySelector("svg")?.parentElement?.clientWidth ?? 0),
    };
  });

/** The edge's centre. */
const edgeAt = async (gantt: GanttParts) => {
  const box = await gantt.root
    .getByRole("separator", { name: "Resize the Task column" })
    .boundingBox();
  if (box === null) throw new Error("the TASK column has no edge");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const dragEdge = async (run: Awaited<ReturnType<ReturnType<typeof openerFor>>>, dx: number) => {
  const gantt = ganttOf(run.board);
  const from = await edgeAt(gantt);
  const { mouse } = run.board.page;
  await mouse.move(from.x, from.y);
  await mouse.down();
  await mouse.move(from.x + dx, from.y, { steps: 6 });
  await mouse.up();
};

const expectNotAnAnswer = async (run: Awaited<ReturnType<ReturnType<typeof openerFor>>>) => {
  const gantt = ganttOf(run.board);
  await Bun.sleep(QUIET_MS);
  expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
  expect(await run.board.answer.isDisabled()).toBe(true);
  expect((await gantt.root.locator("[data-gantt-counter]").textContent())?.trim()).toBe(
    "No changes",
  );
  expect(run.browser.cspProblems()).toEqual([]);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's TASK column`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "dragging the header's edge widens the column and narrows the chart, and it is no answer",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const before = await widths(gantt);
        await dragEdge(run, 80);
        const after = await widths(gantt);
        expect(after.column).toBe(before.column + 80);
        expect(after.chart).toBeLessThan(before.chart);
        await expectNotAnAnswer(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the width stops at 120 px and at 60% of the widget",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await dragEdge(run, -2_000);
        expect((await widths(gantt)).column).toBe(120);
        await dragEdge(run, 3_000);
        const { column, frame } = await widths(gantt);
        expect(Math.abs(column - Math.floor(frame * 0.6))).toBeLessThanOrEqual(1);
        await expectNotAnAnswer(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "by keyboard alone: three right arrows grow it by 48 px, End takes the widest, focus stays and the page does not navigate",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
        const url = await run.board.page.evaluate(() => location.href);
        await edge.focus();
        const start = await widths(gantt);
        for (let press = 0; press < 3; press += 1)
          await run.board.page.keyboard.press("ArrowRight");
        expect((await widths(gantt)).column).toBe(start.column + 48);
        expect(await edge.getAttribute("aria-valuenow")).toBe(String(start.column + 48));
        await run.board.page.keyboard.press("Shift+ArrowRight");
        expect((await widths(gantt)).column).toBe(start.column + 48 + 64);
        await run.board.page.keyboard.press("End");
        const widest = await edge.getAttribute("aria-valuemax");
        expect(await edge.getAttribute("aria-valuenow")).toBe(widest);
        await run.board.page.keyboard.press("Home");
        expect((await widths(gantt)).column).toBe(120);
        expect(await edge.getAttribute("aria-valuemin")).toBe("120");
        expect(await edge.evaluate((element) => element === document.activeElement)).toBe(true);
        expect(await run.board.page.evaluate(() => location.href)).toBe(url);
        await expectNotAnAnswer(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Shift with Enter, Home or End on the focused edge leaves the width alone and does not prevent the key; Shift with an arrow still steps it",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const { page } = run.board;
        const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
        await edge.focus();
        await recordKeys(run.board);
        const start = (await widths(gantt)).column;
        for (const key of ["Shift+Enter", "Shift+Home", "Shift+End"])
          await page.keyboard.press(key);
        expect((await widths(gantt)).column).toBe(start);
        expect(await edge.getAttribute("aria-valuenow")).toBe(String(start));
        // The same edge, the same hold: an arrow is the edge's and is prevented.
        await page.keyboard.press("Shift+ArrowRight");
        expect((await widths(gantt)).column).toBe(start + 64);
        // The modifier keys' own presses are in the record too.
        const keys = (await recordedKeys(run.board)).filter((key) => key !== "Shift+Shift");
        expect(keys).toEqual([
          "Shift+Enter",
          "Shift+Home",
          "Shift+End",
          "Shift+ArrowRight prevented",
        ]);
        expect(await edge.evaluate((element) => element === document.activeElement)).toBe(true);
        await expectNotAnAnswer(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Enter and a double click fit the longest visible name, and a cut name's title holds it whole",
      async () => {
        const run = await opened(
          withTasks([
            { id: "short", label: "Short", duration: 2 },
            { id: "long", label: LONG_NAME, duration: 2 },
          ]),
        );
        const gantt = ganttOf(run.board);
        // Cut at the default width, with its whole name as the title.
        const cell = gantt.cell("long", "task");
        expect(await cell.getAttribute("title")).toBe(LONG_NAME);
        expect(
          await cell.locator("span").evaluate((span) => span.scrollWidth > span.clientWidth),
        ).toBe(true);
        // The name's whole width, cut as it is, and the cell's padding on both sides.
        const needed = await cell
          .locator("span")
          .evaluate((span) => Math.ceil(span.scrollWidth) + 16);
        const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
        await edge.focus();
        await run.board.page.keyboard.press("Enter");
        const fitted = await widths(gantt);
        expect(
          Math.abs(fitted.column - Math.min(needed, Math.floor(fitted.frame * 0.6))),
        ).toBeLessThanOrEqual(1);
        await run.board.page.keyboard.press("Home");
        await edge.dblclick();
        expect((await widths(gantt)).column).toBe(fitted.column);
        await expectNotAnAnswer(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the fixture plan opens at the column's default width with its last bar and end date visible without scrolling",
      async () => {
        const run = await host(dist, ganttPlanBoardDocument);
        await eventually(
          () => run.messages.length > 0,
          "the plan's ready message",
          LOAD_TIMEOUT_MS,
        );
        const gantt = ganttOf(run.board, planGantt.id);
        const fits = await gantt.root.evaluate((root) => {
          const scroller = root.querySelector<HTMLElement>("svg")?.parentElement;
          return scroller === null || scroller === undefined
            ? undefined
            : scroller.scrollWidth <= scroller.clientWidth + 1;
        });
        expect(fits).toBe(true);
        const last = await gantt.bar("reporting").boundingBox();
        const chart = await gantt.root.locator("svg").first().boundingBox();
        if (last === null || chart === null) throw new Error("no last bar or chart");
        expect(last.x + last.width).toBeLessThanOrEqual(chart.x + chart.width);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
