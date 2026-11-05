// An opened Snapshot in each engine (snapshot tasks 8.1 to 8.3; view-and-widgets spec: The
// Snapshot view's chrome, Read-only and navigable, Theme in a Snapshot): the page assembled from
// the contract's Snapshot fixture, opened from `file://`, with every request recorded.

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { lifecycleSnapshotData, treeBoardDocument } from "@askboard/contract/fixtures";
import type { Browser, BrowserContext, Page } from "playwright";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { writeSnapshot } from "./harness/snapshot-file.ts";

type Opened = {
  readonly page: Page;
  readonly requests: string[];
  readonly violations: string[];
};

const CONTROLS = [
  "Answer",
  "Postpone",
  "More",
  "Ask a follow-up",
  "Settings",
  "Submit",
  "Select recommended",
  "Snapshot",
];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an opened Snapshot`, () => {
    let browser: Browser;
    const contexts: BrowserContext[] = [];
    beforeAll(async () => {
      browser = await launchEngine(engine);
    });
    afterEach(async () => {
      await Promise.all(contexts.splice(0).map((context) => context.close()));
    });
    afterAll(async () => {
      await browser?.close();
    });

    const open = async (
      data: typeof lifecycleSnapshotData,
      options: { colorScheme?: "dark" | "light"; offline?: boolean; beside?: string } = {},
    ): Promise<Opened> => {
      const path = await writeSnapshot(data);
      // A script file placed beside the Snapshot, as a hostile folder would hold (task 8.4).
      if (options.beside !== undefined) {
        await Bun.write(join(dirname(path), options.beside), "window.__placedScriptRan = true;");
      }
      const context = await browser.newContext({
        ...(options.colorScheme === undefined ? {} : { colorScheme: options.colorScheme }),
      });
      contexts.push(context);
      await context.addInitScript(() => {
        // Anything that touches Web Storage or IndexedDB is recorded, for the no-storage test.
        const touched: string[] = [];
        (window as unknown as { __storage: string[] }).__storage = touched;
        for (const method of ["getItem", "setItem", "removeItem", "clear", "key"] as const) {
          const original = Storage.prototype[method] as (...args: unknown[]) => unknown;
          Storage.prototype[method] = function (this: Storage, ...args: unknown[]) {
            touched.push(method);
            return original.apply(this, args);
          } as never;
        }
        const openDb = indexedDB.open.bind(indexedDB);
        indexedDB.open = (...args: Parameters<typeof openDb>) => {
          touched.push("indexedDB");
          return openDb(...args);
        };
        document.addEventListener("securitypolicyviolation", (event) => {
          console.error(`CSP ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      if (options.offline === true) await context.setOffline(true);
      const page = await context.newPage();
      const requests: string[] = [];
      const violations: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      page.on("console", (message) => {
        if (message.text().startsWith("CSP ")) violations.push(message.text());
      });
      await page.goto(`file://${path}`);
      await page.getByRole("heading", { level: 1 }).waitFor({ timeout: STEP_TIMEOUT_MS });
      return { page, requests, violations };
    };

    test(
      "the agent's Snapshot: the top line, the answered state, no control that acts",
      async () => {
        const { page, requests, violations } = await open(lifecycleSnapshotData);
        const line = page.getByText(/^Snapshot · taken .* by the agent · read-only$/);
        await line.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await page.title()).toBe(`Snapshot · ${lifecycleSnapshotData.document.title}`);
        for (const name of CONTROLS) {
          expect(await page.getByRole("button", { name, exact: true }).count()).toBe(0);
        }
        expect(await page.getByRole("status", { name: /^Agent/ }).count()).toBe(0);
        expect(await page.getByRole("banner").getByText("Answered").count()).toBeGreaterThan(0);
        expect(
          requests.filter((url) => !url.startsWith("file:") && !url.startsWith("data:")),
        ).toEqual([]);
        expect(violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the user's Snapshot says by whom and notes unsent work",
      async () => {
        const { page } = await open({
          ...lifecycleSnapshotData,
          snapshot: {
            takenAt: "2026-10-31T14:30:00Z",
            takenBy: "user",
            who: "Sara Conti",
            unsentWork: true,
          },
        });
        await page
          .getByText(/by Sara Conti · read-only · Your unsent work will not be in the Snapshot/)
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a hostile ask title shows as text in the tab and the header",
      async () => {
        const title = `<img src=x onerror="document.title='pwned'"><b>x</b>`;
        const { page } = await open({
          ...lifecycleSnapshotData,
          document: { ...lifecycleSnapshotData.document, title },
        });
        expect(await page.title()).toBe(`Snapshot · ${title}`);
        expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe(title);
        expect(await page.locator("img[src='x'], b").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    // The Snapshot's presentation as tabs, over the fixture's two areas.
    const tabbed = {
      ...lifecycleSnapshotData,
      document: { ...lifecycleSnapshotData.document, presentation: "tabs" as const },
    };

    /** Whether any control in the page could answer, decline, postpone, submit or send. */
    const actingControls = async (page: Page): Promise<number> => {
      const inputs = page.locator(
        "input:not([disabled]):not([readonly]), textarea:not([readonly]):not([disabled]), select:not([disabled])",
      );
      const names = [...CONTROLS, "Decline", "Explain", "Send", "Accept recommended", "Reopen"];
      let count = await inputs.count();
      for (const name of names) {
        count += await page.getByRole("button", { name, exact: true, disabled: false }).count();
      }
      return count;
    };

    test(
      "switching tabs and jumping to a postponed question work, and nothing could answer",
      async () => {
        const { page, requests } = await open(tabbed);
        const tabs = page.getByRole("tab");
        expect(await tabs.count()).toBeGreaterThan(1);
        await tabs.nth(1).click();
        expect(await tabs.nth(1).getAttribute("aria-selected")).toBe("true");
        await tabs.nth(0).click();
        await page.getByRole("button", { name: /Next open/ }).click({ timeout: STEP_TIMEOUT_MS });
        const analytics = page.locator('[data-askboard-question="analytics"]');
        await analytics.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        // The postponed marker is two short bars.
        expect(await analytics.locator(".w-0\\.5").count()).toBe(2);
        expect(await actingControls(page)).toBe(0);
        expect(
          requests.filter((url) => !url.startsWith("file:") && !url.startsWith("data:")),
        ).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Tree's branch collapses and expands in a Snapshot",
      async () => {
        const [plan] = treeBoardDocument.items;
        const { page } = await open({
          ...lifecycleSnapshotData,
          document: treeBoardDocument as unknown as typeof lifecycleSnapshotData.document,
          revisions: [],
          events: [],
          state: {
            ask: "waiting",
            questions: [{ itemId: plan.id, rev: plan.rev, state: "open" }],
          } as typeof lifecycleSnapshotData.state,
        });
        const rows = page.locator('[role="treegrid"] [data-node-id]');
        const chevron = page.locator('[role="treegrid"] [data-chevron]').first();
        await chevron.waitFor({ timeout: STEP_TIMEOUT_MS });
        const before = await rows.count();
        await chevron.click();
        await eventually(async () => (await rows.count()) !== before, "the branch changes");
        await chevron.click();
        await eventually(async () => (await rows.count()) === before, "the branch returns");
      },
      TEST_TIMEOUT_MS,
    );

    const isDark = (page: Page) =>
      page.evaluate(() => document.documentElement.classList.contains("dark"));

    test(
      "a dark system opens dark, Light shows light, reopening shows dark; no storage touched",
      async () => {
        const first = await open(lifecycleSnapshotData, { colorScheme: "dark" });
        expect(await isDark(first.page)).toBe(true);
        await first.page.getByRole("button", { name: "Light", exact: true }).click();
        expect(await isDark(first.page)).toBe(false);
        await first.page.getByRole("button", { name: "Dark", exact: true }).click();
        expect(await isDark(first.page)).toBe(true);
        await first.page.getByRole("button", { name: "Light", exact: true }).click();
        expect(
          await first.page.evaluate(() => (window as never as { __storage: string[] }).__storage),
        ).toEqual([]);
        const again = await open(lifecycleSnapshotData, { colorScheme: "dark" });
        expect(await isDark(again.page)).toBe(true);
        expect(
          await again.page
            .getByRole("button", { name: "System", exact: true })
            .getAttribute("aria-pressed"),
        ).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "opened offline from file://: it shows with no request and no CSP violation, and a placed script never runs",
      async () => {
        const { page, requests, violations } = await open(tabbed, {
          offline: true,
          beside: "themes.js",
        });
        await page.getByText(/^Snapshot · taken/).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await page.getByRole("tab").count()).toBeGreaterThan(1);
        expect(
          requests.filter((url) => !url.startsWith("file:") && !url.startsWith("data:")),
        ).toEqual([]);
        // The only file the page may load is itself.
        expect(
          requests.filter((url) => url.startsWith("file:") && !url.endsWith("snapshot.html")),
        ).toEqual([]);
        expect(violations).toEqual([]);
        expect(
          await page.evaluate(() => (window as never as Record<string, unknown>).__placedScriptRan),
        ).toBeUndefined();
      },
      TEST_TIMEOUT_MS,
    );
  });
}
