import { describe, expect, test } from "bun:test";
import { FETCH_PAGE_MAX_CHARS, SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore, type SourceFiles } from "@askboard/core";
import { connect, depsWith, jsonOf, LINK, runtimeClock } from "./helpers.ts";

// MCP adapter spec: Unresolved pointers in ask and update results, Fetch omits excerpt text and
// image bytes (excerpts, task 4.1), over the real ask-core with a fake `SourceFiles` port.

const ASK_ID = "payment-retry-fix-q4m8";
const ADR = "docs/adr/0012-payment-retries.md#Decision";
const SHOT = ".askboard/media/shot.png";
const MISSING = ".askboard/media/missing.png";

// Bytes and text longer than a fetch page, so a fetch that kept them would come in pages.
const BYTES = "A".repeat(FETCH_PAGE_MAX_CHARS + 4);
const TEXT = "We retry a failed payment three times.\n".repeat(700);

// Every file of the project exists but the missing image.
const sources: SourceFiles = {
  resolveExcerpt: async () => ({
    status: "resolved",
    text: TEXT,
    mediaType: "text/markdown",
    lines: { start: 7, end: 706 },
  }),
  resolveImage: async (_, pointer) =>
    pointer === MISSING
      ? { status: "unresolved", reason: "not-found" }
      : { status: "resolved", mediaType: "image/png", bytes: BYTES },
  resolveReference: async () => ({ status: "resolved" }),
  sourceState: async () => ({ status: "available" }),
  readSource: async () => ({ status: "available", text: "" }),
  editorTarget: async () => undefined,
};

const session = async () => {
  const core = new AskCore({
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    showing: { check: async () => ({ showable: true }), open: () => undefined },
    address: { link: async () => LINK },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    report: () => undefined,
    clock: runtimeClock,
    sources,
    projectRoot: "/home/paola/orders",
  });
  const { client, close } = await connect(depsWith(core).deps);
  const call = async (name: string, args: unknown) =>
    jsonOf(await client.callTool({ name, arguments: args as never })) as Record<string, unknown>;
  return { call, close };
};

const question = (items: readonly unknown[]) => ({
  text: "Which fix should I keep for the failing payment retry?",
  options: [{ label: "Fix A" }, { label: "Fix B" }],
  items,
});

const askWith = (items: readonly unknown[]) => ({
  askId: ASK_ID,
  items: [{ type: "question", id: "fix", props: question(items) }],
});

const FIX_ITEMS = [
  { type: "excerpt", id: "retry-adr", props: { pointer: ADR } },
  { type: "excerpt", id: "note", props: { text: "retries: 3", title: "Settings" } },
  { type: "image", id: "shot", props: { pointer: SHOT, alt: "The retry log" } },
];

const ask = askWith(FIX_ITEMS);

const unresolvedImage = (itemId: string) => ({
  code: "unresolved-pointer",
  itemId,
  pointer: MISSING,
  reason: "not-found",
  message: expect.any(String),
});

describe("unresolved pointers over ask-core", () => {
  test("an ask with a missing image is created, and its result names it after no-hooks", async () => {
    const { call, close } = await session();
    const lost = { type: "image", id: "lost", props: { pointer: MISSING, alt: "Lost" } };
    const asked = await call("ask", askWith([...FIX_ITEMS, lost]));
    expect(asked.warnings).toEqual([
      { code: "no-hooks", message: expect.any(String) },
      unresolvedImage("lost"),
    ]);
    expect(validateAgainst(SCHEMA_IDS.askResult, asked).ok).toBe(true);
    await close();
  });

  test("an update that adds a missing image is applied, and its result names the image", async () => {
    const { call, close } = await session();
    await call("ask", ask);
    const image = { type: "image", id: "lost", props: { pointer: MISSING, alt: "Lost" } };
    const updated = await call("update", {
      askId: ASK_ID,
      actions: [{ action: "change", itemId: "fix", props: question([image]) }],
    });
    // Before toMatchObject, which in Bun 1.4.4 writes its asymmetric matchers into what it checks.
    expect(validateAgainst(SCHEMA_IDS.updateResult, updated).ok).toBe(true);
    expect(updated).toMatchObject({
      askId: ASK_ID,
      applied: [{ action: "change", itemId: "fix", rev: 2 }],
      warnings: [unresolvedImage("lost")],
    });
    await close();
  });
});

describe("fetch of a question with context", () => {
  test("no excerpt text and no image bytes, the status and line range kept, in one result", async () => {
    const { call, close } = await session();
    await call("ask", ask);
    const fetched = await call("fetch", { askId: ASK_ID, itemId: "fix" });
    expect(fetched).not.toHaveProperty("continuation");
    expect(validateAgainst(SCHEMA_IDS.fetchResult, fetched).ok).toBe(true);
    expect((fetched.item as { props: unknown }).props).toEqual(
      question([
        {
          type: "excerpt",
          id: "retry-adr",
          props: {
            pointer: ADR,
            status: "resolved",
            mediaType: "text/markdown",
            lines: { start: 7, end: 706 },
          },
        },
        { type: "excerpt", id: "note", props: { title: "Settings" } },
        {
          type: "image",
          id: "shot",
          props: {
            pointer: SHOT,
            alt: "The retry log",
            status: "resolved",
            mediaType: "image/png",
          },
        },
      ]),
    );
    const text = JSON.stringify(fetched);
    for (const held of [BYTES, "We retry", "retries: 3"]) expect(text).not.toContain(held);
    await close();
  });
});
