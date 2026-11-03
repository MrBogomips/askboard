import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cspHashSource, SOURCE_VIEW_MAX_LINES } from "@askboard/contract";
import type { SourceText } from "@askboard/core";
import {
  SOURCE_VIEW_POLICY,
  SOURCE_VIEW_STYLE_SHA256,
  sourceViewPage,
} from "../../src/board-host/source-view.ts";

// The source view's page (excerpts, task 5.1; design decision 5; board-host spec, "The source
// view", "A source file that holds markup", "A missing or binary file"), parsed with Bun's
// HTMLRewriter: only the page's own elements, and every character of the file as text.

const PAGE_ELEMENTS = ["html", "head", "meta", "title", "style", "body", "pre", "span", "p"];

type Parsed = {
  /** Each element's tag and attributes, in document order. */
  readonly elements: { readonly tag: string; readonly attributes: Record<string, string> }[];
  readonly comments: string[];
  /** Each line span's text, decoded: its number left out, each marker given back as its control. */
  readonly lines: Map<string, string>;
  readonly classes: Map<string, string>;
  readonly style: string;
  /** The body's text, decoded. */
  readonly body: string;
};

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"' };

// The character references the page writes, and no other.
const decode = (raw: string): string =>
  raw.replace(/&(?:#(\d+)|([a-z]+));/g, (whole, code?: string, name?: string) => {
    if (code !== undefined) return String.fromCodePoint(Number(code));
    const named = name === undefined ? undefined : ENTITIES[name];
    if (named === undefined) throw new Error(`an unexpected reference ${whole}`);
    return named;
  });

// What the parse is inside of: text chunks may split anywhere, so each part is kept raw and
// decoded once the document ends.
type Inside = { line?: string; number: boolean; mark: boolean; style: boolean; body: boolean };

const parse = async (html: string): Promise<Parsed> => {
  const elements: Parsed["elements"] = [];
  const comments: string[] = [];
  const raw = new Map<string, string>();
  const classes = new Map<string, string>();
  const inside: Inside = { number: false, mark: false, style: false, body: false };
  let style = "";
  let body = "";
  const until = (element: HTMLRewriterTypes.Element, key: "number" | "mark" | "style") => {
    inside[key] = true;
    element.onEndTag(() => {
      inside[key] = false;
    });
  };
  await new HTMLRewriter()
    .on("*", {
      element(element) {
        const attributes = Object.fromEntries(element.attributes);
        elements.push({ tag: element.tagName, attributes });
        if (element.tagName === "body") inside.body = true;
        if (element.tagName === "style") until(element, "style");
        if (attributes.class === "n") until(element, "number");
        const { id, class: name = "" } = attributes;
        if (element.tagName === "span" && id !== undefined) {
          inside.line = id;
          raw.set(id, "");
          classes.set(id, name);
          element.onEndTag(() => {
            inside.line = undefined;
          });
        }
        if (name === "mark" && inside.line !== undefined) {
          const code = Number.parseInt(attributes["data-code"] ?? "", 16);
          raw.set(inside.line, `${raw.get(inside.line)}&#${code};`);
          until(element, "mark");
        }
      },
    })
    .onDocument({
      comments(comment) {
        comments.push(comment.text);
      },
      text(chunk) {
        if (inside.style) style += chunk.text;
        if (inside.body) body += chunk.text;
        if (inside.line === undefined || inside.number || inside.mark) return;
        raw.set(inside.line, `${raw.get(inside.line)}${chunk.text}`);
      },
    })
    .transform(new Response(html))
    .text();
  const lines = new Map([...raw].map(([id, text]) => [id, decode(text)]));
  return { elements, comments, lines, classes, style, body: decode(body) };
};

const available = (text: string, hit?: { start: number; end: number }): SourceText => ({
  status: "available",
  text,
  ...(hit === undefined ? {} : { hit }),
});

const pageOf = (text: string, hit?: { start: number; end: number }, path = "src/retry.ts") =>
  parse(sourceViewPage({ path, source: available(text, hit) }));

// The file's text back from the page's line spans, L1 to Ln in order.
const textOf = ({ lines }: Parsed): string => {
  const ids = [...lines.keys()];
  expect(ids).toEqual(ids.map((_, n) => `L${n + 1}`));
  return [...lines.values()].join("\n");
};

const onlyPageElements = (parsed: Parsed) => {
  for (const { tag } of parsed.elements) expect(PAGE_ELEMENTS).toContain(tag);
  expect(parsed.comments).toEqual([]);
};

const HOSTILE = [
  [
    "markup",
    '</pre><script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://example.com">',
  ],
  ["a comment opener", "<!-- not a comment"],
  ["a CDATA end", "<![CDATA[ x ]]> y"],
  [
    "a style and a link",
    '<style>body{display:none}</style><link rel="stylesheet" href="https://x">',
  ],
  ["quotes and ampersands", `a="1" b='2' &amp; &lt; &#60; &`],
  ["control characters", "bell \u0007 escape \u001b[31m tab\tend \u0085 \u009b"],
  ["carriage returns", "one\r\ntwo\rthree"],
  ["a NUL, shown as a marker", "before\u0000after"],
  ["characters outside the BMP", "𝄞 🎹 é ﷽"],
] as const;

describe("the page holds only its own elements, and the file as text", () => {
  test.each(HOSTILE)("%s", async (_, text) => {
    const parsed = await pageOf(`first\n${text}\nlast`);
    onlyPageElements(parsed);
    expect(textOf(parsed)).toBe(`first\n${text}\nlast`);
  });

  test("the spec's markup scenario shows as text, with no script, meta or link from the file", async () => {
    const markup = HOSTILE[0][1];
    const parsed = await pageOf(markup);
    expect(parsed.elements.filter((element) => element.tag === "script")).toEqual([]);
    expect(parsed.elements.filter((element) => element.tag === "meta")).toEqual([
      { tag: "meta", attributes: { charset: "utf-8" } },
    ]);
    expect(parsed.body).toContain("<script>alert(1)</script>");
  });

  test("a hostile path is text in the title", async () => {
    const path = 'docs/</title><script>alert(1)</script>"x.md';
    const parsed = await pageOf("text", undefined, path);
    onlyPageElements(parsed);
    const html = sourceViewPage({ path, source: available("text") });
    expect(html).toContain(
      "<title>docs/&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;&quot;x.md</title>",
    );
  });

  test("a carriage return is a reference, which the HTML parser keeps as itself", () => {
    const html = sourceViewPage({ path: "a\r.ts", source: available("one\r\ntwo\rthree") });
    expect(html).not.toContain("\r");
    expect(html).toContain("one&#13;</span>");
  });

  test("an empty file is one empty line", async () => {
    expect(textOf(await pageOf(""))).toBe("");
  });
});

describe("lines", () => {
  test("ids L1 to Ln, each line's number in its own span, the anchor's lines marked", async () => {
    const parsed = await pageOf("a\nb\nc\nd", { start: 2, end: 3 });
    expect([...parsed.classes.entries()]).toEqual([
      ["L1", "line"],
      ["L2", "line hit"],
      ["L3", "line hit"],
      ["L4", "line"],
    ]);
    const numbers = parsed.elements.filter((element) => element.attributes.class === "n");
    expect(numbers).toHaveLength(4);
  });

  test("a line number is not part of the line's text", async () => {
    const html = sourceViewPage({ path: "a.ts", source: available("x") });
    expect(html).toContain('<span id="L1" class="line"><span class="n">1</span>x</span>');
  });

  test(`a file of ${SOURCE_VIEW_MAX_LINES} lines has every line`, async () => {
    const lines = Array.from({ length: SOURCE_VIEW_MAX_LINES }, (_, n) => `line ${n + 1} <&>`);
    const parsed = await pageOf(lines.join("\n"), { start: 19_990, end: 20_000 });
    expect(textOf(parsed)).toBe(lines.join("\n"));
    expect(parsed.classes.get("L20000")).toBe("line hit");
    expect(parsed.classes.get("L19989")).toBe("line");
  });
});

describe("bidirectional controls", () => {
  test.each([
    0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
  ])("U+%s shows as a visible marker, never as itself", async (code) => {
    const control = String.fromCodePoint(code);
    const text = `const ok = "${control}admin${control}";`;
    const html = sourceViewPage({ path: `a${control}.ts`, source: available(text) });
    expect(html).not.toContain(control);
    const hex = code.toString(16).toUpperCase().padStart(4, "0");
    expect(html).toContain(`<span class="mark" data-code="${hex}">\\u${hex}</span>`);
    const parsed = await parse(html);
    expect(textOf(parsed)).toBe(text);
  });
});

describe("the other states", () => {
  test.each([
    ["missing", "This file is not available"],
    ["outside-root", "This file is not available"],
    ["not-text", "This file cannot be shown as text"],
  ] as const)("%s: one line with the path, and nothing of the file", async (status, line) => {
    const html = sourceViewPage({ path: "docs/<b>.md", source: { status } });
    const parsed = await parse(html);
    onlyPageElements(parsed);
    expect(parsed.lines.size).toBe(0);
    expect(parsed.body.trim()).toBe(`${line}: docs/<b>.md`);
  });

  test("too-large: one line with the path and the size", async () => {
    const source: SourceText = { status: "too-large", size: 3 * 1024 * 1024 + 1 };
    const parsed = await parse(sourceViewPage({ path: "big.log", source }));
    expect(parsed.body.trim()).toBe(
      "This file is too large to show here: big.log (3,145,729 bytes)",
    );
  });
});

describe("the stylesheet and the scheme", () => {
  test("the page's one stylesheet has the hash the policy names", async () => {
    const parsed = await pageOf("x");
    expect(parsed.elements.filter((element) => element.tag === "style")).toHaveLength(1);
    const hash = createHash("sha256").update(parsed.style, "utf8").digest("hex");
    expect(hash).toBe(SOURCE_VIEW_STYLE_SHA256);
    expect(SOURCE_VIEW_POLICY).toContain(`style-src ${cspHashSource(hash)}`);
    expect(SOURCE_VIEW_POLICY).toStartWith("default-src 'none'");
  });

  test.each([
    ["light", "light"],
    ["dark", "dark"],
    [undefined, undefined],
  ] as const)("scheme %s", async (scheme, attribute) => {
    const html = sourceViewPage({
      path: "a.ts",
      source: available("x"),
      ...(scheme ? { scheme } : {}),
    });
    const [root] = (await parse(html)).elements;
    expect(root?.attributes["data-scheme"]).toBe(attribute);
    const other = sourceViewPage({
      path: "a.ts",
      source: { status: "missing" },
      ...(scheme ? { scheme } : {}),
    });
    expect((await parse(other)).style).toBe((await parse(html)).style);
  });
});
