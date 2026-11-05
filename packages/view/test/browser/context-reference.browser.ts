// A reference's click, in each engine (excerpts, task 6.5; view spec, "References open in one
// click"): the view sends `open-reference` naming the item, and the board page opens the URL it
// holds for that item in one new tab, with no opener and no referrer. The pages the references
// name are answered by the test, so nothing leaves the machine; no agent message goes with a click.

import { describe, expect, test } from "bun:test";
import type { Page } from "playwright";
import { PULL_URL, RUNBOOK_URL, webReferenceAsk } from "./fixtures/context-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard, sentActs } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const OPENED_TITLE = "Opened by the test";

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a reference's click`, () => {
    const { start } = useEngine(engine);

    for (const [id, url] of [
      ["runbook", RUNBOOK_URL],
      ["pull", PULL_URL],
    ] as const) {
      test(
        `a click on the ${id} reference opens its URL in one new tab, which has no opener`,
        async () => {
          const run = await start(lifecycleScenario(webReferenceAsk, dist));
          const requested: string[] = [];
          await run.browser.context.route(url, async (route) => {
            requested.push(route.request().url());
            await route.fulfill({
              contentType: "text/html",
              body: `<!doctype html><title>${OPENED_TITLE}</title><p>opened</p>`,
            });
          });
          const board = await openBoard(run, ["links"]);
          const before = run.browser.context.pages().length;
          const opened = run.browser.context.waitForEvent("page", { timeout: STEP_TIMEOUT_MS });
          await board.view.locator(`[data-askboard-item="${id}"]`).getByRole("button").click();
          const page: Page = await opened;
          await page.waitForLoadState("domcontentloaded");
          expect(await page.title()).toBe(OPENED_TITLE);
          expect(await page.evaluate(() => window.opener)).toBeNull();
          await eventually(async () => requested.length === 1, "the opened page's one request");
          expect(requested[0]).toBe(url);
          expect(run.browser.context.pages().length).toBe(before + 1);
          // The board page stays where it was, and no agent message went with the click.
          expect(new URL(board.page.url()).pathname).toBe(new URL(run.session.link).pathname);
          expect(sentActs(run)).toEqual([]);
          expectNoCspProblem(run);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
