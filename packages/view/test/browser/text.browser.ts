// The Text atom in each engine (atoms, task 5.1; view-and-widgets spec: Display atoms, Markdown
// rendered as data, Markdown links in the view, The board page opens Markdown links, Option previews
// in Markdown, Option previews): plain and Markdown Texts on the widget host, a click on a link
// leaving the view in place and sending the open-link message, an auxclick prevented, the same click
// through the real board page opening one tab with no opener, a Markdown preview with the `text`
// chunk loaded and a plain one unchanged, and a Snapshot's anchors opening natively in a new tab.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/text.browser.ts

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { URL_MAX_CHARS } from "@askboard/contract";
import type { Browser, BrowserContext, Page } from "playwright";
import { selectChunks } from "../../src/assemble/index.ts";
import type { ViewDocument } from "../../src/view-document.ts";
import { atomAsk, atomDocument, MARKDOWN_SOURCE, previewAsk } from "./fixtures/atom-documents.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard, sentActs } from "./harness/lifecycle-test.ts";
import { startStandaloneView } from "./harness/standalone-view.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const DOCS = "https://example.com/docs";
const intro = (source: string, format?: "markdown") => ({
  type: "text",
  id: "intro",
  props: { text: source, ...(format === undefined ? {} : { format }) },
});

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Text atom on the widget host`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "plain text shows its asterisks and line breaks; Markdown shows as elements, the bad scheme as text",
      async () => {
        const run = await host(
          dist,
          atomDocument([
            intro("**bold**\nsecond line"),
            { ...intro(MARKDOWN_SOURCE, "markdown"), id: "rich" },
          ]),
        );
        await readyIn(run);
        const { view } = run.board;
        const plain = view.locator('[data-askboard-item="intro"] [data-text-format="plain"]');
        expect(await plain.textContent()).toBe("**bold**\nsecond line");
        expect(await plain.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("pre-wrap");
        const rich = view.locator('[data-askboard-item="rich"] [data-text-format="markdown"]');
        expect(await rich.locator("h1").textContent()).toBe("Heading");
        expect(await rich.locator("strong").textContent()).toBe("bold");
        expect(await rich.locator("pre code").textContent()).toContain("const x = 1;");
        expect(await rich.locator("a").count()).toBe(1);
        expect(await rich.locator("a").getAttribute("href")).toBe(DOCS);
        expect(await rich.textContent()).toContain("[bad](javascript:alert(1))");
        expect(
          await rich.locator("pre code").evaluate((el) => getComputedStyle(el).fontFamily),
        ).toMatch(/mono/i);
        expect(await view.getByRole("alert").count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
        expect(run.requests.filter((url) => url.includes("example.com"))).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click on a link sends the open-link message and the view stays; an auxclick sends nothing and opens nothing",
      async () => {
        const run = await host(dist, atomDocument([intro(MARKDOWN_SOURCE, "markdown")]));
        await readyIn(run);
        const { board } = run;
        const frame = await board.viewFrame();
        const before = frame.url();
        const link = board.view.getByRole("link", { name: "docs" });
        await link.click();
        await eventually(
          () => run.messages.some((message) => message.type === "open-link"),
          "the open-link message",
          STEP_TIMEOUT_MS,
        );
        expect(run.messages.filter((message) => message.type === "open-link")).toEqual([
          { type: "open-link", itemId: "intro", url: DOCS },
        ]);
        expect(frame.url()).toBe(before);
        expect(await board.view.getByRole("heading", { name: "Heading" }).count()).toBe(1);
        // Middle button: prevented, no message, no new page.
        const pages = run.browser.context.pages().length;
        await link.click({ button: "middle" });
        await Bun.sleep(QUIET_MS);
        expect(run.messages.filter((message) => message.type === "open-link")).toHaveLength(1);
        expect(run.browser.context.pages().length).toBe(pages);
        expect(frame.url()).toBe(before);
        // The keyboard: Enter on the focused link is a click.
        await link.focus();
        await board.page.keyboard.press("Enter");
        await eventually(
          () => run.messages.filter((message) => message.type === "open-link").length === 2,
          "the second open-link message",
          STEP_TIMEOUT_MS,
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Text that holds no Markdown refuses nothing: raw markup in a plain Text is text",
      async () => {
        const run = await host(
          dist,
          atomDocument([intro("<img src=x onerror=alert(1)> <b>x</b>")]),
        );
        await readyIn(run);
        const text = run.board.view.locator(
          '[data-askboard-item="intro"] [data-text-format="plain"]',
        );
        expect(await text.textContent()).toBe("<img src=x onerror=alert(1)> <b>x</b>");
        expect(await text.locator("img, b").count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Markdown source over its bound shows as plain text, never half-rendered",
      async () => {
        // One reference definition of the longest URL a link may hold (2,048 characters), used by
        // about 1,400 links: about three million HTML characters, over the 200,000 cap, and still
        // links (a URL over 2,048 characters is no link, 5.9; a longer one would fail here).
        const target = "https://e.test/".padEnd(URL_MAX_CHARS, "a");
        const source = `[r]: ${target}\n\n${"[r][r] ".repeat(1_500)}`.slice(0, 10_000);
        const run = await host(dist, atomDocument([intro(source, "markdown")]));
        await readyIn(run);
        const text = run.board.view.locator('[data-askboard-item="intro"] [data-text-format]');
        expect(await text.getAttribute("data-text-format")).toBe("plain");
        expect(await text.locator("a").count()).toBe(0);
        expect((await text.textContent())?.startsWith("[r]: https://e.test/aaa")).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: Markdown on the board page`, () => {
    const { start } = useEngine(engine);

    test(
      "a click on a link opens its URL in one new tab with no opener, and sends the agent nothing",
      async () => {
        const run = await start(
          lifecycleScenario(atomAsk([intro(MARKDOWN_SOURCE, "markdown")]), dist),
        );
        const requested: string[] = [];
        await run.browser.context.route(DOCS, async (route) => {
          requested.push(route.request().url());
          await route.fulfill({
            contentType: "text/html",
            body: "<!doctype html><title>Opened</title>",
          });
        });
        const board = await openBoard(run, ["plan"]);
        const before = run.browser.context.pages().length;
        const opened = run.browser.context.waitForEvent("page", { timeout: STEP_TIMEOUT_MS });
        await board.view.getByRole("link", { name: "docs" }).click();
        const page: Page = await opened;
        await page.waitForLoadState("domcontentloaded");
        expect(await page.evaluate(() => window.opener)).toBeNull();
        await eventually(async () => requested.length === 1, "the opened page's one request");
        expect(run.browser.context.pages().length).toBe(before + 1);
        expect(new URL(board.page.url()).pathname).toBe(new URL(run.session.link).pathname);
        expect(sentActs(run)).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Markdown preview opens as Markdown with the text chunk loaded, and its link names the question; a plain preview stays plain",
      async () => {
        const run = await start(lifecycleScenario(previewAsk, dist));
        const board = await openBoard(run, ["database"]);
        const view = board.question("database");
        const previews = view.getByRole("button", { name: "Show preview" });
        await previews.nth(0).click();
        const shown = view.locator('[data-text-format="markdown"]');
        await shown.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await shown.locator("pre code").textContent()).toContain("SELECT 1;");
        expect(
          await shown.locator("pre code").evaluate((el) => getComputedStyle(el).fontFamily),
        ).toMatch(/mono/i);
        expect(await shown.locator("a").getAttribute("href")).toBe(DOCS);
        // The second option's preview is plain text, one preview open at a time.
        await previews.nth(1).click();
        await view.getByText("**plain** preview").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await view.locator('[data-text-format="markdown"]').count()).toBe(0);
        expect(await view.locator("strong").count()).toBe(0);
        expect(sentActs(run)).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: Markdown in a Snapshot's view`, () => {
    let browser: Browser;
    let context: BrowserContext | undefined;
    beforeAll(async () => {
      browser = await launchEngine(engine);
    });
    afterEach(async () => {
      await context?.close();
      context = undefined;
    });
    afterAll(async () => {
      await browser?.close();
    });

    test(
      "with no board page the links are anchors that open in a new tab with rel noopener noreferrer",
      async () => {
        const view = startStandaloneView(dist, atomDocument([intro(MARKDOWN_SOURCE, "markdown")]));
        try {
          context = await browser.newContext();
          await context.route("https://example.com/**", (route) =>
            route.fulfill({
              contentType: "text/html",
              body: "<!doctype html><title>Opened</title>",
            }),
          );
          const page = await context.newPage();
          await page.goto(view.url);
          const link = page.getByRole("link", { name: "docs" });
          await link.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await link.getAttribute("target")).toBe("_blank");
          expect(await link.getAttribute("rel")).toBe("noopener noreferrer");
          const opened = context.waitForEvent("page", { timeout: STEP_TIMEOUT_MS });
          await link.click();
          const tab = await opened;
          await tab.waitForLoadState("domcontentloaded");
          expect(await tab.evaluate(() => window.opener)).toBeNull();
          expect(page.url()).toBe(view.url);
        } finally {
          await view.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// The chunks a board holding one question of each kind needs: the text chunk only for Markdown.
describe("which boards load the text chunk (design decision 4)", () => {
  const names = (document: ViewDocument) =>
    selectChunks(document, dist.manifest).map(({ name }) => name);

  test("a Text item and a Markdown preview select it; a plain preview does not", () => {
    expect(names(atomDocument([intro("a")]))).toContain("text");
    const preview = previewAsk.items[0];
    const withPreview = (format?: "markdown") =>
      ({
        ...atomDocument([]),
        items: [
          {
            type: "question",
            id: "database",
            props: {
              ...preview.props,
              options: [
                {
                  label: "A",
                  preview: "x",
                  ...(format === undefined ? {} : { previewFormat: format }),
                },
              ],
            },
          },
        ],
      }) as unknown as ViewDocument;
    expect(names(withPreview("markdown"))).toContain("text");
    expect(names(withPreview())).not.toContain("text");
  });
});
