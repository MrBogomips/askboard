// One end-to-end run on the session process (snapshot task 9.1): an agent asks a board of two
// questions, the user answers on the board, the agent calls `snapshot` and gets an absolute path
// under the project's `.askboard/snapshots/`, the session process exits, and the file opens offline
// in each engine, holding the user's answer and no token. The session process serves this test
// whatever the target, since the ask is sent as it is.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser } from "playwright";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import type { Asker } from "./harness/asker.ts";
import { linkToken, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard, optionOf } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): unknown => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start)));
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Snapshot from a real session`, () => {
    const { start } = useEngine(engine);

    test(
      "answered on the board, taken by the agent, opened offline after the session ended",
      async () => {
        const run = await start({ ...lifecycleScenario(twoAsk, dist), asker: ASKER });
        const board = await openBoard(run, ["database", "cache"]);
        for (const [id, label] of [
          ["database", "PostgreSQL"],
          ["cache", "Yes"],
        ] as const) {
          await optionOf(board, id, label).click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
        }
        await board.header.getByText("Answered").waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        expect(taken.path).toMatch(
          new RegExp(`/\\.askboard/snapshots/${twoAsk.askId}-[^/]+\\.html$`),
        );
        await run.session.exit();
        const file = Bun.file(taken.path);
        const html = await file.text();
        // The data block validates, holds the user's answer and says the agent took it.
        const data = dataBlockOf(html);
        expect(validateSnapshotData(data).ok).toBe(true);
        expect(JSON.stringify(data)).toContain("PostgreSQL");
        expect((data as { snapshot: { takenBy: string } }).snapshot.takenBy).toBe("agent");
        expect(html).not.toContain(linkToken(run));
        console.log(
          `snapshot size ${file.size} bytes, taken at ${(data as { snapshot: { takenAt: string } }).snapshot.takenAt}`,
        );

        // Opened offline, in a fresh context, with the session process gone.
        const browser: Browser = await launchEngine(engine);
        try {
          const context = await browser.newContext({ offline: true });
          const page = await context.newPage();
          const requests: string[] = [];
          page.on("request", (request) => requests.push(request.url()));
          await page.goto(`file://${taken.path}`);
          await page.getByText(/^Snapshot · taken .* by the agent · read-only$/).waitFor({
            timeout: STEP_TIMEOUT_MS,
          });
          await page.getByText("PostgreSQL").first().waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(
            requests.filter((url) => !url.startsWith("file:") && !url.startsWith("data:")),
          ).toEqual([]);
          await context.close();
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Light and Comfortable picked on the board, with a dark system, are what the file opens in",
      async () => {
        const run = await start(
          { ...lifecycleScenario(twoAsk, dist), asker: ASKER },
          { colorScheme: "dark" },
        );
        const board = await openBoard(run, ["database", "cache"]);
        await board.view
          .getByRole("radiogroup", { name: "Theme" })
          .getByRole("radio", { name: "Light" })
          .click({ timeout: STEP_TIMEOUT_MS });
        await board.view
          .getByRole("radiogroup", { name: "Density" })
          .getByRole("radio", { name: "Comfortable" })
          .click({ timeout: STEP_TIMEOUT_MS });
        await board.view.locator("html.comfortable").waitFor({ state: "attached" });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const browser: Browser = await launchEngine(engine);
        try {
          const context = await browser.newContext({ colorScheme: "dark", offline: true });
          const page = await context.newPage();
          await page.goto(`file://${taken.path}`);
          await page.getByText(/^Snapshot · taken/).waitFor({ timeout: STEP_TIMEOUT_MS });
          const classes = ((await page.locator("html").getAttribute("class")) ?? "").split(/\s+/);
          expect(classes).toContain("comfortable");
          expect(classes).not.toContain("dark");
          const group = page.getByRole("radiogroup", { name: "Theme" });
          expect(await group.count()).toBe(1);
          expect(
            await group.getByRole("radio", { name: "Light" }).getAttribute("aria-checked"),
          ).toBe("true");
          await context.close();
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
