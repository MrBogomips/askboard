// The Chart, in each engine, on the widget host and, for the read-only scenario, on the session
// process (chart-widget, task 5.1; spec view-and-widgets: Highlighting data points, A Chart's
// highlights as its result, A Chart at the keyboard, A Chart's points read aloud, Charts to read and
// read-only charts, Charts request nothing): a click on a bar highlights it and a second click
// clears it, the counter says how many, the draft holds the points in the series' then the
// categories' order; `one` replaces and `none` takes nothing; Tab, Right and Space highlight from
// the keyboard and the live region reads each point, a gap skipped; once the ask closes the chart
// keeps its rings and changes nothing. No Content Security Policy violation occurs.

import { describe, expect, test } from "bun:test";
import {
  BAR_PROPS,
  CHART_ID,
  chartAsk,
  chartDocument,
  LINE_PROPS,
} from "./fixtures/chart-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import {
  eventually,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { barCentre, barWidthOf, boxOf, clickAt, wearsRing } from "./harness/chart-points.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { tabIntoGroup, tabLeavesGroup } from "./harness/tab-stops.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

// BAR_PROPS: fix-a, fix-b, fix-c; fails [4, 9, 2], reruns [1, 3, null]; the axis ends at 10.
const BAR = { categories: 3, series: 2, axisMax: 10 } as const;
const VALUES = { fails: [4, 9, 2], reruns: [1, 3, null] } as const;
const CATEGORY_IDS = ["fix-a", "fix-b", "fix-c"] as const;
const SERIES_IDS = ["fails", "reruns"] as const;

const chartOf = (board: Board) => board.view.locator("[data-chart]");
const counter = (board: Board) => board.view.locator("[data-chart-counter]");
const live = (board: Board) => board.view.locator("[data-chart-live]");

// A bar's centre by series and category, in the chart's own box.
const centreOf = async (board: Board, series: number, category: number) => {
  const box = await boxOf(chartOf(board));
  const value = VALUES[SERIES_IDS[series] ?? "fails"][category];
  if (typeof value !== "number") throw new Error("the point has no value");
  return { box, centre: barCentre(BAR, box, { series, category, value }) };
};

const clickBar = async (board: Board, series: number, category: number): Promise<void> => {
  const { centre } = await centreOf(board, series, category);
  await clickAt(chartOf(board), centre);
};

const ringOf = async (board: Board, series: number, category: number): Promise<boolean> => {
  const { box, centre } = await centreOf(board, series, category);
  return wearsRing(chartOf(board), centre, barWidthOf(BAR, box));
};

const point = (series: number, category: number) => ({
  series: SERIES_IDS[series],
  category: CATEGORY_IDS[category],
});

const counterIs = (board: Board, text: string) =>
  eventually(async () => (await counter(board).textContent()) === text, `the counter "${text}"`);

const liveIs = (board: Board, text: string) =>
  eventually(async () => (await live(board).textContent()) === text, `the live region "${text}"`);

const draftIs = (run: WidgetHostRun, expected: unknown, what: string): Promise<void> =>
  eventually(() => draftHolds(run.drafts, "plan", CHART_ID, expected), what);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Chart`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "untouched, it shows its title and No points highlighted, sends nothing and leaves Answer disabled",
      async () => {
        const run = await host(dist, chartDocument(BAR_PROPS));
        await readyIn(run);
        const { board } = run;
        expect(await board.view.locator("[data-chart-title]").textContent()).toBe(
          "Failures by fix",
        );
        expect(await counter(board).textContent()).toBe("No points highlighted");
        expect(await chartOf(board).getAttribute("role")).toBe("application");
        expect(await chartOf(board).getAttribute("aria-roledescription")).toBe("chart");
        expect(await board.answer.isDisabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.drafts).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "clicking two bars highlights both with the ring and counts them, the draft in series and category order; clicking one again clears it, the last one clearing the result",
      async () => {
        const run = await host(dist, chartDocument(BAR_PROPS));
        await readyIn(run);
        const { board } = run;
        expect(await ringOf(board, 0, 1)).toBe(false);
        // fails in fix-b, then fails in fix-a: the draft lists fix-a first all the same.
        await clickBar(board, 0, 1);
        await counterIs(board, "1 point highlighted");
        await clickBar(board, 0, 0);
        await counterIs(board, "2 points highlighted");
        expect(await ringOf(board, 0, 1)).toBe(true);
        expect(await ringOf(board, 0, 0)).toBe(true);
        expect(await ringOf(board, 0, 2)).toBe(false);
        expect(await board.answer.isEnabled()).toBe(true);
        await draftIs(run, { points: [point(0, 0), point(0, 1)] }, "the draft to hold both points");
        await clickBar(board, 0, 0);
        await counterIs(board, "1 point highlighted");
        expect(await ringOf(board, 0, 0)).toBe(false);
        await draftIs(run, { points: [point(0, 1)] }, "the draft to hold the one point");
        await clickBar(board, 0, 1);
        await counterIs(board, "No points highlighted");
        await draftIs(run, undefined, "the draft to hold no result");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with highlights one a second click replaces the first point",
      async () => {
        const run = await host(dist, chartDocument({ ...BAR_PROPS, highlights: "one" }));
        await readyIn(run);
        const { board } = run;
        await clickBar(board, 0, 0);
        await counterIs(board, "1 point highlighted");
        await clickBar(board, 1, 1);
        await draftIs(run, { points: [point(1, 1)] }, "the draft to hold the second point alone");
        await counterIs(board, "1 point highlighted");
        expect(await ringOf(board, 1, 1)).toBe(true);
        expect(await ringOf(board, 0, 0)).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with highlights none a click or Space highlights nothing, no counter shows, and the keyboard still reads",
      async () => {
        const run = await host(dist, chartDocument({ ...BAR_PROPS, highlights: "none" }));
        await readyIn(run);
        const { board } = run;
        expect(await counter(board).count()).toBe(0);
        await clickBar(board, 0, 1);
        await tabIntoGroup(board, plan.props.text, chartOf(board));
        await liveIs(board, "Fix A, Failures: 4 runs");
        await board.page.keyboard.press("ArrowRight");
        await liveIs(board, "Fix B, Failures: 9 runs");
        await board.page.keyboard.press("Space");
        await Bun.sleep(QUIET_MS);
        expect(await live(board).textContent()).toBe("Fix B, Failures: 9 runs");
        expect(await ringOf(board, 0, 1)).toBe(false);
        expect(run.drafts).toEqual([]);
        expect(await board.answer.isDisabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Tab, Right and Space highlight the second category of the first series, the live region reading each point; the chart is one Tab stop",
      async () => {
        const run = await host(dist, chartDocument(BAR_PROPS));
        await readyIn(run);
        const { board } = run;
        await tabIntoGroup(board, plan.props.text, chartOf(board));
        await liveIs(board, "Fix A, Failures: 4 runs");
        await board.page.keyboard.press("ArrowRight");
        await liveIs(board, "Fix B, Failures: 9 runs");
        await board.page.keyboard.press("Space");
        await liveIs(board, "Fix B, Failures: 9 runs, highlighted");
        await counterIs(board, "1 point highlighted");
        await draftIs(run, { points: [point(0, 1)] }, "the draft to hold the point");
        expect(await ringOf(board, 0, 1)).toBe(true);
        // Down goes across series, Enter clears as Space does, Home and End go to the ends.
        await board.page.keyboard.press("ArrowDown");
        await liveIs(board, "Fix B, Reruns: 3 runs");
        await board.page.keyboard.press("ArrowUp");
        await board.page.keyboard.press("Enter");
        await liveIs(board, "Fix B, Failures: 9 runs");
        await draftIs(run, undefined, "the draft to hold no result after Enter");
        await board.page.keyboard.press("End");
        await liveIs(board, "Fix B, Reruns: 3 runs");
        await board.page.keyboard.press("Home");
        await liveIs(board, "Fix A, Failures: 4 runs");
        expect(await tabLeavesGroup(board, chartOf(board))).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Right skips a point with no value: from the first marker of a line chart it reaches the third category",
      async () => {
        const run = await host(dist, chartDocument(LINE_PROPS));
        await readyIn(run);
        const { board } = run;
        await tabIntoGroup(board, plan.props.text, chartOf(board));
        await liveIs(board, "Q1, Actual: 10 k€");
        await board.page.keyboard.press("ArrowRight");
        await liveIs(board, "Q3, Actual: 14 k€");
        await board.page.keyboard.press("ArrowLeft");
        await liveIs(board, "Q1, Actual: 10 k€");
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Chart after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "once the ask closes the chart keeps its rings and a click or key adds no draft record and no act",
      async () => {
        const run = await start(lifecycleScenario(chartAsk(BAR_PROPS), dist));
        const board = await openBoard(run, ["plan"]);
        await clickBar(board, 0, 1);
        await counterIs(board, "1 point highlighted");
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", CHART_ID, { points: [point(0, 1)] }),
          "the draft to hold the point",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({ [CHART_ID]: { points: [point(0, 1)] } });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await counter(board).textContent()).toBe("1 point highlighted");
        expect(await ringOf(board, 0, 1)).toBe(true);
        // The agent closes the ask: the chart is read-only, the ring and the counter stay.
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const [drafts, acts] = [sentDrafts(run).length, sentActs(run).length];
        await clickBar(board, 0, 0);
        await tabIntoGroup(board, plan.props.text, chartOf(board));
        await board.page.keyboard.press("ArrowRight");
        await board.page.keyboard.press("Space");
        await Bun.sleep(QUIET_MS);
        expect(await counter(board).textContent()).toBe("1 point highlighted");
        expect(await ringOf(board, 0, 1)).toBe(true);
        expect(await ringOf(board, 0, 0)).toBe(false);
        expect([sentDrafts(run).length, sentActs(run).length]).toEqual([drafts, acts]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
