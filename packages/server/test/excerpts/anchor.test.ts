import { describe, expect, test } from "bun:test";
import { EXCERPT_MAX_BYTES, EXCERPT_MAX_LINES, type PointerAnchor } from "@askboard/contract";
import { excerptOf, findAnchor } from "../../src/excerpts/anchor.ts";

// Board-host spec, Anchors find their lines (excerpts, task 2.4; design decision 3, step 6;
// proposal A5): a line range anywhere; a heading or an ID only in Markdown, as the first ATX
// heading outside fenced code whose text equals it, else the first holding it as a whole word,
// giving its section up to the next heading of the same or a higher level. Tables, no files.

const lines = (start: number, end: number): PointerAnchor => ({ kind: "lines", start, end });
const name = (text: string): PointerAnchor => ({ kind: "name", text });
const inMarkdown = (doc: readonly string[], anchor: string) => findAnchor(doc, name(anchor), true);

const DOC = [
  "# Title", // 1
  "",
  "Intro text.",
  "",
  "## Decision", // 5
  "",
  "We retry three times.",
  "",
  "### Detail", // 9
  "More.",
  "",
  "## Consequences ##", // 12
  "Fine.",
  "",
  "#### FR-8: Excerpts beside the question", // 15
  "Body of FR-8.",
  "#### FR-80: Something else", // 17
  "x",
  "# Next top", // 19
  "end",
];

describe("line ranges, in any file", () => {
  const FIVE = ["a", "b", "c", "d", "e"];

  test.each([
    ["within the file", lines(2, 3), { start: 2, end: 3 }],
    ["one line", lines(4, 4), { start: 4, end: 4 }],
    ["at the last line", lines(5, 5), { start: 5, end: 5 }],
    ["the whole file", lines(1, 5), { start: 1, end: 5 }],
    ["past the end", lines(4, 6), undefined],
    ["wholly past the end", lines(35, 60), undefined],
  ] as const)("%s", (_, anchor, expected) => {
    expect(findAnchor(FIVE, anchor, false)).toEqual(expected);
    expect(findAnchor(FIVE, anchor, true)).toEqual(expected);
  });

  test("an empty file has no line", () => {
    expect(findAnchor([], lines(1, 1), true)).toBeUndefined();
  });
});

describe("sections in Markdown (proposal A5)", () => {
  test.each([
    ["an exact heading, its section holding lower headings", "Decision", { start: 5, end: 10 }],
    ["a heading with a closing # run", "Consequences", { start: 12, end: 18 }],
    ["a whole-word ID in a heading", "FR-8", { start: 15, end: 16 }],
    ["another ID, sharing the first one's prefix", "FR-80", { start: 17, end: 18 }],
    ["a top heading, up to the next top heading", "Title", { start: 1, end: 18 }],
    ["the last section, up to the end of the file", "Next top", { start: 19, end: 20 }],
    ["an anchor trimmed before it is compared", "  Decision ", { start: 5, end: 10 }],
    ["a heading's exact text, case and all", "decision", undefined],
    ["part of a word", "R-8", undefined],
    ["a heading that does not exist", "Setup", undefined],
    ["an anchor of blanks", "   ", undefined],
  ] as const)("%s", (_, anchor, expected) => {
    expect(inMarkdown(DOC, anchor)).toEqual(expected);
  });

  test("an exact heading wins over an earlier one holding the anchor as a word", () => {
    const doc = ["## About FR-8", "a", "## FR-8", "b"];
    expect(inMarkdown(doc, "FR-8")).toEqual({ start: 3, end: 4 });
  });

  test("a whole word is bounded by letters, digits, -, _ and .", () => {
    const doc = [
      "## XFR-8 and FR-80", // 1
      "## FR-8.1 and FR-8_b and FR-8-x", // 2
      "## ÉFR-8 and FR-8é", // 3
      "## (FR-8) — AD-12, 🙂FR-8", // 4
      "x",
    ];
    expect(inMarkdown(doc, "FR-8")).toEqual({ start: 4, end: 5 });
    expect(inMarkdown(doc, "AD-12")).toEqual({ start: 4, end: 5 });
    expect(inMarkdown(["## 𝐀FR-8𝐀", "## The FR-8 rule"], "FR-8")).toEqual({ start: 2, end: 2 });
  });

  test.each([
    ["a backtick fence", ["```md", "# Setup", "```", "text"]],
    ["a tilde fence", ["~~~", "# Setup", "~~~", "text"]],
    ["an unclosed fence, which runs to the end", ["```", "# Setup", "text"]],
    ["a fence indented by three spaces", ["   ```", "# Setup", "   ```"]],
    ["a fence closed only by a run as long", ["````", "```", "# Setup", "````"]],
    ["a tilde fence that backticks do not close", ["~~~", "```", "# Setup", "~~~"]],
  ] as const)("a heading inside %s is ignored", (_, doc) => {
    expect(inMarkdown(doc, "Setup")).toBeUndefined();
  });

  test("a heading after a fence is found, and a fence inside a section does not end it", () => {
    expect(inMarkdown(["````", "```", "# Setup", "````", "# Setup", "x"], "Setup")).toEqual({
      start: 5,
      end: 6,
    });
    const doc = ["## A", "```", "## B", "```", "text", "## C"];
    expect(inMarkdown(doc, "A")).toEqual({ start: 1, end: 5 });
    expect(inMarkdown(doc, "B")).toBeUndefined();
  });

  test("a backtick run whose info string holds a backtick opens no fence", () => {
    expect(inMarkdown(["``` a`b", "# H", "x"], "H")).toEqual({ start: 2, end: 3 });
  });

  test.each([
    ["four spaces of indent", ["    # Code", "x"], "Code"],
    ["no space after the #", ["#hashtag", "x"], "hashtag"],
    ["seven #", ["####### Seven", "x"], "Seven"],
    ["a fence indented by four spaces, which opens none", ["    ```", "# Setup"], "Setup"],
  ] as const)("%s", (label, doc, anchor) => {
    const found = inMarkdown(doc, anchor);
    if (label.startsWith("a fence")) expect(found).toEqual({ start: 2, end: 2 });
    else expect(found).toBeUndefined();
  });

  test.each([
    ["## Foo ##", "Foo"],
    ["### Foo ###   ", "Foo"],
    ["## Foo#", "Foo#"],
    ["#\tTabbed", "Tabbed"],
    ["   ## Indented", "Indented"],
    ["## Spaced   out  ", "Spaced   out"],
  ] as const)("the heading %p reads as %p", (heading, text) => {
    expect(inMarkdown([heading, "x"], text)).toEqual({ start: 1, end: 2 });
  });

  test("an empty heading matches no anchor", () => {
    expect(inMarkdown(["# #", "##", "x"], "#")).toBeUndefined();
  });

  test("a section's trailing blank lines are left out, its heading never", () => {
    expect(inMarkdown(["## A", "x", "", "  \t", "## B"], "A")).toEqual({ start: 1, end: 2 });
    expect(inMarkdown(["## A", "", "", "## B"], "A")).toEqual({ start: 1, end: 1 });
  });

  test("in any other file a heading or an ID never resolves", () => {
    expect(findAnchor(["# Decision", "x"], name("Decision"), false)).toBeUndefined();
    expect(findAnchor(["// FR-8", "x"], name("FR-8"), false)).toBeUndefined();
  });
});

describe("an excerpt's text and its limits (proposal A11)", () => {
  const numbered = (count: number, width = 1) =>
    Array.from({ length: count }, (_, index) => `${index + 1}`.padEnd(width, "x"));

  test("is the range's lines joined by LF", () => {
    expect(excerptOf(numbered(60), { start: 40, end: 52 })).toEqual({
      text: numbered(52).slice(39).join("\n"),
    });
  });

  test("of the most lines is kept, and one more line is too-large", () => {
    const doc = numbered(EXCERPT_MAX_LINES + 1);
    expect(excerptOf(doc, { start: 1, end: EXCERPT_MAX_LINES })).toMatchObject({
      text: expect.any(String),
    });
    expect(excerptOf(doc, { start: 1, end: EXCERPT_MAX_LINES + 1 })).toEqual({
      refused: "too-large",
    });
  });

  test("of the most UTF-8 bytes is kept, and one more byte is too-large", () => {
    expect(excerptOf(["x".repeat(EXCERPT_MAX_BYTES)], { start: 1, end: 1 })).toMatchObject({
      text: expect.any(String),
    });
    expect(excerptOf(["é".repeat(EXCERPT_MAX_BYTES / 2)], { start: 1, end: 1 })).toMatchObject({
      text: expect.any(String),
    });
    expect(excerptOf([`${"é".repeat(EXCERPT_MAX_BYTES / 2)}x`], { start: 1, end: 1 })).toEqual({
      refused: "too-large",
    });
    const two = ["x".repeat(EXCERPT_MAX_BYTES / 2), "x".repeat(EXCERPT_MAX_BYTES / 2)];
    expect(excerptOf(two, { start: 1, end: 2 })).toEqual({ refused: "too-large" });
  });
});

describe("hostile lines take linear time (security review, finding R1)", () => {
  // A line the section finder reads, in a Markdown file the agent can write: each of these took
  // quadratic time in the regular expressions, about 0.23 s at 20,000 characters, so a 4 MiB line
  // would freeze the session process for hours.
  const LONG = 100_000;
  const blanks = " ".repeat(LONG);

  test.each([
    ["a heading whose blanks end in no closing run", `# x${blanks}y`],
    ["a heading whose blanks end in a line separator", `#${blanks} `],
    ["a heading of tabs and #", `# a${"\t#".repeat(LONG / 2)}b`],
    ["a run of backticks ending in a line separator", `${"`".repeat(LONG)} `],
    ["a run of tildes ending in a paragraph separator", `${"~".repeat(LONG)} `],
  ] as const)("%s", (_, line) => {
    const started = performance.now();
    findAnchor([line, "## Next", "x"], name("Next"), true);
    findAnchor(["```", line, "```", "## Next"], name("Next"), true);
    expect(performance.now() - started).toBeLessThan(200);
  });

  test("a line separator inside a heading stays part of its text", () => {
    expect(inMarkdown(["# A B", "x"], "A B")).toEqual({ start: 1, end: 2 });
    expect(inMarkdown(["``` ", "# In", "```", "# Out"], "In")).toBeUndefined();
  });
});
