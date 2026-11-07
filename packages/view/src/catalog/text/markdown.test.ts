import { describe, expect, test } from "bun:test";
import { TEXT_MAX_CHARS } from "@askboard/contract";
import type { WindowLike } from "dompurify";
import {
  ALIGN_CLASSES,
  isMarkdownLinkUrl,
  keepClass,
  keepStart,
  MARKDOWN_ALLOWED_ATTR,
  MARKDOWN_ALLOWED_TAGS,
  MARKDOWN_HTML_MAX_CHARS,
  MARKDOWN_NESTING_MAX,
  markdownHtml,
  renderMarkdown,
  sanitizeHtml,
  sanitizerFor,
} from "./markdown.ts";

// The renderer's markdown-it half (atoms, view-and-widgets spec: Markdown rendered as data,
// Markdown images, tables and controls, Markdown links in the view, Markdown bounded work; design
// decision 5). What DOMPurify then does with this output is measured in a browser, in
// `markdown.browser.ts`: Bun has no DOM.
const html = (source: string): string => {
  const out = markdownHtml(source);
  if (out === undefined) throw new Error("the source was refused");
  return out;
};

const anchors = (output: string): string[] => output.match(/<a [^>]*>/g) ?? [];

describe("Markdown: constructs the output keeps", () => {
  test("paragraphs, breaks, emphasis, strong, strikethrough, code, quotes, lists, headings and rules", () => {
    const out = html(
      "# T\n\ntext *em* **strong** ~~gone~~ `code`  \nnext\n\n> quote\n\n- a\n- b\n\n3. c\n\n---\n\n```\nblock\n```",
    );
    for (const tag of [
      "<h1>",
      "<p>",
      "<em>",
      "<strong>",
      "<s>",
      "<code>",
      "<br>",
      "<blockquote>",
      "<ul>",
      "<li>",
      '<ol start="3">',
      "<hr>",
      "<pre>",
    ]) {
      expect(out).toContain(tag);
    }
  });

  test("a bare URL is no link: linkify is off", () => {
    expect(anchors(html("see https://example.com/x and www.example.com"))).toEqual([]);
  });

  test("a link keeps its href and nothing else: its title is dropped", () => {
    expect(html('[docs](https://example.com/docs "the title")')).toBe(
      '<p><a href="https://example.com/docs">docs</a></p>\n',
    );
  });

  test("a code fence's info string never becomes a class", () => {
    const out = html("```js onclick=x\nlet a;\n```");
    expect(out).toBe("<pre><code>let a;\n</code></pre>\n");
  });
});

describe("Markdown: table alignment is a class, never a style", () => {
  const table = "| a | b | c | d |\n|:--|--:|:-:|---|\n| 1 | 2 | 3 | 4 |";

  test("left, right and centre become md-align classes; no cell holds a style", () => {
    const out = html(table);
    expect(out).not.toContain("style");
    expect(out).toContain('<th class="md-align-left">a</th>');
    expect(out).toContain('<th class="md-align-right">b</th>');
    expect(out).toContain('<th class="md-align-center">c</th>');
    expect(out).toContain("<th>d</th>");
    expect(out).toContain('<td class="md-align-right">2</td>');
  });

  test("the classes are the three the sanitizer keeps", () => {
    expect([...ALIGN_CLASSES]).toEqual(["md-align-left", "md-align-center", "md-align-right"]);
    for (const name of ALIGN_CLASSES) expect(keepClass(name)).toBe(true);
    for (const other of ["", "md-align", "md-align-justify", "language-js", "md-align-left x"]) {
      expect(keepClass(other)).toBe(false);
    }
  });
});

describe("Markdown: a list's start", () => {
  test("keepStart admits a whole number of at most nine digits", () => {
    for (const value of ["0", "3", "123456789"]) expect(keepStart(value)).toBe(true);
    for (const value of ["", "-1", "1.5", "1e3", "1234567890", "javascript:1", "3 "]) {
      expect(keepStart(value)).toBe(false);
    }
  });
});

describe("Markdown: an image is a link labelled with its alt text", () => {
  test("an https image becomes an anchor and is never an img", () => {
    const out = html("![logo](https://example.com/a.png)");
    expect(out).toBe('<p><a href="https://example.com/a.png">logo</a></p>\n');
    expect(out).not.toContain("<img");
  });

  test("the alt text is text: markup in it is escaped", () => {
    const out = html("![<b>x</b> & *y*](https://example.com/a.png)");
    expect(out).toContain(">&lt;b&gt;x&lt;/b&gt; &amp; y</a>");
    expect(out).not.toContain("<b>");
  });

  test("an image with no alt text is labelled with its source, never an empty link", () => {
    expect(html("![](https://example.com/a.png)")).toBe(
      '<p><a href="https://example.com/a.png">https://example.com/a.png</a></p>\n',
    );
  });

  test("an image whose source is no web URL shows as its source text and loads nothing", () => {
    for (const source of [
      "![x](javascript:alert(1))",
      "![x](data:image/png;base64,AAAA)",
      "![x](file:///etc/passwd)",
      "![x](/relative.png)",
    ]) {
      const out = html(source);
      expect(out).not.toContain("<img");
      expect(anchors(out)).toEqual([]);
      expect(out).toContain("![x](");
    }
  });
});

describe("Markdown: only http and https make a link", () => {
  test("http and https links are anchors, in inline, reference and autolink forms", () => {
    expect(anchors(html("[a](http://example.com/a)"))).toEqual(['<a href="http://example.com/a">']);
    expect(anchors(html("[a](HTTPS://example.com/a)"))).toHaveLength(1);
    expect(anchors(html("[a][r]\n\n[r]: https://example.com/r"))).toEqual([
      '<a href="https://example.com/r">',
    ]);
    expect(anchors(html("<https://example.com/auto>"))).toEqual([
      '<a href="https://example.com/auto">',
    ]);
  });

  test("every other scheme, and no scheme, shows as its source text", () => {
    const urls = [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "&#106;avascript:alert(1)",
      "&#x6A;avascript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<b>x</b>",
      "file:///etc/passwd",
      "vbscript:x",
      "ftp://example.com/",
      "mailto:a@example.com",
      "tel:+39",
      "//example.com/",
      "/path",
      "page.html",
      "#frag",
    ];
    for (const url of urls) {
      for (const source of [`[x](${url})`, `[x][r]\n\n[r]: ${url}`, `<${url}>`, `[x](<${url}>)`]) {
        const out = html(source);
        expect(anchors(out)).toEqual([]);
        expect(out).not.toMatch(/href=/);
      }
    }
  });

  test("an empty destination makes no link: the five forms read as the spec says, exactly, with no anchor", () => {
    const shown = (source: string) => {
      const out = html(source);
      expect(anchors(out), source).toEqual([]);
      expect(out, source).not.toContain("<a");
      expect(out, source).not.toContain("href");
      return out;
    };
    expect(shown("[a]()")).toBe("<p>a</p>\n");
    expect(shown("[a]( )")).toBe("<p>a</p>\n");
    expect(shown("[a](<>)")).toBe("<p>[a](&lt;&gt;)</p>\n");
    expect(shown("![x]()")).toBe("<p>x</p>\n");
    expect(shown("![]()")).toBe("<p>![]()</p>\n");
    expect(shown("**[b]()**")).toContain("<strong>b</strong>");
    // The link's other forms keep their anchors beside an empty one.
    expect(anchors(html("[a]() and [b](https://example.com/b)"))).toEqual([
      '<a href="https://example.com/b">',
    ]);
  });

  test("a user name or password makes no link: the text shows, never the anchor", () => {
    for (const url of [
      "https://user:pass@example.com/",
      "https://user@example.com/",
      "http://:pass@example.com/",
      "https://u:p@evil.test/path?x=1",
      "https:\\\\user:pass@example.com/",
      "HTTPS://USER:PASS@EXAMPLE.COM/",
    ]) {
      for (const source of [`[c](${url})`, `[c][r]\n\n[r]: ${url}`, `![c](${url})`, `<${url}>`]) {
        const out = html(source);
        expect(anchors(out), source).toEqual([]);
        expect(out, source).not.toContain("href");
      }
    }
    // An @ after the host, in the path or the query, is no credential.
    expect(anchors(html("[m](https://example.com/@user?a=b@c)"))).toHaveLength(1);
  });

  test("isMarkdownLinkUrl admits http and https with a host and no credentials, case-insensitively", () => {
    expect(isMarkdownLinkUrl("https://a.test/@x")).toBe(true);
    expect(isMarkdownLinkUrl("https://a.test:8443/x")).toBe(true);
    for (const url of [
      "https://u:p@a.test/",
      "https://u@a.test/",
      "http://:p@a.test/",
      "https:\\\\u:p@a.test/",
      "https://",
      "http:",
      "https://exa mple.com/",
    ]) {
      expect(isMarkdownLinkUrl(url), url).toBe(false);
    }
  });

  test("isMarkdownLinkUrl admits http and https only, case-insensitively", () => {
    for (const url of ["http://a.test/", "https://a.test/x?y=1#z", "HTTPS://A.TEST/"]) {
      expect(isMarkdownLinkUrl(url)).toBe(true);
    }
    for (const url of [
      "",
      "javascript:x",
      "//a.test",
      "ftp://a.test",
      "xhttps://a.test",
      "data:,x",
    ]) {
      expect(isMarkdownLinkUrl(url)).toBe(false);
    }
  });
});

describe("Markdown: raw HTML shows as text", () => {
  test("script, img with a handler and a styled span are escaped, never elements", () => {
    const out = html(
      '<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\ntext <span style="color:red">x</span> end',
    );
    expect(out).not.toMatch(/<(img|script|span)/);
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain("&lt;span style=&quot;color:red&quot;&gt;x&lt;/span&gt;");
  });

  test("an HTML comment, a CDATA section and an entity are text", () => {
    const out = html("<!-- c --> <![CDATA[x]]> &lt;b&gt;");
    expect(out).not.toContain("<!--");
    expect(out).toContain("&lt;!-- c --&gt;");
    expect(out).toContain("&lt;b&gt;");
  });
});

describe("Markdown: bidirectional and other controls show as visible escapes", () => {
  const RLO = "‮";

  test("in text, inline code, a code block and a fence", () => {
    for (const source of [`a${RLO}b`, `\`a${RLO}b\``, `    a${RLO}b`, `\`\`\`\na${RLO}b\n\`\`\``]) {
      const out = html(source);
      expect(out).not.toContain(RLO);
      expect(out).toContain("a\\u202Eb");
    }
  });

  test("the entity form shows the same escape", () => {
    expect(html("a&#x202E;b")).toContain("a\\u202Eb");
  });

  test("a control and an isolate in a link label show as escapes too", () => {
    const out = html("[a⁦b\u0007](https://example.com/)");
    expect(out).toContain("a\\u2066b\\u0007");
  });

  test("a code block keeps its line breaks and tabs, which are no escapes", () => {
    expect(html("```\nx\n\ty\n```")).toBe("<pre><code>x\n\ty\n</code></pre>\n");
  });
});

describe("Markdown: bounded work", () => {
  test("nesting is cut at the limit: 30 nested quotes make at most the limit's elements", () => {
    expect(MARKDOWN_NESTING_MAX).toBe(20);
    const out = html(`${"> ".repeat(30)}deep`);
    const quotes = out.match(/<blockquote>/g)?.length ?? 0;
    expect(quotes).toBeGreaterThan(0);
    expect(quotes).toBeLessThanOrEqual(MARKDOWN_NESTING_MAX);
    // markdown-it stops at the limit: what lies deeper is not rendered, and nothing throws.
    expect(out).not.toMatch(/<\/?(script|img)/);
  });

  test("a source of exactly the Text's limit renders; one code point more is refused", () => {
    expect(markdownHtml("x".repeat(TEXT_MAX_CHARS))).toBeDefined();
    expect(markdownHtml("x".repeat(TEXT_MAX_CHARS + 1))).toBeUndefined();
    // Code points count, not UTF-16 units: 10,000 astral characters are within the limit.
    expect(markdownHtml("😀".repeat(TEXT_MAX_CHARS))).toBeDefined();
    expect(markdownHtml("😀".repeat(TEXT_MAX_CHARS + 1))).toBeUndefined();
  });

  test("an empty source renders as nothing", () => {
    expect(html("")).toBe("");
  });
});

// A reference definition repeated by many images or links grows a source of 10,000 code points into
// megabytes of HTML (checkpoint 1.8 X-2). The fixtures hold a URL of `url` characters and as many
// uses of it as the source's limit allows, `uses` marking each as an image, a link or either.
const repeated = (url: number, use: string): string => {
  const definition = `\n\n[r]: https://e.test/${"a".repeat(url - 14)}`;
  const count = Math.floor((TEXT_MAX_CHARS - definition.length) / (use.length + 1));
  return `${Array.from({ length: count }, () => use).join(" ")}${definition}`;
};

describe("Markdown: the output's size is bounded as well as the source's (checkpoint 1.8 X-2)", () => {
  test("the bound is 200,000 characters of HTML before the sanitizer", () => {
    expect(MARKDOWN_HTML_MAX_CHARS).toBe(200_000);
  });

  test("one long URL used as image and as link, up to the code-point limit, gives no HTML", () => {
    for (const [url, use] of [
      [5_000, "![r][r] [r][r]"],
      [2_000, "![r][r]"],
      [9_000, "![r][r]"],
      [500, "[r][r]"],
      [3_000, "[r]"],
    ] as const) {
      const source = repeated(url, use);
      expect(Array.from(source).length, `${url} ${use}`).toBeLessThanOrEqual(TEXT_MAX_CHARS);
      expect(markdownHtml(source), `${url} ${use}`).toBeUndefined();
    }
  });

  test("the same fixtures take no longer than 500 ms to be refused", () => {
    const started = performance.now();
    for (const url of [5_000, 2_000, 9_000]) markdownHtml(repeated(url, "![r][r] [r][r]"));
    expect(performance.now() - started).toBeLessThan(500);
  });

  test("a source whose HTML stands under the bound still renders", () => {
    const out = html(repeated(100, "[r][r]"));
    expect(out.length).toBeLessThanOrEqual(MARKDOWN_HTML_MAX_CHARS);
    expect(out).toContain("https://e.test/");
    // Many short items: every one of them stays.
    const many = html(Array.from({ length: 800 }, (_, at) => `- item ${at}`).join("\n"));
    expect(many.length).toBeLessThanOrEqual(MARKDOWN_HTML_MAX_CHARS);
    expect(many).toContain("item 799");
  });

  test("the cap counts the HTML, so a table of 500 cells within it renders", () => {
    const cells = Array.from({ length: 500 }, (_, at) => `c${at}`);
    const rows = Array.from(
      { length: 50 },
      (_, row) => `| ${cells.slice(row * 10, row * 10 + 10).join(" | ")} |`,
    );
    const out = html(`| ${"h | ".repeat(9)}h |\n|${"---|".repeat(10)}\n${rows.join("\n")}`);
    expect(out).toContain("<td>c499</td>");
  });
});

describe("Markdown: the sanitizer's allow-list", () => {
  test("the tags are exactly the spec's, and the attributes href, start and class", () => {
    expect([...MARKDOWN_ALLOWED_TAGS].sort()).toEqual(
      [
        "a",
        "blockquote",
        "br",
        "code",
        "del",
        "em",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "li",
        "ol",
        "p",
        "pre",
        "s",
        "strong",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "ul",
      ].sort(),
    );
    expect([...MARKDOWN_ALLOWED_ATTR].sort()).toEqual(["class", "href", "start"]);
  });

  test("every tag markdown-it writes for the supported constructs is on the list", () => {
    const out = html(
      "# a\n\n## b\n\n###### f\n\n*e* **s** ~~x~~ `c`  \nb\n\n> q\n\n1. o\n2. p\n\n- u\n\n---\n\n```\nk\n```\n\n| h |\n|---|\n| d |\n\n[l](https://a.test/)",
    );
    const tags = new Set(
      [...out.matchAll(/<([a-z][a-z0-9]*)[ >]/g)].map((match) => String(match[1])),
    );
    for (const tag of tags) expect(MARKDOWN_ALLOWED_TAGS as readonly string[]).toContain(tag);
    expect(tags.size).toBeGreaterThan(15);
  });

  test("a window with no DOM gives no sanitizer: the renderer shows plain text then", () => {
    const none = {} as unknown as WindowLike;
    expect(sanitizerFor(none)).toBeUndefined();
    expect(sanitizeHtml("<p>x</p>", none)).toBeUndefined();
    expect(renderMarkdown("x", none)).toBeUndefined();
    // Nothing is rendered, and nothing is sanitized, for a source over its bound either.
    expect(renderMarkdown("x".repeat(TEXT_MAX_CHARS + 1), none)).toBeUndefined();
  });
});
