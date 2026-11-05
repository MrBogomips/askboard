// The context components' scenarios, in each engine, on the widget host (excerpts, task 6.2;
// design decision 6; view spec, "Excerpts show as source text", "References open in one click",
// "Images by pointer", "Context counts for a visible question"). An excerpt shows its caption and
// its body as source text numbered from its first line, capped in height and scrolling inside;
// Markdown soft-wraps under a hanging indent and code scrolls sideways. Agent strings show as text
// and add no element (AD-8), and a bidirectional control shows as a marker. An unresolved excerpt
// or image shows "Unresolved" with its pointer. A reference shows its kind, its path or title and
// its hint, the external mark only on one that opens in the browser. An image shows from a `blob:`
// URL, revoked once it is gone, and counts as ready only once decoded. Nothing makes a request.

import { describe, expect, test } from "bun:test";
import { contextBoardDocument } from "@askboard/contract/fixtures";
import type { BrowserContext, Frame, Locator } from "playwright";
import {
  BIDI_LINE,
  bidiDocument,
  CHECKOUT_LINES,
  CHECKOUT_POINTER,
  CHECKOUT_TITLE,
  checkoutDocument,
  imageDocument,
  imageRemovedDocument,
  longDocument,
  markupContextDocument,
  wrapDocument,
} from "./fixtures/context-documents.ts";
import { MARKUP_LABEL } from "./fixtures/markup-document.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** `{spacing.excerpt-max-height}` (DESIGN.md, Excerpt). */
const EXCERPT_MAX_HEIGHT = 320;

const RELEASE_DECODES = "__askboardReleaseDecodes";

/** Waits for the question's `ready` message; no item may fail on the way. */
const readyFor = async (run: WidgetHostRun, questionId: string): Promise<void> => {
  await eventually(
    () =>
      run.messages.some(
        (message) =>
          message.type === "item-error" ||
          (message.type === "ready" && message.itemId === questionId),
      ),
    `the question ${questionId}'s ready message`,
    LOAD_TIMEOUT_MS,
  );
  expect(run.messages.filter((message) => message.type === "item-error")).toEqual([]);
};

const itemOf = (run: WidgetHostRun, itemId: string): Locator =>
  run.board.view.locator(`[data-askboard-item="${itemId}"]`);

const partOf = (item: Locator, part: string): Locator =>
  item.locator(`[data-context-part="${part}"]`);

/** The tab's requests over the network: its own page alone, by path. */
const networkPaths = (run: WidgetHostRun): string[] =>
  run.requests.filter((url) => /^(https?|wss?):/.test(url)).map((url) => new URL(url).pathname);

// Runs in every frame before its scripts: each image's `decode()` waits until the test releases it.
const holdDecodes = (release: string): void => {
  const decode = HTMLImageElement.prototype.decode;
  let open: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    open = resolve;
  });
  (globalThis as unknown as Record<string, unknown>)[release] = () => open();
  HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
    return held.then(() => decode.call(this));
  };
};

const prepareHeldDecodes = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(holdDecodes, RELEASE_DECODES);
};

// Runs in the view: whether an image loads from `url`.
const loads = (view: Frame, url: string): Promise<string> =>
  view.evaluate(
    (src) =>
      new Promise<string>((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve("loaded");
        probe.onerror = () => resolve("error");
        probe.src = src;
      }),
    url,
  );

const styleOf = (locator: Locator, property: "backgroundColor" | "color"): Promise<string> =>
  locator.first().evaluate((element, name) => getComputedStyle(element)[name], property);

const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, at) => String(from + at));

// An excerpt's body, its second line and how the browser laid them out.
const layoutOf = (item: Locator) =>
  item.evaluate((element) => {
    const body = element.querySelector('[data-context-part="body"]');
    const rows = [...element.querySelectorAll('[data-context-part="line"]')];
    const number = element.querySelectorAll('[data-context-part="number"]')[1];
    const text = element.querySelectorAll('[data-context-part="text"]')[1];
    if (body === null || number === undefined || text === undefined) return undefined;
    const lineRange = document.createRange();
    lineRange.selectNodeContents(text);
    return {
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      rows: rows.map((row) => row.getBoundingClientRect().height),
      numberTop: number.getBoundingClientRect().top,
      numberRight: number.getBoundingClientRect().right,
      textTop: text.getBoundingClientRect().top,
      lineLefts: [...lineRange.getClientRects()].map((rect) => rect.left),
    };
  });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the context components`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "an excerpt shows its caption and its body as source text numbered from line 40 to 52",
      async () => {
        const run = await host(dist, checkoutDocument);
        await readyFor(run, "checkout");
        const excerpt = itemOf(run, "order-spec");
        expect(await partOf(excerpt, "title").textContent()).toBe(CHECKOUT_TITLE);
        expect(await partOf(excerpt, "source").textContent()).toBe(
          `${CHECKOUT_POINTER} · lines 40–52`,
        );
        expect(await partOf(excerpt, "number").allTextContents()).toEqual(range(40, 52));
        expect(await partOf(excerpt, "text").allTextContents()).toEqual([...CHECKOUT_LINES]);
        expect(await styleOf(partOf(excerpt, "caption"), "backgroundColor")).toBe(
          tokenColor("muted", "light"),
        );
        expect(await styleOf(partOf(excerpt, "number"), "color")).toBe(
          tokenColor("muted-foreground", "light"),
        );
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a long excerpt is capped at the excerpt's maximum height and scrolls inside",
      async () => {
        const run = await host(dist, longDocument);
        await readyFor(run, "long");
        const excerpt = itemOf(run, "long-source");
        const body = partOf(excerpt, "body");
        const box = await body.evaluate((element) => ({
          height: element.getBoundingClientRect().height,
          client: element.clientHeight,
          scroll: element.scrollHeight,
          overflow: getComputedStyle(element).overflowY,
        }));
        expect(box.height).toBeLessThanOrEqual(EXCERPT_MAX_HEIGHT);
        expect(box.height).toBeGreaterThan(EXCERPT_MAX_HEIGHT - 4);
        expect(box.scroll).toBeGreaterThan(box.client);
        expect(["auto", "scroll"]).toContain(box.overflow);
        expect(await partOf(excerpt, "number").count()).toBe(200);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Markdown soft-wraps under a hanging indent, each number on its source line, and code scrolls sideways",
      async () => {
        const run = await host(dist, wrapDocument);
        await readyFor(run, "wrap");
        const prose = await layoutOf(itemOf(run, "prose"));
        const code = await layoutOf(itemOf(run, "code"));
        if (prose === undefined || code === undefined) throw new Error("an excerpt has no body");
        const [proseShort = 0, proseWide = 0] = prose.rows;
        expect(proseWide).toBeGreaterThan(2 * proseShort);
        expect(prose.scrollWidth).toBeLessThanOrEqual(prose.clientWidth);
        expect(Math.abs(prose.numberTop - prose.textTop)).toBeLessThan(2);
        expect(prose.lineLefts.length).toBeGreaterThan(1);
        for (const left of prose.lineLefts) {
          expect(left).toBeGreaterThanOrEqual(prose.numberRight - 0.5);
        }
        const [codeShort = 0, codeWide = 0] = code.rows;
        expect(Math.abs(codeWide - codeShort)).toBeLessThan(1);
        expect(code.scrollWidth).toBeGreaterThan(code.clientWidth);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "markup in an excerpt's text, title and pointer, a reference and an image's alt shows as text, adding no element",
      async () => {
        const run = await host(dist, markupContextDocument);
        await readyFor(run, "markup");
        for (const id of ["markup-excerpt", "markup-file", "markup-web", "markup-missing"]) {
          expect(await itemOf(run, id).textContent()).toContain(MARKUP_LABEL);
        }
        const excerpt = itemOf(run, "markup-excerpt");
        expect(await partOf(excerpt, "title").textContent()).toBe(MARKUP_LABEL);
        expect(await partOf(excerpt, "text").allTextContents()).toEqual([
          MARKUP_LABEL,
          "<b>bold</b><script>document.title='owned'</script>",
        ]);
        const shown = itemOf(run, "markup-shown").locator("img");
        expect(await shown.getAttribute("alt")).toBe(MARKUP_LABEL);
        expect(await shown.getAttribute("src")).toMatch(/^blob:/);
        const view = await run.board.viewFrame();
        const created = await view.evaluate(() =>
          [
            ...document.querySelectorAll('img[src="x"], [onerror]'),
            ...[...document.querySelectorAll("b")].filter((b) => b.textContent === "bold"),
            ...[...document.querySelectorAll('script:not([type="application/json"])')].filter(
              (script) => (script.textContent ?? "").includes("document.title='owned'"),
            ),
          ].map((element) => element.outerHTML.slice(0, 80)),
        );
        expect(created).toEqual([]);
        expect(await run.board.page.title()).not.toContain("owned");
        expect(networkPaths(run)).toEqual(["/"]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "U+202E in an excerpt's text shows as a visible marker instead of reordering the line",
      async () => {
        const run = await host(dist, bidiDocument);
        await readyFor(run, "bidi");
        const excerpt = itemOf(run, "bidi-source");
        expect(await partOf(excerpt, "number").allTextContents()).toEqual(["7"]);
        const text = (await partOf(excerpt, "text").textContent()) ?? "";
        expect(text).toBe(BIDI_LINE.replace("\u202E", "\\u202E"));
        expect(text).not.toContain("\u202E");
        expect(await partOf(excerpt, "mark").allTextContents()).toEqual(["\\u202E"]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an unresolved excerpt and image show Unresolved with their pointer, and the question still counts as visible",
      async () => {
        const run = await host(dist, contextBoardDocument);
        await readyFor(run, "rollout");
        const excerpt = itemOf(run, "missing-doc");
        expect(await partOf(excerpt, "unresolved").textContent()).toBe("Unresolved");
        expect(await partOf(excerpt, "pointer").textContent()).toBe("docs/missing.md#Intro");
        expect(await partOf(excerpt, "body").count()).toBe(0);
        const image = itemOf(run, "diagram");
        expect(await partOf(image, "unresolved").textContent()).toBe("Unresolved");
        expect(await partOf(image, "pointer").textContent()).toBe(".askboard/media/diagram.svg");
        expect(await image.textContent()).toContain("The rollout plan");
        expect(await image.locator("img").count()).toBe(0);
        expect(await run.board.question("rollout").getAttribute("aria-busy")).toBe("false");
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a reference shows its kind label, its path or title and its hint, the external mark only on GITHUB and WEB",
      async () => {
        const run = await host(dist, contextBoardDocument);
        await readyFor(run, "fix");
        await readyFor(run, "rollout");
        const expected = [
          ["retry-src", "FILE", "src/retry.ts#L1-L5", "opens in a reading panel"],
          ["readme", "FILE", "Read me", "opens in a reading panel"],
          ["old-src", "FILE", "vendor/old/retry.ts", "opens in a reading panel"],
          ["pr", "GITHUB", "PR 12", "opens in browser ↗"],
          ["runbook", "WEB", "https://acme.atlassian.net/wiki/runbook", "opens in browser ↗"],
        ] as const;
        for (const [id, label, path, hint] of expected) {
          const reference = itemOf(run, id);
          expect(await reference.getByRole("button").count()).toBe(1);
          expect(await partOf(reference, "label").textContent()).toBe(label);
          expect(await partOf(reference, "path").textContent()).toBe(path);
          expect(await partOf(reference, "hint").textContent()).toBe(hint);
          expect(await partOf(reference, "external").count()).toBe(label === "FILE" ? 0 : 1);
        }
        expect(await styleOf(partOf(itemOf(run, "pr"), "path"), "color")).toBe(
          tokenColor("primary-text", "light"),
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an image shows from a blob: URL with its alt, its question ready only once it is decoded, with no network request",
      async () => {
        const run = await host(dist, imageDocument, { prepare: prepareHeldDecodes });
        const image = itemOf(run, "screenshot").locator("img");
        await image.waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
        expect(await image.getAttribute("alt")).toBe("The retry log");
        expect(await image.getAttribute("src")).toMatch(/^blob:/);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([]);
        expect(await run.board.question("shot").getAttribute("aria-busy")).toBe("true");
        const view = await run.board.viewFrame();
        await view.evaluate((release) => {
          const open = (globalThis as unknown as Record<string, unknown>)[release];
          if (typeof open !== "function") throw new Error("the decodes are not held in the view");
          open();
        }, RELEASE_DECODES);
        await readyFor(run, "shot");
        expect(
          await image.evaluate(
            (element: HTMLImageElement) => element.complete && element.naturalWidth,
          ),
        ).toBe(1);
        expect(networkPaths(run)).toEqual(["/"]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an image's blob: URL is revoked once the image is gone",
      async () => {
        const run = await host(dist, imageDocument);
        await readyFor(run, "shot");
        const image = itemOf(run, "screenshot").locator("img");
        const url = (await image.getAttribute("src")) ?? "";
        const view = await run.board.viewFrame();
        expect(await loads(view, url)).toBe("loaded");
        // The call itself is seen in every engine; Firefox keeps a decoded image by its URL, so
        // a probe of the revoked URL still loads there.
        await view.evaluate((blobUrl) => {
          const revoked: string[] = [];
          const real = URL.revokeObjectURL.bind(URL);
          URL.revokeObjectURL = (revoking: string) => {
            revoked.push(revoking);
            real(revoking);
          };
          (globalThis as unknown as Record<string, unknown>).__revoked = revoked;
          if (blobUrl === "") throw new Error("the image has no URL");
        }, url);
        await run.update({
          type: "state",
          state: openStateOf(imageRemovedDocument),
          document: imageRemovedDocument,
        });
        await eventually(async () => (await image.count()) === 0, "the image to be gone");
        const revoked = await view.evaluate(
          () => (globalThis as unknown as Record<string, string[]>).__revoked,
        );
        expect(revoked).toContain(url);
        if (engine !== "firefox") expect(await loads(view, url)).toBe("error");
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in a dark system's theme, an excerpt and a reference take the dark tokens",
      async () => {
        const run = await host(dist, contextBoardDocument, { colorScheme: "dark" });
        await readyFor(run, "fix");
        const excerpt = itemOf(run, "retry-adr");
        expect(await styleOf(partOf(excerpt, "caption"), "backgroundColor")).toBe(
          tokenColor("muted", "dark"),
        );
        expect(await styleOf(partOf(excerpt, "number"), "color")).toBe(
          tokenColor("muted-foreground", "dark"),
        );
        expect(await styleOf(partOf(itemOf(run, "pr"), "path"), "color")).toBe(
          tokenColor("primary-text", "dark"),
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
