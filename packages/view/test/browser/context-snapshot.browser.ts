// The context items' Snapshot look, in each engine (excerpts, task 6.4; view spec, "Context in a
// Snapshot view"; EXPERIENCE, Snapshots): the view boots from its `askboard-data` block as the
// tab's own page, with no parent host. A FILE reference shows its path and anchor as text with
// "not available in a Snapshot" and opens nothing; an excerpt offers no "Open in reading panel";
// a web reference is a link that opens only on a click, in a new tab, with `noopener` and
// `noreferrer`. Nothing is requested but the page.

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { Browser, Page } from "playwright";
import {
  SNAPSHOT_FILE_POINTER,
  SNAPSHOT_GITHUB_URL,
  SNAPSHOT_WEB_URL,
  snapshotDocument,
} from "./fixtures/context-documents.ts";
import { type Closable, closeAll, eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { BoardContext, launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { startStandaloneView } from "./harness/standalone-view.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const itemOf = (page: Page, id: string) => page.locator(`[data-askboard-item="${id}"]`);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: context in a Snapshot view`, () => {
    let browser: Browser | undefined;
    const open: Closable[] = [];
    beforeAll(async () => {
      browser = await launchEngine(engine);
    });
    afterEach(async () => {
      await closeAll(open.splice(0));
    });
    afterAll(async () => {
      await browser?.close();
    });

    const boot = async () => {
      if (browser === undefined) throw new Error(`${engine} did not launch`);
      const server = startStandaloneView(dist, snapshotDocument);
      open.push(server);
      const context = await BoardContext.open(browser);
      open.push(context);
      const page = await context.newTab(server.url);
      await itemOf(page, "snap-file").waitFor();
      return { page, context, server };
    };

    test(
      "a FILE reference shows its path as text, 'not available in a Snapshot', and opens nothing",
      async () => {
        const { page, context, server } = await boot();
        const file = itemOf(page, "snap-file");
        await expect(file.getByText(SNAPSHOT_FILE_POINTER, { exact: true }).count()).resolves.toBe(
          1,
        );
        await file.getByText("not available in a Snapshot", { exact: true }).waitFor();
        expect(await file.getByRole("button").count()).toBe(0);
        expect(await file.getByRole("link").count()).toBe(0);
        expect(await file.getByText("opens in a reading panel").count()).toBe(0);
        await file.click();
        await page.keyboard.press("Enter");
        await Bun.sleep(300);
        expect(context.context.pages()).toHaveLength(1);
        expect(page.url()).toBe(server.url);
        expect(context.cspProblems()).toEqual([]);
        expect(context.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an excerpt offers no 'Open in reading panel'",
      async () => {
        const { page, context } = await boot();
        const excerpt = itemOf(page, "snap-excerpt");
        await excerpt.waitFor();
        expect(await page.getByText("Open in reading panel").count()).toBe(0);
        expect(await excerpt.getByRole("button").count()).toBe(0);
        expect(context.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a web reference is a link for a new tab with noopener and noreferrer; a GITHUB one too",
      async () => {
        const { page, server } = await boot();
        for (const [id, url] of [
          ["snap-github", SNAPSHOT_GITHUB_URL],
          ["snap-web", SNAPSHOT_WEB_URL],
        ] as const) {
          const link = itemOf(page, id).getByRole("link");
          await eventually(async () => (await link.count()) === 1, `the link of ${id}`);
          expect(await link.getAttribute("href")).toBe(url);
          expect(await link.getAttribute("target")).toBe("_blank");
          const rel = ((await link.getAttribute("rel")) ?? "").split(/\s+/);
          expect(rel).toContain("noopener");
          expect(rel).toContain("noreferrer");
        }
        // Nothing opened by itself: only the page was requested.
        expect(server.requests).toEqual(["GET /"]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
