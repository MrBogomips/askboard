// The Gantt's scenarios, in each engine, on the widget host (gantt-widget design decisions 9 and 12),
// since the board page refuses a board document holding a Gantt until the input format admits
// one. A question holding only a widget counts as loaded on its `ready` message: the board
// harness's `loaded()` waits for option controls. The fixture Gantt's question counts as visible
// with no CSP violation, its `compute` library chunk running under the view's policy; a Gantt
// whose props fail the contract's checks fails its question (AD-10); and an eval in the `compute`
// chunk is reported, the negative control that makes "no violation" mean something there. Then
// the component (group 6): its grid beside its chart, the critical path and the legend; agent
// strings as text; the grid's one Tab stop and its keys.

import { describe, expect, test } from "bun:test";
import { type GanttOwnTask, ganttPropsProblems } from "@askboard/contract";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import {
  arrowFacts,
  barFacts,
  colour,
  daysFrom,
  focusedCell,
  focusedItem,
  focusRing,
  GANTT_ID,
  ganttOf,
  pageState,
  RELEASE_TASKS,
  rowLines,
  rowTexts,
  tabIntoGrid,
  tabStops,
  withSecondGantt,
  withTasks,
} from "./fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { EVAL_PROBE, readViewBuild, withChunkScript } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const [schedule] = ganttBoardDocument.items;
const [release] = schedule.props.items;
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

// The fixture Gantt as compute's UJ-2 plan schedules it: each task's start and finish, and the
// critical path UX design, the prototype, the portal and reporting.
const UJ2 = [
  ["ux", "2026-11-02", "2026-11-09", true],
  ["architecture", "2026-11-02", "2026-11-05", false],
  ["prototype", "2026-11-10", "2026-11-16", true],
  ["portal", "2026-11-17", "2026-12-03", true],
  ["billing", "2026-11-06", "2026-11-18", false],
  ["reporting", "2026-12-04", "2026-12-11", true],
] as const;
const ORIGIN = "2026-11-02";
const WEEK_PX = 15;

const MARKUP = "<img src=x onerror=alert(1)>";
// A Gantt taller than the view, so that a key the grid did not stop would scroll it.
const tallGantt = withTasks(
  Array.from({ length: 30 }, (_, index) => ({
    id: `t${index + 1}`,
    label: `Task ${index + 1}`,
    duration: 2,
    ...(index === 0 ? {} : { dependencies: [`t${index}`] }),
  })),
);

const markupGantt = withTasks(
  RELEASE_TASKS.map((task) => (task.id === "ux" ? { ...task, label: MARKUP } : task)),
);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt`, () => {
    const { host } = useWidgetHost(engine);

    /** A widget host for the document, once its question has reported ready. */
    const opened = async (document: ViewDocument = ganttBoardDocument): Promise<WidgetHostRun> => {
      const run = await host(dist, document);
      await eventually(
        () => run.messages.some((message) => message.type === "ready"),
        "the question's ready message",
        LOAD_TIMEOUT_MS,
      );
      return run;
    };

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
      "the grid is one Tab stop whose arrow keys, Home and End move the focus, with the focus ring",
      async () => {
        // A second Gantt after the first, so that Tab has somewhere to go in every engine.
        const run = await opened(withSecondGantt("second"));
        const gantt = ganttOf(run.board);
        expect(await tabStops(gantt)).toBe(1);
        expect(await tabStops(ganttOf(run.board, "second"))).toBe(1);
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
        expect(await tabStops(gantt)).toBe(1);
        await run.board.page.keyboard.press("Tab");
        expect(await focusedItem(run.board)).toBe("second");
        expect(await focusedCell(run.board)).toBe("ux.task");
        await run.board.page.keyboard.press("Shift+Tab");
        expect(await focusedItem(run.board)).toBe(GANTT_ID);
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
        for (const key of ["End", "Home", "ArrowUp", "ArrowLeft", "ArrowDown", "End", "Home"]) {
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
