// The Gantt's layout scenarios, in each engine, on the widget host (gantt-widget design decisions
// 9 and 12; spec, "Gantt layout"), since the board page refuses a board document holding a Gantt
// until the input format admits one. A question holding only a widget counts as loaded on its
// `ready` message: the board harness's `loaded()` waits for option controls. The fixture Gantt's
// question counts as visible with no CSP violation, its `compute` library chunk running under the
// view's policy; a Gantt whose props fail the contract's checks fails its question (AD-10); and an
// eval in the `compute` chunk is reported, the negative control that makes "no violation" mean
// something there. Then the standalone Gantt's grid beside its chart, with the critical path and
// the legend, and agent strings as text (AD-8).

import { describe, expect, test } from "bun:test";
import { type GanttOwnTask, ganttPropsProblems } from "@askboard/contract";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { ORIGIN, release, schedule, UJ2, WEEK_PX } from "./fixtures/gantt-documents.ts";
import {
  arrowFacts,
  barFacts,
  colour,
  daysFrom,
  ganttOf,
  RELEASE_TASKS,
  rowLines,
  rowTexts,
  withTasks,
} from "./fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
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
  });
}
