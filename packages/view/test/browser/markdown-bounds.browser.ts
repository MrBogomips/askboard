// Markdown's bounded work in Chromium and WebKit (atoms, task 5.1; view-and-widgets spec: Markdown
// bounded work; design decision 5; checkpoint 1.8 X-2): sources of up to the Text's 10,000 code
// points built to be slow or to grow, rendered through the renderer in the view's own policed
// frame, each under 500 ms from the call to the end of a forced layout (the 2-second bound with a
// margin of 4, as the LaTeX's) and with its output bounded: the HTML past 200,000 characters shows
// the source as plain text, so what reaches the page never exceeds that. A fixture over 500 ms
// stops the task for `/opsx:update`, never a raised bound.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/markdown-bounds.browser.ts

import { afterAll, describe, expect, test } from "bun:test";
import { TEXT_MAX_CHARS } from "@askboard/contract";
import { MARKDOWN_HTML_MAX_CHARS } from "../../src/catalog/text/markdown.ts";
import { enginesFrom } from "./harness/engines.ts";
import { MarkdownFrame } from "./harness/markdown-frame.ts";

const TEST_TIMEOUT_MS = 120_000;
const BUDGET_MS = 500;
const NODES_MAX = 20_000;

const cut = (source: string): string => Array.from(source).slice(0, TEXT_MAX_CHARS).join("");

// A reference definition of `url` characters, then the uses as many as the limit allows: images and
// links of one long URL, each use an element holding the URL as its `href`, an image also as its
// label when it has no alt text.
const reuse = (url: number, use: string): string => {
  const definition = `\n\n[r]: https://e.test/${"a".repeat(url - 14)}`;
  const count = Math.floor((TEXT_MAX_CHARS - definition.length) / (use.length + 1));
  return `${Array.from({ length: count }, () => use).join(" ")}${definition}`;
};

const nestedList = (): string => {
  const lines: string[] = [];
  for (let depth = 0, size = 0; ; depth += 1) {
    const line = `${"  ".repeat(depth)}- item ${depth}`;
    if (size + line.length + 1 > TEXT_MAX_CHARS) break;
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join("\n");
};

const table = (columns: number, rows: number): string => {
  const head = `| ${Array.from({ length: columns }, (_, at) => `h${at}`).join(" | ")} |`;
  const rule = `|${"---|".repeat(columns)}`;
  const body = Array.from(
    { length: rows },
    (_, row) => `| ${Array.from({ length: columns }, (_, at) => `c${row}${at}`).join(" | ")} |`,
  );
  return [head, rule, ...body].join("\n");
};

// The forms the design names (nested quotes, lists, emphasis runs, brackets, backticks, tables of
// 500 cells), then what a markdown parser is slow on, then the growing sources of X-2.
const FIXTURES: readonly (readonly [string, string])[] = [
  ["5,000 nested block quotes", cut(`${"> ".repeat(5_000)}x`)],
  ["nested block quotes, 20 deep and past", cut(`${"> ".repeat(40)}x\n\n${"> ".repeat(40)}y`)],
  ["lists nested as deep as the limit allows", nestedList()],
  ["unmatched emphasis markers `*a `", cut("*a ".repeat(4_000))],
  ["unmatched underscores", cut("_a".repeat(5_000))],
  ["a run of double asterisks", cut("**".repeat(5_000))],
  ["alternating `*_` runs", cut("*_".repeat(5_000))],
  ["triple markers `***a`", cut("***a ".repeat(2_000))],
  ["5,000 nested brackets", cut(`${"[".repeat(5_000)}${"]".repeat(5_000)}`)],
  ["unclosed link starts `[a](`", cut("[a](".repeat(2_500))],
  ["unclosed image starts `![`", cut("![".repeat(5_000))],
  ["nested link text `[[[a](b)](c)](d)`", cut("[[[a](b)](c)](d) ".repeat(600))],
  ["10,000 backticks", "`".repeat(TEXT_MAX_CHARS)],
  [
    "backtick runs of rising length",
    cut(Array.from({ length: 140 }, (_, at) => "`".repeat(at + 1)).join("a")),
  ],
  ["a table of 500 cells", table(10, 49)],
  ["a table of 10,000 characters of narrow cells", cut(table(40, 60))],
  ["10,000 plain characters on one line", "a".repeat(TEXT_MAX_CHARS)],
  ["entities `&amp;`", cut("&amp;".repeat(2_000))],
  ["angle brackets `<a `", cut("<a ".repeat(3_333))],
  ["470 links", "[a](https://e.test/) ".repeat(470)],
  ["headings and rules", cut("# h\n---\n".repeat(1_250))],
  ["one long URL as image and link, 5,000 characters", reuse(5_000, "![r][r] [r][r]")],
  ["one long URL as image, 2,000 characters", reuse(2_000, "![r][r]")],
  ["one long URL as image, 9,000 characters", reuse(9_000, "![r][r]")],
  ["one long URL as link, 500 characters", reuse(500, "[r][r]")],
  ["many items holding one URL, 100 characters", reuse(100, "![r][r] [r][r]")],
];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES).filter(
  (name) => name !== "firefox",
)) {
  describe(`${engine}: Markdown's bounded work`, () => {
    const frame = new MarkdownFrame(engine);
    afterAll(() => frame.close());

    for (const [name, source] of FIXTURES) {
      test(
        `${name}: under ${BUDGET_MS} ms, with output bounded and nothing unsafe`,
        async () => {
          expect(Array.from(source).length).toBeLessThanOrEqual(TEXT_MAX_CHARS);
          const shown = await frame.render(source);
          expect(shown.ms, `${name} took ${shown.ms.toFixed(0)} ms`).toBeLessThan(BUDGET_MS);
          expect(shown.nodes).toBeLessThanOrEqual(NODES_MAX);
          expect((shown.html ?? "").length).toBeLessThanOrEqual(MARKDOWN_HTML_MAX_CHARS);
          expect(shown.violations).toEqual([]);
          expect(frame.requests).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "the growing sources give no HTML, the item showing its source as plain text, and a URL past a link's limit gives a small output with no link",
      async () => {
        // A URL over a link's 2,048 characters is no link (review 5.6, X-1), so its uses stay small.
        const grows = (label: string) => /long URL/.test(label) && !/(5,000|9,000)/.test(label);
        for (const [name, source] of FIXTURES.filter(([label]) => grows(label))) {
          const shown = await frame.render(source);
          expect(shown.html, name).toBeUndefined();
        }
        for (const [name, source] of FIXTURES.filter(([label]) => /(5,000|9,000)/.test(label))) {
          const shown = await frame.render(source);
          expect(shown.html, name).toBeDefined();
          expect(
            shown.attributes.filter((line) => line.startsWith("a ")),
            name,
          ).toEqual([]);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a source under the bound still renders: 470 links and a table of 500 cells keep their elements",
      async () => {
        const links = await frame.render("[a](https://e.test/) ".repeat(470));
        expect(links.html).not.toBeUndefined();
        expect(links.attributes.filter((line) => line.startsWith("a ")).length).toBe(470);
        const cells = await frame.render(table(10, 49));
        expect(
          cells.attributes.filter((line) => line === "td" || line.startsWith("td ")).length,
        ).toBe(490);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
