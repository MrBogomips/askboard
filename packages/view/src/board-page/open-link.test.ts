// The board page opens the links of Markdown (atoms, task 4.2; view-and-widgets spec: The board
// page opens Markdown links; design decision 6; AD-8): an `open-link` message opens its URL, through
// the page's own `openLink`, only when the URL is `http:` or `https:`, at most 2,048 characters, and
// the item it names holds Markdown in the board document the page holds. The page reads nothing of
// the item from the message, and a message that fails any check opens nothing, sends nothing to the
// agent and logs why, without the agent's text.

import { describe, expect, test } from "bun:test";
import type { HostMessage } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  settled,
  setUp,
  stateOf,
  version,
  waiting,
} from "../../test/board-page/controller-harness.ts";

const [base] = plainChoiceBoardDocument.items;
const options = base.props.options ?? [];

const withItems = (
  items: readonly unknown[],
  previews: readonly (readonly [number, string | undefined])[] = [],
): HostMessage => {
  const marked = options.map((option, at) => {
    const found = previews.find(([index]) => index === at);
    return found === undefined
      ? option
      : {
          ...option,
          preview: "```sql\nSELECT 1\n```",
          ...(found[1] ? { previewFormat: found[1] } : {}),
        };
  });
  return {
    version,
    type: "board",
    document: {
      ...plainChoiceBoardDocument,
      items: [{ ...base, props: { ...base.props, options: marked, items } }],
    },
  } as unknown as HostMessage;
};

const NOTES = {
  type: "text",
  id: "notes",
  props: { text: "[docs](https://x.test)", format: "markdown" },
};
const ITEMS = [
  NOTES,
  { type: "text", id: "intro", props: { text: "hello" } },
  { type: "text", id: "spelled", props: { text: "x", format: "plain" } },
  { type: "reference", id: "pr", props: { kind: "WEB", url: "https://x.test/pr" } },
];

const opened = async (board: HostMessage = withItems(ITEMS)) => {
  const run = setUp();
  run.socket(1).receive(board, stateOf(waiting));
  await settled();
  return run;
};

const open = (run: Awaited<ReturnType<typeof opened>>, itemId: string, url: string) =>
  run.view({ type: "open-link", itemId, url });

describe("the board page opens a Markdown link", () => {
  test("an https link from a Markdown Text opens once, and nothing is sent to the agent", async () => {
    const run = await opened();
    expect(await open(run, "notes", "https://example.com/docs")).toEqual({});
    expect(run.opened).toEqual(["https://example.com/docs"]);
    expect(run.acts(1)).toEqual([]);
    expect(run.logs).toEqual([]);
  });

  test("an http link opens, and so does one at exactly 2,048 characters", async () => {
    const run = await opened();
    const longest = `https://example.com/${"a".repeat(2048 - 20)}`;
    await open(run, "notes", "http://example.com/");
    await open(run, "notes", longest);
    expect(run.opened).toEqual(["http://example.com/", longest]);
  });

  test("a question whose option holds a Markdown preview opens the link its preview shows", async () => {
    const run = await opened(withItems(ITEMS, [[0, "markdown"]]));
    await open(run, "database", "https://example.com/spec");
    expect(run.opened).toEqual(["https://example.com/spec"]);
  });
});

describe("a forged open-link message opens nothing", () => {
  const FORGED = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "file:///etc/passwd",
    "data:text/html,<b>x</b>",
    "vbscript:x",
    "ftp://example.com/",
    "mailto:a@example.com",
    "blob:https://example.com/x",
    "//example.com/",
    "/path",
    "not a url",
    "",
    " https://example.com/",
    "https://exa\tmple.com/",
    "https://example.com/\u0000",
    `https://example.com/${"a".repeat(2049 - 20)}`,
    // A user name or password, in every spelling the URL parser reads (review 2.3 and 4.4, U-2).
    "https://user:pass@example.com/",
    "https://user@example.com/",
    "https://:pass@example.com/",
    "http://u:p@evil.test/",
    "https:\\\\user:pass@example.com/",
    "https:/\\user:pass@example.com/",
    "HTTPS://USER:PASS@EXAMPLE.COM/",
  ];

  test("a URL that is not http or https, does not parse, or is over 2,048 characters", async () => {
    const run = await opened();
    for (const url of FORGED) {
      expect(await open(run, "notes", url), url).toEqual({});
    }
    expect(run.opened).toEqual([]);
    expect(run.acts(1)).toEqual([]);
    expect(run.logs).toHaveLength(FORGED.length);
  });

  test("an item that holds no Markdown: a plain Text, a spelled-out plain format, a reference, an unknown ID", async () => {
    const run = await opened();
    for (const itemId of ["intro", "spelled", "pr", "no-such-item", "__proto__", "constructor"]) {
      expect(await open(run, itemId, "https://example.com/"), itemId).toEqual({});
    }
    expect(run.opened).toEqual([]);
    expect(run.logs).toHaveLength(6);
  });

  test("a question whose options hold no Markdown preview: none, a plain one, one with a format and no preview", async () => {
    const none = await opened();
    await open(none, "database", "https://example.com/");
    const plain = await opened(
      withItems(ITEMS, [
        [0, "plain"],
        [1, undefined],
      ]),
    );
    await open(plain, "database", "https://example.com/");
    expect(none.opened).toEqual([]);
    expect(plain.opened).toEqual([]);
  });

  test("a log line names the reason and carries neither the URL nor the item's text", async () => {
    const run = await opened();
    await open(run, "notes", "javascript:alert('agent-url')");
    await open(run, "intro", "https://example.com/agent-secret");
    expect(run.logs).toHaveLength(2);
    for (const line of run.logs) {
      expect(line).not.toContain("agent-url");
      expect(line).not.toContain("agent-secret");
      expect(line).not.toContain("hello");
      expect(line).toContain("open-link");
    }
    expect(run.logs[0]).not.toBe(run.logs[1]);
  });

  test("the board document the page holds now decides: an item a revision made plain opens nothing", async () => {
    const run = await opened();
    await open(run, "notes", "https://example.com/before");
    run
      .socket(1)
      .receive(withItems([{ ...NOTES, props: { text: "now plain" } }, ...ITEMS.slice(1)]));
    await open(run, "notes", "https://example.com/after");
    expect(run.opened).toEqual(["https://example.com/before"]);
  });
});

// A Document review is Markdown the user reads (document-review, task 4.2, design decision 10):
// the same check holds for it as for a Text, at any depth of the layouts, by the board document.
describe("the board page opens a link of a Document review", () => {
  const REVIEW = {
    type: "document-review",
    id: "review",
    props: { markdown: "See [the spec](https://x.test/spec).", title: "Spec" },
  };
  const CHART = {
    type: "chart",
    id: "failures",
    props: {
      kind: "bar",
      categories: [{ id: "a", label: "A" }],
      series: [{ id: "s", label: "S", values: [1] }],
    },
  };
  const NESTED = [
    {
      type: "group",
      id: "outer",
      props: {
        title: "Outer",
        items: [{ type: "group", id: "inner", props: { title: "Inner", items: [REVIEW] } }],
      },
    },
  ];

  test("a Document review at the top level opens the link its document shows", async () => {
    const run = await opened(withItems([REVIEW, ...ITEMS]));
    expect(await open(run, "review", "https://example.com/spec")).toEqual({});
    expect(run.opened).toEqual(["https://example.com/spec"]);
    expect(run.logs).toEqual([]);
  });

  test("one two layouts deep opens it too, and the layouts themselves hold no Markdown", async () => {
    const run = await opened(withItems([...NESTED, ...ITEMS]));
    await open(run, "review", "https://example.com/deep");
    expect(run.opened).toEqual(["https://example.com/deep"]);
    for (const layout of ["outer", "inner"]) {
      await open(run, layout, "https://example.com/layout");
    }
    expect(run.opened).toEqual(["https://example.com/deep"]);
    expect(run.logs).toHaveLength(2);
  });

  test("a Chart, a plain Text and an unknown ID are refused, with a log line that holds no agent text", async () => {
    const run = await opened(withItems([REVIEW, CHART, ...ITEMS]));
    for (const itemId of ["failures", "intro", "no-such-item"]) {
      expect(await open(run, itemId, "https://example.com/secret-path"), itemId).toEqual({});
    }
    expect(run.opened).toEqual([]);
    expect(run.logs).toHaveLength(3);
    for (const line of run.logs) {
      expect(line).toContain("open-link");
      expect(line).not.toContain("secret-path");
      expect(line).not.toContain("the spec");
      expect(line).not.toContain("failures");
    }
  });

  test("__proto__ and constructor as item IDs are refused", async () => {
    const run = await opened(withItems([REVIEW, ...ITEMS]));
    for (const itemId of ["__proto__", "constructor", "toString"]) {
      expect(await open(run, itemId, "https://example.com/"), itemId).toEqual({});
    }
    expect(run.opened).toEqual([]);
    expect(run.logs).toHaveLength(3);
  });

  test("the URL check is unchanged: a Document review's item still refuses what a Text's refuses", async () => {
    const run = await opened(withItems([REVIEW, ...ITEMS]));
    for (const url of ["javascript:alert(1)", "https://user:pass@example.com/", "file:///x", ""]) {
      expect(await open(run, "review", url), url).toEqual({});
    }
    expect(run.opened).toEqual([]);
    expect(run.logs).toHaveLength(4);
  });

  test("a revision that leaves no Document review under the ID stops it opening", async () => {
    const run = await opened(withItems([REVIEW, ...ITEMS]));
    await open(run, "review", "https://example.com/before");
    run.socket(1).receive(withItems([{ ...REVIEW, type: "text", props: { text: "plain now" } }]));
    await open(run, "review", "https://example.com/after");
    expect(run.opened).toEqual(["https://example.com/before"]);
  });
});
