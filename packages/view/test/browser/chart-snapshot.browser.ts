// A Snapshot of a board answered with a Chart, in each engine (chart-widget, task 6.3; spec
// view-and-widgets: Charts to read and read-only charts, scenario "A Snapshot"): the agent takes
// the Snapshot after the user's answer holding two highlighted points, the session process exits,
// and the file opens from `file://` offline. The chart is drawn with its two rings and the counter
// reads "2 points highlighted"; a click, Tab, arrow keys and Space change nothing; the page opens in
// the colour scheme of the system and follows a switch of the theme; no Content Security Policy
// violation occurs and no request is made; and the file inlines the `chart` chunk whole. The
// session process serves this test whatever the target.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser, Page } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import { BAR_PROPS, CHART_ID, chartAsk } from "./fixtures/chart-documents.ts";
import type { Asker } from "./harness/asker.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { barCentre, barWidthOf, boxOf, pixelAt, wearsRing } from "./harness/chart-points.ts";
import { clickBar } from "./harness/chart-steps.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };
const LAYOUT = { categories: 3, series: 2, axisMax: 10 } as const;
const VALUES = [4, 9, 2] as const;
const CHART_1 = { light: "#2a78d6", dark: "#3987e5" } as const;

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): SnapshotData => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start))) as SnapshotData;
};

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

// The first series' bar at `category`: its centre in the chart's box and whether it wears a ring.
const barAt = async (page: Page, category: number) => {
  const chart = page.locator("[data-chart]");
  const box = await boxOf(chart);
  const centre = barCentre(LAYOUT, box, {
    series: 0,
    category,
    value: VALUES[category] ?? 0,
  });
  return { chart, box, centre, ring: () => wearsRing(chart, centre, barWidthOf(LAYOUT, box)) };
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Snapshot of a board answered with a Chart`, () => {
    const { start } = useEngine(engine);

    test(
      "opened offline from file://, the chart is drawn with its two rings and changes nothing on a click or a key, follows the system theme and a switch, with the chunk inlined whole and no violation",
      async () => {
        const run = await start({ ...lifecycleScenario(chartAsk(BAR_PROPS), dist), asker: ASKER });
        const board = await openBoard(run, ["plan"]);
        await clickBar(board, { layout: LAYOUT, values: [VALUES, [1, 3, null]] }, 0, 2);
        await clickBar(board, { layout: LAYOUT, values: [VALUES, [1, 3, null]] }, 0, 0);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByText("Answered").waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        const data = dataBlockOf(html);
        expect(validateSnapshotData(data).ok).toBe(true);
        expect(JSON.stringify(data.document)).toContain(CHART_ID);
        // The `chart` chunk is among those `assemble` selects, and the file holds its script whole.
        const chunks = selectChunks(data.document, dist.manifest, targetOf(data));
        expect(chunks.map(({ name }) => name)).toContain("chart");
        for (const { name, chunk } of chunks) {
          const text = dist.files.get(chunk.script.path);
          expect({ name, inlined: text !== undefined && html.includes(text) }).toEqual({
            name,
            inlined: true,
          });
        }

        const browser: Browser = await launchEngine(engine);
        try {
          const context = await browser.newContext({
            offline: true,
            colorScheme: "dark",
            viewport: { width: 1280, height: 800 },
          });
          await context.addInitScript(() => {
            document.addEventListener("securitypolicyviolation", (event) => {
              console.error(`CSP ${event.violatedDirective} ${event.blockedURI}`);
            });
          });
          const page = await context.newPage();
          const violations: string[] = [];
          page.on("console", (message) => {
            if (message.text().startsWith("CSP ")) violations.push(message.text());
          });
          const requests: string[] = [];
          page.on("request", (request) => requests.push(request.url()));
          await page.goto(`file://${taken.path}`);
          const counter = page.locator("[data-chart-counter]");
          await counter.waitFor({ timeout: STEP_TIMEOUT_MS });
          // The chart in the colour scheme of the system, with both rings and no other.
          expect(await isDark(page)).toBe(true);
          await eventually(async () => {
            const { chart, centre } = await barAt(page, 1);
            return (await pixelAt(chart, centre)) === CHART_1.dark;
          }, "the dark bars");
          expect(await counter.textContent()).toBe("2 points highlighted");
          await eventually(async () => (await barAt(page, 0)).ring(), "the ring on fix-a");
          expect(await (await barAt(page, 2)).ring()).toBe(true);
          expect(await (await barAt(page, 1)).ring()).toBe(false);
          // Nothing can be highlighted, cleared or set: a click, Tab, arrow keys and Space.
          const other = await barAt(page, 1);
          const at = await boxOf(other.chart);
          await page.mouse.click(at.x + other.centre.x, at.y + other.centre.y);
          await other.chart.focus();
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("Space");
          await page.keyboard.press("Enter");
          const first = await barAt(page, 0);
          await page.mouse.click(at.x + first.centre.x, at.y + first.centre.y);
          await new Promise((resolve) => setTimeout(resolve, 500));
          expect(await counter.textContent()).toBe("2 points highlighted");
          expect(await (await barAt(page, 0)).ring()).toBe(true);
          expect(await (await barAt(page, 2)).ring()).toBe(true);
          expect(await (await barAt(page, 1)).ring()).toBe(false);
          // A switch of the theme draws the light palette and keeps the rings.
          await page
            .getByRole("radiogroup", { name: "Theme" })
            .getByRole("radio", { name: "Light", exact: true })
            .click();
          expect(await isDark(page)).toBe(false);
          await eventually(async () => {
            const { chart, centre } = await barAt(page, 1);
            return (await pixelAt(chart, centre)) === CHART_1.light;
          }, "the light bars");
          expect(await (await barAt(page, 0)).ring()).toBe(true);
          expect(await (await barAt(page, 2)).ring()).toBe(true);
          expect(await counter.textContent()).toBe("2 points highlighted");
          expect(violations).toEqual([]);
          // The only request is the file itself.
          expect(requests.filter((url) => !url.startsWith("file://"))).toEqual([]);
          await context.close();
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
