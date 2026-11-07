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
