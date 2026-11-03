// What `fetch` gets of a question's context (excerpts, task 4.1; design decision 4, `fetch`;
// mcp-adapter spec, "Fetch omits excerpt text and image bytes"): the board document's items without
// an excerpt's text, written or read, or an image's bytes, at any depth, statuses and lines kept.

import { describe, expect, test } from "bun:test";
import {
  type FetchContextItem,
  type LifecycleAskInput,
  RESULT_VERSIONS,
  SCHEMA_IDS,
} from "@askboard/contract";
import { ONE_PIXEL_PNG } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import type { AskCore } from "../src/index.ts";
import {
  ADR_POINTER,
  boardItemsOf,
  CONTEXT_ASK_ID,
  contextAsk,
  contextCoreWith,
  everyItem,
} from "./context-fakes.ts";

const answers = {
  "src/retry.ts#L1-L5": { resolveReference: { status: "resolved", lines: { start: 1, end: 5 } } },
  "docs/missing.md": { resolveExcerpt: { status: "unresolved", reason: "not-found" } },
} as const;

const created = async (ask: LifecycleAskInput) => {
  const fakes = contextCoreWith({ answers });
  expect((await fakes.core.ask(ask)).kind).toBe("created");
  return fakes.core;
};

// The item `fetch` would return, checked against the fetch result's envelope.
const fetched = (core: AskCore, itemId: string) => {
  const value = core.fullValue(CONTEXT_ASK_ID, itemId);
  if (value.kind !== "item") throw new Error(`no item ${itemId}: ${value.kind}`);
  const result = {
    versions: RESULT_VERSIONS,
    epoch: core.epoch,
    askId: value.askId,
    state: value.state,
    item: value.item,
  };
  expect(validateAgainst(SCHEMA_IDS.fetchResult, result)).toEqual({ ok: true, value: result });
  return value.item;
};

const withMissing = () => [
  ...everyItem(),
  { type: "excerpt" as const, id: "gone", props: { pointer: "docs/missing.md" } },
];

const EXPECTED_ITEMS: [FetchContextItem, ...FetchContextItem[]] = [
  {
    type: "excerpt",
    id: "retry-adr",
    props: {
      pointer: ADR_POINTER,
      status: "resolved",
      mediaType: "text/markdown",
      lines: { start: 7, end: 9 },
    },
  },
  { type: "excerpt", id: "note", props: { title: "Note" } },
  {
    type: "reference",
    id: "retry-src",
    props: {
      pointer: "src/retry.ts#L1-L5",
      kind: "file",
      status: "resolved",
      lines: { start: 1, end: 5 },
    },
  },
  {
    type: "reference",
    id: "pr",
    props: { url: "https://github.com/acme/orders/pull/12", kind: "github" },
  },
  { type: "reference", id: "docs", props: { url: "https://example.com/retries", kind: "web" } },
  {
    type: "image",
    id: "shot",
    props: {
      pointer: ".askboard/media/shot.png",
      alt: "The failure",
      status: "resolved",
      mediaType: "image/png",
    },
  },
  {
    type: "excerpt",
    id: "gone",
    props: { pointer: "docs/missing.md", status: "unresolved", reason: "not-found" },
  },
];

describe("fetch of a question holding context", () => {
  test("no excerpt text, written or read, and no image bytes; statuses and lines kept", async () => {
    const core = await created(contextAsk(withMissing()));
    const item = fetched(core, "fix");
    expect(item.type === "question" && item.props.items).toEqual(EXPECTED_ITEMS);
    expect(JSON.stringify(item)).not.toContain(ONE_PIXEL_PNG);
    expect(JSON.stringify(item)).not.toContain("<script>");
  });

  test("the board document still holds the text and the bytes", async () => {
    const core = await created(contextAsk(withMissing()));
    fetched(core, "fix");
    const board = JSON.stringify(boardItemsOf(core, CONTEXT_ASK_ID));
    expect(board).toContain(ONE_PIXEL_PNG);
    expect(board).toContain(`text of ${ADR_POINTER}`);
    expect(board).toContain("<script>alert(1)</script>");
  });

  test("an area's questions lose them too", async () => {
    const [question] = contextAsk(withMissing()).items;
    if (question.type !== "question") throw new Error("contextAsk gives a question first");
    const ask: LifecycleAskInput = {
      askId: CONTEXT_ASK_ID,
      items: [{ type: "area", id: "payments", props: { title: "Payments", items: [question] } }],
    };
    const core = await created(ask);
    const area = fetched(core, "payments");
    const [inner] = area.type === "area" ? area.props.items : [];
    expect(inner?.props.items).toEqual(EXPECTED_ITEMS);
    expect(fetched(core, "fix")).toMatchObject({ props: { items: EXPECTED_ITEMS } });
  });

  test("a question without context is fetched as before", async () => {
    const core = await created(contextAsk([]));
    expect(fetched(core, "fix")).toEqual({
      type: "question",
      id: "fix",
      rev: 1,
      props: {
        text: "Which fix should I keep for the failing payment retry?",
        options: [{ label: "Fix A" }, { label: "Fix B" }],
      },
      state: "open",
    });
  });
});
