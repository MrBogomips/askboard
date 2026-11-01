// The Gantt's layout scenarios, in each engine, on the widget host (gantt-widget design decisions
// 9 and 12; spec, "Gantt layout"), since the board page refuses a board document holding a Gantt
// until the input format admits one. A question holding only a widget counts as loaded on its
// `ready` message: the board harness's `loaded()` waits for option controls. The fixture Gantt's
// question counts as visible with no CSP violation, its `compute` library chunk running under the
// view's policy; a Gantt whose props fail the contract's checks fails its question (AD-10); and an
// eval in the `compute` chunk is reported, the negative control that makes "no violation" mean
// something there. Then the standalone Gantt's grid beside its chart, with the critical path and
// the legend, and agent strings as text (AD-8); and a Gantt reaching the last day it may name,
// drawn in bounded time with at most about 2,000 axis ticks (design decision 8).

import { describe, expect, test } from "bun:test";
import { type GanttOwnTask, ganttPropsProblems } from "@askboard/contract";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import { validateGanttProps } from "@askboard/contract/validate";
import type { ViewDocument } from "../../src/view-document.ts";
import { ORIGIN, release, schedule, UJ2, WEEK_PX } from "./fixtures/gantt-documents.ts";
import {
  alignment,
  arrowFacts,
  barFacts,
  colour,
  daysFrom,
  type GanttParts,
  ganttOf,
  RELEASE_TASKS,
  rowLines,
  rowTexts,
  withTasks,
} from "./fixtures/gantt-view.ts";
import {
  eventually,
  LOAD_TIMEOUT_MS,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { type Engine, enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { EVAL_PROBE, readViewBuild, withChunkScript } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const tasks = release.props.tasks as readonly GanttOwnTask[];

// The fixture Gantt with a task only the view may add: `u-` IDs are refused from the agent, so the
// contract's check fails it.
const refusedProps = {
  ...release.props,
  tasks: [...tasks, { id: "u-1", label: "Added by the agent", duration: 1 }],
};
const refusedGantt: ViewDocument = {
  ...ganttBoardDocument,
  items: [
    { ...schedule, props: { ...schedule.props, items: [{ ...release, props: refusedProps }] } },
  ],
};

// The build with the eval probe run first in the `compute` library chunk.
const withComputeProbe = () => {
  const script = dist.manifest.chunks.compute?.script;
  if (script === undefined) throw new Error("the view build has no compute chunk");
  return withChunkScript(dist, "compute", `${EVAL_PROBE}${dist.files.get(script.path) ?? ""}`);
};

const reportsEval = (problems: readonly string[]): boolean =>
  problems.some((problem) => /eval/i.test(problem));

const MARKUP = "<img src=x onerror=alert(1)>";
const markupGantt = withTasks(
  RELEASE_TASKS.map((task) => (task.id === "ux" ? { ...task, label: MARKUP } : task)),
);

// A Gantt reaching the last day it may name: Reporting, one day long, asked to start on 9999-12-31,
// which compute schedules there, so the axis runs from 2026-11-02 to that day; and Billing asked to
// start that day too, whose nine working days compute's WORKDAY cannot end within the range: a
// value error, so no bar and the field error under its row.
const FAR = "9999-12-31";
const farTasks = RELEASE_TASKS.map((task) => {
  if (task.id === "reporting") return { ...task, start: FAR, duration: 1 };
  return task.id === "billing" ? { ...task, start: FAR } : task;
});
/** The axis's bound, `MAX_TICKS` in the widgets' `scale.ts`, which the view may not import. */
const MAX_TICKS = 2_000;
/** That chart's width at the week scale, from its first day to its last, and a bar's height. */
const FAR_WIDTH = (daysFrom(ORIGIN, FAR) + 1) * WEEK_PX;
const BAR_HEIGHT = 14;
/** The widest box each engine lays out, in pixels, which that chart's width exceeds. */
const WIDEST_BOX: Readonly<Record<Engine, number>> = {
  chromium: 33_554_428,
  firefox: 17_895_190,
  webkit: 33_554_428,
};

/**
 * The chart's laid-out width, the scale its viewBox draws at, the first bar's drawn height and the
 * far bar's drawn width; not a number for a part the chart lacks.
 */
const drawnScale = (gantt: GanttParts) =>
  gantt.root.evaluate((root) => {
    const chart = root.querySelector("svg");
    const box = (selector: string) => root.querySelector(selector)?.getBoundingClientRect();
    return {
      width: chart?.getBoundingClientRect().width ?? Number.NaN,
      scale: chart?.getScreenCTM()?.a ?? Number.NaN,
      barHeight: box("[data-gantt-bar]")?.height ?? Number.NaN,
      farBarWidth: box('[data-gantt-bar="reporting"]')?.width ?? Number.NaN,
    };
  });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's layout`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "the fixture Gantt's question counts as visible, its ready message recorded, with no CSP violation",
      async () => {
        const run = await host(dist, ganttBoardDocument);
        await eventually(
          () => run.messages.length > 0,
          "the question's ready message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        const card = run.board.question(schedule.id);
        expect(await card.getAttribute("aria-busy")).toBe("false");
        expect(await card.getByRole("alert").count()).toBe(0);
        const shown = (await card.textContent()) ?? "";
        for (const { label } of tasks) expect(shown).toContain(label);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Gantt whose props fail the contract's checks fails its question, with no Answer",
      async () => {
        const problems = ganttPropsProblems(refusedProps, "agent");
        expect(problems).toHaveLength(1);
        const [problem] = problems;
        const run = await host(dist, refusedGantt);
        await eventually(
          () => run.messages.length > 0,
          "the Gantt's item-error message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([
          {
            type: "item-error",
            itemId: release.id,
            error: expect.stringContaining(`${problem?.path}: ${problem?.message}`),
          },
        ]);
        const card = run.board.question(schedule.id);
        expect(await card.getByRole("alert").count()).toBe(1);
        expect(await run.board.answer.count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "catches a caught eval in the compute chunk the Gantt's view runs",
      async () => {
        const run = await host(withComputeProbe(), ganttBoardDocument);
        await eventually(
          () => reportsEval(run.browser.cspProblems()),
          "the compute chunk's eval to be reported",
          LOAD_TIMEOUT_MS,
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the standalone Gantt shows its grid beside its chart, with the week axis, the bars, the arrows, the critical path and the legend",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        const headers = await gantt.grid.getByRole("columnheader").allTextContents();
        expect(headers.map((text) => text.trim())).toEqual([
          "Task",
          "Start",
          "Duration",
          "Depends on",
        ]);
        expect(await rowTexts(gantt)).toEqual([
          ["ux", "UX design", "11/2/2026", "6", ""],
          ["architecture", "Architecture", "11/2/2026", "4", ""],
          ["prototype", "Clickable prototype", "11/10/2026", "5", "UX design"],
          ["portal", "Customer portal", "11/17/2026", "13", "Architecture, Clickable prototype"],
          ["billing", "Billing integration", "11/6/2026", "9", "Architecture"],
          ["reporting", "Reporting", "12/4/2026", "6", "Customer portal"],
        ]);
        expect(await gantt.chart.count()).toBe(1);
        // Each grid row lines up with its row of the chart: 36px rows under a 32px header.
        expect(await rowLines(gantt)).toEqual({
          chart: 0,
          rows: UJ2.map((_, index) => [32 + 36 * index, 36]),
        });
        const ticks = await gantt.ticks.allTextContents();
        expect(ticks.slice(0, 6)).toEqual([
          "Nov 2",
          "Nov 9",
          "Nov 16",
          "Nov 23",
          "Nov 30",
          "Dec 7",
        ]);
        expect(await barFacts(gantt)).toEqual(
          UJ2.map(([task, start, finish, critical]) => ({
            task,
            start,
            finish,
            critical,
            x: daysFrom(ORIGIN, start) * WEEK_PX,
            width: (daysFrom(start, finish) + 1) * WEEK_PX,
            fill: colour(critical ? "critical" : "gantt-bar"),
          })),
        );
        const critical = new Set(["ux>prototype", "prototype>portal", "portal>reporting"]);
        const arrows = await arrowFacts(gantt);
        expect(
          arrows.map(({ link, critical, stroke, width }) => ({ link, critical, stroke, width })),
        ).toEqual(
          [
            "ux>prototype",
            "architecture>portal",
            "prototype>portal",
            "architecture>billing",
            "portal>reporting",
          ].map((link) => ({
            link,
            critical: critical.has(link),
            stroke: colour(critical.has(link) ? "critical" : "gantt-bar"),
            width: critical.has(link) ? "2px" : "1px",
          })),
        );
        for (const arrow of arrows) expect(arrow.marker).toMatch(/^url\(#.+\)$/);
        const legend = (await gantt.root.textContent()) ?? "";
        for (const entry of ["task", "critical path", "your change"])
          expect(legend).toContain(entry);
        // A standalone Gantt: the week scale, with no zoom control and no baseline.
        for (const zoom of ["Day", "Week", "Month"]) {
          expect(await gantt.root.getByRole("radio", { name: zoom }).count()).toBe(0);
          expect(await gantt.root.getByRole("button", { name: zoom }).count()).toBe(0);
        }
        expect(await gantt.root.locator("[data-gantt-baseline]").count()).toBe(0);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "markup in a task's name shows as those characters, and no element is made from it",
      async () => {
        const run = await opened(markupGantt);
        const gantt = ganttOf(run.board);
        expect(((await gantt.cell("ux", "task").textContent()) ?? "").trim()).toBe(MARKUP);
        expect(await gantt.cell("prototype", "dependencies").textContent()).toContain(MARKUP);
        expect(await run.board.view.locator("img").count()).toBe(0);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Gantt reaching 9999-12-31 becomes visible within the step timeout, with at most 2,000 axis ticks, its far bar and its field error, its chart scaled down to the engine's widest box",
      async () => {
        expect(validateGanttProps({ ...release.props, tasks: farTasks }, "agent").ok).toBe(true);
        const from = Date.now();
        const run = await opened(withTasks(farTasks));
        const gantt = ganttOf(run.board);
        await eventually(async () => (await gantt.bar("reporting").count()) === 1, "the far bar");
        const visibleAfter = Date.now() - from;
        console.info(`${engine}: the Gantt reaching ${FAR} became visible in ${visibleAfter} ms`);
        expect(visibleAfter).toBeLessThan(STEP_TIMEOUT_MS);
        // Every n-th Monday, the smallest n within the bound (209): more than half the bound's
        // ticks, from 2026-11-02, then 2030-11-04, each labelled.
        const ticks = await gantt.ticks.allTextContents();
        expect(ticks.length).toBeLessThanOrEqual(MAX_TICKS);
        expect(ticks.length).toBeGreaterThan(MAX_TICKS / 2);
        expect(ticks.slice(0, 2)).toEqual(["Nov 2", "Nov 4"]);
        expect(ticks.every((label) => label.trim() !== "")).toBe(true);
        const far = (await barFacts(gantt)).find((bar) => bar.task === "reporting");
        expect(far).toMatchObject({
          start: FAR,
          finish: FAR,
          x: daysFrom(ORIGIN, FAR) * WEEK_PX,
          width: WEEK_PX,
        });
        expect(await gantt.bar("billing").count()).toBe(0);
        expect(((await gantt.note("billing").textContent()) ?? "").trim()).toBe(
          "No dates: the schedule could not be computed.",
        );
        // As found, not designed (task 9.2): an engine lays the 43,682,070px chart out at its widest
        // box, and the viewBox scales the whole chart down to fit, centred, so that its bars no
        // longer line up with the grid's rows; Firefox draws no box for the far bar at all.
        const drawn = await drawnScale(gantt);
        expect(drawn.width).toBe(WIDEST_BOX[engine]);
        expect(drawn.scale).toBeCloseTo(WIDEST_BOX[engine] / FAR_WIDTH, 4);
        expect(drawn.barHeight).toBeCloseTo(BAR_HEIGHT * drawn.scale, 1);
        expect(drawn.farBarWidth === 0).toBe(engine === "firefox");
        // `alignment` reads a row and its bar as equal when they line up, as in the fixture's chart;
        // here UX design's bar, in the first row, is drawn lower than its row.
        const [ux] = await alignment(gantt);
        expect(ux).toEqual({ task: "ux", row: 32, bar: expect.any(Number) });
        expect(ux?.bar ?? 0).toBeGreaterThan(32);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
