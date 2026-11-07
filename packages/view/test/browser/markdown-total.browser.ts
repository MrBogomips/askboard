// The total of an ask's Markdown, in Chromium and WebKit (atoms, task 5.11; review 5.6, unconfirmed):
// the HTML cap of 200,000 characters binds one Text, and nothing in the contract counts the Texts of
// an ask, so a board of 200 Texts each rendering to just under the cap is the worst board an agent
// can send. The board must be ready within 2 seconds of the same board of plain Texts (the LaTeX's
// bound), every Text still drawn as Markdown, with the nodes bounded and no policy violation. Over
// 2 seconds in either engine stops the task for the coordinator: a cap or a bound needs a design
// decision.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/markdown-total.browser.ts

import { describe, expect, test } from "bun:test";
import { MARKDOWN_HTML_MAX_CHARS, markdownHtml } from "../../src/catalog/text/markdown.ts";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const TEXTS = 200;
const BOUND_MS = 2_000;

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

const texts = (source: string) =>
  Array.from({ length: TEXTS }, (_, at) => ({
    type: "text",
    id: `t${at}`,
    props: { text: source, ...(source === NEAR_CAP ? { format: "markdown" } : {}) },
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
        const run = await host(dist, atomDocument(texts(NEAR_CAP)));
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
  });
}
