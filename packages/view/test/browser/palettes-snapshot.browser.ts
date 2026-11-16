// A palette in a Snapshot, from a real session (palettes, task 6.3; view-and-widgets spec: A
// palette in a Snapshot): taken while the user file sets Grafite, the file holds Carta's tokens and
// Grafite's stylesheet and no rule of Nordico or Contrasto's tokens, records the palette and opens
// with `data-palette="grafite"` and no palette row; taken with none set, it holds no palette
// stylesheet and opens with no attribute. The non-hosted branch of the shell applies the record.
// Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser } from "playwright";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ask = { ...twoAsk, askId: "two-palette-snapshot-p6c3" };
const dataBlockOf = (page: string): unknown => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start)));
};

/** Whether the file holds a rule that sets tokens under the palette's attribute. */
const holdsTokens = (html: string, palette: string): boolean =>
  new RegExp(`data-palette="?${palette}"?\\][^{]*\\{[^}]*--background`).test(html);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a palette in a Snapshot`, () => {
    const { start } = useEngine(engine);

    const takeAndOpen = async (user: unknown) => {
      const run = await start({ ...lifecycleScenario(ask, dist), config: { user } });
      const board = await openBoard(run, ["database", "cache"]);
      await board.themeControl.waitFor({ timeout: STEP_TIMEOUT_MS });
      const taken = await run.session.snapshot();
      await run.session.exit();
      const html = await Bun.file(taken.path).text();
      const browser: Browser = await launchEngine(engine);
      const context = await browser.newContext({ offline: true });
      const page = await context.newPage();
      await page.goto(`file://${taken.path}`);
      await page.getByText(/^Snapshot · taken/).waitFor({ timeout: STEP_TIMEOUT_MS });
      return { html, page, close: () => browser.close() };
    };

    test(
      "taken in Grafite: the record, one palette sheet, the attribute on open and no palette row",
      async () => {
        const { html, page, close } = await takeAndOpen({ version: "1.0", palette: "grafite" });
        try {
          const data = dataBlockOf(html) as { snapshot: { presentation?: { palette?: string } } };
          expect(validateSnapshotData(data).ok).toBe(true);
          expect(data.snapshot.presentation?.palette).toBe("grafite");
          expect(holdsTokens(html, "grafite")).toBe(true);
          expect(holdsTokens(html, "nordico")).toBe(false);
          expect(holdsTokens(html, "contrasto")).toBe(false);
          expect(await page.locator("html").getAttribute("data-palette")).toBe("grafite");
          await page.locator("[data-askboard-theme]").click({ timeout: STEP_TIMEOUT_MS });
          await page.getByRole("radiogroup", { name: "Theme" }).waitFor();
          expect(await page.getByRole("radiogroup", { name: "Density" }).count()).toBe(1);
          expect(await page.locator("[data-askboard-palette]").count()).toBe(0);
        } finally {
          await close();
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "taken in Carta: no palette stylesheet in the file, and no attribute on open",
      async () => {
        const { html, page, close } = await takeAndOpen({ version: "1.0" });
        try {
          const data = dataBlockOf(html) as { snapshot: { presentation?: { palette?: string } } };
          expect(data.snapshot.presentation?.palette).toBe("carta");
          for (const palette of ["nordico", "grafite", "contrasto"]) {
            expect(holdsTokens(html, palette)).toBe(false);
          }
          expect(await page.locator("html").getAttribute("data-palette")).toBeNull();
        } finally {
          await close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
