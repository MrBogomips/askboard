// The Markdown renderer in each engine (atoms, task 4.1; view-and-widgets spec: Markdown rendered as
// data, Markdown images, tables and controls, Markdown links in the view; design decision 5): the
// sanitized fragment for the spec's payloads and for the forms an attacker tries, put in a container
// of the view's own sandboxed, policed document. Each case also asserts that no CSP violation was
// reported and that no request was made. A bare render: no server, no board; the component, the link
// click and the timed fixtures are task 5.1's.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/markdown.browser.ts

import { afterAll, describe, expect, test } from "bun:test";
import { TEXT_MAX_CHARS } from "@askboard/contract";
import {
  ALIGN_CLASSES,
  MARKDOWN_ALLOWED_ATTR,
  MARKDOWN_ALLOWED_TAGS,
} from "../../src/markdown/markdown.ts";
import { enginesFrom } from "./harness/engines.ts";
import { MarkdownFrame, type Rendered } from "./harness/markdown-frame.ts";

const TEST_TIMEOUT_MS = 60_000;

const tagsOf = (shown: Rendered): string[] =>
  shown.attributes.map((line) => line.split(" ")[0] ?? "");
const hrefs = (shown: Rendered): string[] =>
  shown.attributes.flatMap((line) => line.split(" ").filter((part) => part.startsWith("href=")));

// A case ends clean: nothing the policy blocked, nothing requested.
const clean = (frame: MarkdownFrame, shown: Rendered) => {
  expect(shown.violations).toEqual([]);
  expect(frame.requests).toEqual([]);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: Markdown as data`, () => {
    const frame = new MarkdownFrame(engine);
    afterAll(() => frame.close());
    const render = (source: string) => frame.render(source);

    test(
      "the spec's payloads show as text: no element, no handler, no style, no violation, no request",
      async () => {
        const source =
          '<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\ntext <span style="color:red">x</span> end';
        const shown = await render(source);
        expect(shown.text).toContain("<img src=x onerror=alert(1)>");
        expect(shown.text).toContain("<script>alert(1)</script>");
        expect(shown.text).toContain('<span style="color:red">x</span>');
        for (const tag of ["img", "script", "span"]) expect(tagsOf(shown)).not.toContain(tag);
        expect(shown.attributes.join("\n")).not.toMatch(/style=|onerror=|src=/);
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "more payloads: svg, math, iframe, form, style, a comment and an entity-hidden scheme are text or nothing",
      async () => {
        const source = [
          "<svg onload=alert(1)>",
          "<math><mi xlink:href=javascript:alert(1)>x</mi></math>",
          '<iframe src="https://example.com/"></iframe>',
          '<form action="https://example.com/"><input name=x></form>',
          "<style>*{background:url(https://example.com/x)}</style>",
          "<!-- hidden -->",
          '<a href="&#106;avascript:alert(1)">entity</a>',
        ].join("\n\n");
        const shown = await render(source);
        for (const tag of ["svg", "math", "iframe", "form", "input", "style", "a"]) {
          expect(tagsOf(shown)).not.toContain(tag);
        }
        expect(shown.text).toContain("<svg onload=alert(1)>");
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "only http and https links are anchors, in every form markdown-it knows",
      async () => {
        const source = [
          "[web](https://example.com/docs)",
          "[plain](http://example.com/)",
          "<https://example.com/auto>",
          "[ref][r]",
          "[js](javascript:alert(1))",
          "[entity](&#106;avascript:alert(1))",
          "[data](data:text/html,<b>x</b>)",
          "[file](file:///etc/passwd)",
          "<javascript:alert(1)>",
          "[relative](/path)",
          "https://example.com/bare",
          "",
          "[r]: https://example.com/reference",
        ].join("\n\n");
        const shown = await render(source);
        expect(hrefs(shown).sort()).toEqual([
          "href=http://example.com/",
          "href=https://example.com/auto",
          "href=https://example.com/docs",
          "href=https://example.com/reference",
        ]);
        expect(shown.text).toContain("[js](javascript:alert(1))");
        expect(shown.text).toContain("[data](data:text/html,<b>x</b>)");
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an empty destination and a link with a user name or password are no anchors: the text shows",
      async () => {
        const source = [
          "[empty]()",
          "[brackets](<>)",
          "![image]()",
          "![]()",
          "[cred](https://user:pass@example.com/)",
          "[user](https://user@example.com/)",
          "![pic](https://u:p@example.com/a.png)",
          "[fine](https://example.com/fine)",
        ].join("\n\n");
        const shown = await render(source);
        expect(hrefs(shown)).toEqual(["href=https://example.com/fine"]);
        for (const text of ["empty", "brackets", "image", "cred", "user", "pic"]) {
          expect(shown.text).toContain(text);
        }
        expect(shown.attributes.join("\n")).not.toContain("href=\n");
        expect(shown.attributes.filter((line) => line === "a")).toEqual([]);
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an image is a link labelled with its alt text and is never loaded",
      async () => {
        const shown = await render("![logo](https://example.com/a.png)");
        expect(tagsOf(shown)).toEqual(["p", "a"]);
        expect(shown.text.trim()).toBe("logo");
        expect(hrefs(shown)).toEqual(["href=https://example.com/a.png"]);
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "table alignment is a class: no style attribute and no violation",
      async () => {
        const shown = await render(
          "| left | right | centre | none |\n|:--|--:|:-:|---|\n| 1 | 2 | 3 | 4 |",
        );
        expect(shown.attributes.join("\n")).not.toContain("style");
        const classes = shown.attributes.filter((line) => line.includes("class="));
        expect(
          classes.filter((line) => line.startsWith("th")).map((line) => line.split(" ")[1]),
        ).toEqual(["class=md-align-left", "class=md-align-right", "class=md-align-center"]);
        // Two rows of the three aligned columns.
        expect(classes).toHaveLength(6);
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "bidirectional controls and a code fence's info string reach the page as escapes and no class",
      async () => {
        const shown = await render("a‮b `c⁦d`\n\n```js x\ne‪f\n```");
        expect(shown.text).not.toMatch(/[‪‮⁦]/);
        expect(shown.text).toContain("a\\u202Eb");
        expect(shown.text).toContain("c\\u2066d");
        expect(shown.text).toContain("e\\u202Af");
        expect(shown.attributes.join("\n")).not.toContain("class=");
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a source over the Text's limit gives no render: the caller shows plain text",
      async () => {
        const shown = await render("x".repeat(TEXT_MAX_CHARS + 1));
        expect(shown.html).toBeUndefined();
        expect(shown.nodes).toBe(0);
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "every element and attribute that can come out of a render is on the allow-lists",
      async () => {
        const shown = await render(
          '# h\n\n*e* **s** ~~x~~ `c`  \nb\n\n> q\n\n3. o\n4. p\n\n- u\n\n---\n\n```\nk\n```\n\n| h |\n|:-:|\n| d |\n\n[l](https://a.test/ "t")',
        );
        for (const tag of tagsOf(shown)) {
          expect(MARKDOWN_ALLOWED_TAGS as readonly string[]).toContain(tag);
        }
        for (const line of shown.attributes) {
          for (const attribute of line.split(" ").slice(1)) {
            expect(MARKDOWN_ALLOWED_ATTR as readonly string[]).toContain(
              String(attribute.split("=")[0]),
            );
          }
        }
        expect(shown.attributes).toContain("ol start=3");
        clean(frame, shown);
      },
      TEST_TIMEOUT_MS,
    );
  });

  // The sanitizer alone, on HTML markdown-it would never write: the second layer holds by itself.
  describe(`${engine}: the sanitizer's allow-list`, () => {
    const frame = new MarkdownFrame(engine);
    afterAll(() => frame.close());

    test(
      "elements outside the list go, with their content when it is script or style",
      async () => {
        const shown = await frame.sanitize(
          '<p>a</p><img src="https://example.com/x.png"><svg onload="alert(1)"><circle/></svg><math><mi>x</mi></math><iframe src="https://example.com/"></iframe><form><input></form><style>p{color:red}</style><script>alert(1)</script><object data="x"></object><details open ontoggle="x">d</details><span>kept text</span>',
        );
        expect(tagsOf(shown)).toEqual(["p"]);
        expect(shown.text).toContain("kept text");
        expect(shown.text).not.toContain("alert");
        expect(shown.text).not.toContain("color:red");
        expect(frame.requests).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a link keeps only an http or https href: no handler, style, target, rel, data or aria attribute",
      async () => {
        const shown = await frame.sanitize(
          '<a href="https://example.com/a" onclick="x()" style="color:red" target="_blank" rel="opener" data-x="1" aria-label="l" id="i" title="t" name="n">a</a>',
        );
        expect(shown.attributes).toEqual(["a href=https://example.com/a"]);
        expect(frame.requests).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a link to any other scheme loses its href",
      async () => {
        for (const href of [
          "javascript:alert(1)",
          "&#106;avascript:alert(1)",
          " java\tscript:alert(1)",
          "data:text/html,<script>alert(1)</script>",
          "vbscript:x",
          "file:///etc/passwd",
          "ftp://example.com/",
          "mailto:a@example.com",
          "//example.com/",
          "/relative",
        ]) {
          const shown = await frame.sanitize(`<a href="${href}">x</a>`);
          expect(hrefs(shown)).toEqual([]);
          expect(frame.requests).toEqual([]);
        }
        const upper = await frame.sanitize('<a href="HTTPS://EXAMPLE.COM/">x</a>');
        expect(hrefs(upper)).toEqual(["href=HTTPS://EXAMPLE.COM/"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a link whose href is empty or holds a user name or password loses its href, with no request",
      async () => {
        for (const href of [
          "",
          " ",
          "https://user:pass@example.com/",
          "https://user@example.com/",
          "https:\\\\user:pass@example.com/",
        ]) {
          const shown = await frame.sanitize(`<a href="${href}">x</a>`);
          expect(hrefs(shown), JSON.stringify(href)).toEqual([]);
          expect(frame.requests).toEqual([]);
        }
        const kept = await frame.sanitize('<a href="https://example.com/@x">x</a>');
        expect(hrefs(kept)).toEqual(["href=https://example.com/@x"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a class stays only as exactly one alignment class; a list keeps its start",
      async () => {
        const kept = (cell: string) =>
          frame.sanitize(`<table><tbody><tr>${cell}</tr></tbody></table>`);
        for (const name of ALIGN_CLASSES) {
          const shown = await kept(`<td class="${name}">x</td>`);
          expect(shown.attributes).toContain(`td class=${name}`);
        }
        for (const value of [
          "evil",
          "md-align-right evil",
          "evil md-align-right",
          "MD-ALIGN-RIGHT",
          "language-js",
          "",
        ]) {
          const shown = await kept(`<td class="${value}">x</td>`);
          expect(shown.attributes.join("\n")).not.toContain("class=");
        }
        const list = await frame.sanitize(
          '<ol start="7" type="a" reversed><li value="3">x</li></ol>',
        );
        expect(list.attributes).toEqual(["ol start=7", "li"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a style attribute handed to the sanitizer is removed, with no request",
      async () => {
        const shown = await frame.sanitize(
          '<p style="color:red;background:url(https://example.com/x)">styled</p><table><tbody><tr><td style="text-align:right">x</td></tr></tbody></table>',
        );
        expect(shown.attributes.join("\n")).not.toContain("style");
        expect(shown.text).toContain("styled");
        // Chromium may report the parse of a style attribute under the view's policy, which is why
        // markdown-it's output never holds one (the render cases above assert no violation); the
        // attribute never reaches the page.
        expect(frame.requests).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
