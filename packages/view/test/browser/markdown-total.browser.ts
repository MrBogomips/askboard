// The total of an ask's Markdown, in Chromium and WebKit (atoms, task 5.11; review 5.6, unconfirmed):
// the HTML cap of 200,000 characters binds one Text, and nothing in the contract counts the Texts of
// an ask, so a board of 200 Texts each rendering to just under the cap is the largest board by characters.
// Elements are the other axis (pre-PR review X-1, task 5.12): the same board of the 100-column,
// 190-row padded table (about 19,000 elements each, under the cap) is timed as well. The cap board must be ready within 2 seconds of the same board of plain Texts (the LaTeX's
// bound), every Text still drawn as Markdown, with the nodes bounded and no policy violation. Over
// 2 seconds in either engine stops the task for the coordinator: a cap or a bound needs a design
// decision. The dense board alone is a known limit (task 5.16): it is timed, not bounded.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/markdown-total.browser.ts

import { describe, expect, test } from "bun:test";
import { MARKDOWN_HTML_MAX_CHARS, markdownHtml } from "../../src/markdown/markdown.ts";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { DENSE_TABLE } from "./fixtures/dense-markdown.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const TEXTS = 200;
const BOUND_MS = 2_000;
/** The dense board's generous wait and the test's timeout around it (5.16). */
const DENSE_WAIT_MS = 120_000;
const DENSE_TEST_TIMEOUT_MS = 240_000;

// One reference definition of a 500-character URL and as many links to it as keep the HTML just
// under the cap: the largest output one Text gives that is still Markdown.
const NEAR_CAP = (() => {
  const definition = `\n\n[r]: https://e.test/${"a".repeat(486)}`;
  for (let count = 400; count > 0; count -= 1) {
    const source = `${Array.from({ length: count }, () => "[r][r]").join(" ")}${definition}`;
    const html = markdownHtml(source);
    if (html !== undefined && html.length > MARKDOWN_HTML_MAX_CHARS * 0.9) return source;
  }
  throw new Error("no source renders to between 90% and 100% of the cap");
})();

const texts = (source: string, markdown = false) =>
  Array.from({ length: TEXTS }, (_, at) => ({
    type: "text",
    id: `t${at}`,
    props: { text: source, ...(markdown ? { format: "markdown" } : {}) },
  }));

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES).filter(
  (name) => name !== "firefox",
)) {
  describe(`${engine}: an ask of ${TEXTS} Markdown Texts at the HTML cap`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the fixture sits just under the cap and the board is ready within 2 seconds of a board of plain Texts, every Text drawn as Markdown",
      async () => {
        const html = markdownHtml(NEAR_CAP);
        expect(html?.length ?? 0).toBeGreaterThan(MARKDOWN_HTML_MAX_CHARS * 0.9);
        expect(html?.length ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
          MARKDOWN_HTML_MAX_CHARS,
        );

        const plainStarted = performance.now();
        const plain = await host(dist, atomDocument(texts("plain text")));
        await readyIn(plain);
        const plainMs = performance.now() - plainStarted;

        const started = performance.now();
        const run = await host(dist, atomDocument(texts(NEAR_CAP, true)));
        await readyIn(run);
        const heavyMs = performance.now() - started;
        const extra = heavyMs - plainMs;
        console.error(
          `markdown-total ${engine}: ${TEXTS} Texts of ${html?.length} HTML characters each: ready in ${heavyMs.toFixed(0)} ms, plain board ${plainMs.toFixed(0)} ms, difference ${extra.toFixed(0)} ms`,
        );
        const drawn = await run.board.view.locator('[data-text-format="markdown"]').count();
        expect(drawn).toBe(TEXTS);
        expect(extra, `${engine}: ${extra.toFixed(0)} ms over the plain board`).toBeLessThan(
          BOUND_MS,
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    // Known limit (CHANGELOG, Known limits; 5.12, 5.16): 200 Texts of 19,000 elements are about 3.8
    // million elements, and the board is not ready within 8 seconds. The test gives it DENSE_WAIT_MS,
    // logs the time, and says what it found if the board is never ready: a renderer that crashed,
    // a page that no longer answers (a hang), or one that is only slow. No cap or bound stands behind it.
    test(
      "a board of the densest table (100 columns by 190 short rows, about 19,000 elements each) becomes ready, every Text drawn as Markdown; the time is logged",
      async () => {
        const html = markdownHtml(DENSE_TABLE);
        expect(html?.length ?? 0).toBeGreaterThan(0);
        expect(html?.length ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
          MARKDOWN_HTML_MAX_CHARS,
        );
        const plainStarted = performance.now();
        const plain = await host(dist, atomDocument(texts("plain text")));
        await readyIn(plain);
        const plainMs = performance.now() - plainStarted;

        const started = performance.now();
        const run = await host(dist, atomDocument(texts(DENSE_TABLE, true)));
        let crashed = false;
        run.board.page.on("crash", () => {
          crashed = true;
        });
        try {
          await eventually(
            () => run.messages.length > 0 || crashed,
            "the question's ready message",
            DENSE_WAIT_MS,
          );
        } catch (waited) {
          const alive = await Promise.race([
            run.board.page.evaluate(() => true).catch(() => false),
            Bun.sleep(10_000).then(() => false),
          ]);
          console.error(
            `markdown-total ${engine}: ${TEXTS} dense tables not ready in ${DENSE_WAIT_MS / 1000} s; the page ${alive ? "still answers (slow)" : "does not answer (hung)"}`,
          );
          throw waited;
        }
        const heavyMs = performance.now() - started;
        if (crashed) {
          console.error(
            `markdown-total ${engine}: the renderer crashed after ${heavyMs.toFixed(0)} ms`,
          );
          throw new Error(`${engine}: the renderer crashed`);
        }
        expect(run.messages[0]).toEqual({ type: "ready", itemId: "plan" });
        console.error(
          `markdown-total ${engine}: ${TEXTS} dense tables of ${html?.length} HTML characters each: ready in ${heavyMs.toFixed(0)} ms, plain board ${plainMs.toFixed(0)} ms, difference ${(heavyMs - plainMs).toFixed(0)} ms`,
        );
        expect(await run.board.view.locator('[data-text-format="markdown"]').count()).toBe(TEXTS);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      DENSE_TEST_TIMEOUT_MS,
    );
  });
}
