// A board holding a bar, a line and a pie chart, hovered, highlighted, switched from Light to Dark
// and resized, in each engine (chart-widget, task 6.2; spec view-and-widgets: Charts request
// nothing, A Chart follows the theme): the highlights are kept through the switch and the resize,
// each chart is redrawn in the dark palette (`chart-1` read from the theme and found as the
// colour of the canvas under the first series), and no Content Security Policy violation occurs
// and no request leaves the page for anything but the session process. The session process
// serves every scenario.

import { describe, expect, test } from "bun:test";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import { plan } from "./fixtures/tree-documents.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { boxOf, pixelAt, wearsRing } from "./harness/chart-points.ts";
import {
  type BarRig,
  barOf,
  chartOf,
  clickBar,
  counterIs,
  markerOf,
  ringOfBar,
  sliceOf,
} from "./harness/chart-steps.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const [BAR, LINE, PIE] = CHART_FIXTURE_ITEMS;
const ask = {
  askId: "chart-theme-t6c2",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { ...plan.props, items: [BAR, LINE, PIE] },
    },
  ],
} as const;

// The charts in the order the question holds them: nth 0, 1 and 2 of `[data-chart]`.
const BAR_RIG: BarRig = {
  layout: { categories: 3, series: 2, axisMax: 10 },
  values: [
    [4, 9, 2],
    [1, 3, null],
  ],
};
// The line's axis ends at 15 (the highest value, 14, plus the round step of 5), with both names.
const LINE_RIG: BarRig = {
  layout: { categories: 4, series: 2, axisMax: 15, valueName: true, categoryName: true },
  values: [
    [10, null, 14, 13],
    [12, 12, 12, 12],
  ],
};
const SLICES = [60, 30, 10] as const;
const [BARS, LINES, PIES] = [0, 1, 2] as const;

// DESIGN's `chart-1`, the first series' colour, in each theme.
const CHART_1 = { light: "#2a78d6", dark: "#3987e5" } as const;

const themeRadio = (board: Board, name: "System" | "Light" | "Dark") =>
  board.view.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name, exact: true });

const isDark = async (board: Board): Promise<boolean> =>
  ((await board.view.locator("html").getAttribute("class")) ?? "").split(/\s+/).includes("dark");

const token = (board: Board, name: string): Promise<string> =>
  chartOf(board, BARS).evaluate(
    (element, variable) => getComputedStyle(element).getPropertyValue(variable).trim(),
    name,
  );

// The canvas colour in the middle of the bar of the first series at the first category.
const firstBarColour = async (board: Board): Promise<string | undefined> => {
  const { centre } = await barOf(board, BAR_RIG, 0, 0, BARS);
  return pixelAt(chartOf(board, BARS), centre);
};

// Highlights one point in each chart, by pointer: the bar fails in fix-a, the line's Actual in
// Q3, the pie's UX.
const highlightEach = async (board: Board): Promise<void> => {
  await clickBar(board, BAR_RIG, 0, 0, BARS);
  await counterIs(board, "1 point highlighted", BARS);
  const marker = await markerOf(board, LINE_RIG, 2, 14, LINES);
  const lineBox = await boxOf(chartOf(board, LINES));
  await board.page.mouse.click(lineBox.x + marker.x, lineBox.y + marker.y);
  await counterIs(board, "1 point highlighted", LINES);
  const slice = await sliceOf(board, SLICES, 0, PIES);
  const pieBox = await boxOf(chartOf(board, PIES));
  await board.page.mouse.click(pieBox.x + slice.x, pieBox.y + slice.y);
  await counterIs(board, "1 point highlighted", PIES);
};

// Whether the line's marker at Q3 wears its ring: 8px across, the ring 2px outside it.
const markerRing = async (board: Board): Promise<boolean> =>
  wearsRing(chartOf(board, LINES), await markerOf(board, LINE_RIG, 2, 14, LINES), 10);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a bar, a line and a pie chart across hovering, a theme switch and a resize`, () => {
    const { start } = useEngine(engine);

    test(
      "hovered and highlighted, then switched from Light to Dark and resized: the highlights stay, the dark palette is read and drawn, and nothing is blocked or requested",
      async () => {
        const run = await start(lifecycleScenario(ask, dist));
        const requests: string[] = [];
        run.browser.context.on("request", (request) => requests.push(request.url()));
        const board = await openBoard(run, ["plan"]);
        await themeRadio(board, "Light").click();
        await eventually(async () => !(await isDark(board)), "the light theme");
        expect(await token(board, "--chart-1")).toBe(CHART_1.light);
        await eventually(async () => (await firstBarColour(board)) === CHART_1.light, "light bars");
        await highlightEach(board);
        const settled = requests.length;
        // Hover: the pointer over a bar, a marker and a slice changes no highlight.
        const bar = await barOf(board, BAR_RIG, 0, 1, BARS);
        const barBox = bar.box;
        await board.page.mouse.move(barBox.x + bar.centre.x, barBox.y + bar.centre.y);
        await board.page.mouse.move(barBox.x + bar.centre.x + 2, barBox.y + bar.centre.y + 2);
        expect(await ringOfBar(board, BAR_RIG, 0, 1, BARS)).toBe(false);
        // Light to Dark: the palette read again, the highlight kept.
        await themeRadio(board, "Dark").click();
        await eventually(() => isDark(board), "the dark theme");
        expect(await token(board, "--chart-1")).toBe(CHART_1.dark);
        await eventually(async () => (await firstBarColour(board)) === CHART_1.dark, "dark bars");
        for (const nth of [BARS, LINES, PIES]) await counterIs(board, "1 point highlighted", nth);
        expect(await ringOfBar(board, BAR_RIG, 0, 0, BARS)).toBe(true);
        // A resize: each chart is drawn again at its new width, the highlights kept.
        const before = (await boxOf(chartOf(board, BARS))).width;
        await board.page.setViewportSize({ width: 820, height: 760 });
        await eventually(
          async () => (await boxOf(chartOf(board, BARS))).width < before,
          "narrower",
        );
        await eventually(() => ringOfBar(board, BAR_RIG, 0, 0, BARS), "the ring after the resize");
        await eventually(async () => (await firstBarColour(board)) === CHART_1.dark, "dark bars");
        for (const nth of [BARS, LINES, PIES]) await counterIs(board, "1 point highlighted", nth);
        await Bun.sleep(QUIET_MS);
        expect(await markerRing(board)).toBe(true);
        expectNoCspProblem(run);
        const origin = new URL(run.session.link).origin;
        expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
        expect(requests.slice(settled)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a board that opens on a dark system with the theme System draws the dark palette, and Light then draws the light one with the highlights kept",
      async () => {
        const run = await start(lifecycleScenario(ask, dist), { colorScheme: "dark" });
        const board = await openBoard(run, ["plan"]);
        await eventually(() => isDark(board), "the dark theme from the system");
        expect(await token(board, "--chart-1")).toBe(CHART_1.dark);
        await eventually(async () => (await firstBarColour(board)) === CHART_1.dark, "dark bars");
        await clickBar(board, BAR_RIG, 0, 0, BARS);
        await counterIs(board, "1 point highlighted", BARS);
        await themeRadio(board, "Light").click();
        await eventually(async () => !(await isDark(board)), "the light theme");
        await eventually(async () => (await firstBarColour(board)) === CHART_1.light, "light bars");
        expect(await ringOfBar(board, BAR_RIG, 0, 0, BARS)).toBe(true);
        await board.view
          .locator('[data-askboard-question="plan"]')
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
