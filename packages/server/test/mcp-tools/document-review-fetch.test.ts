import { describe, expect, test } from "bun:test";
import {
  FETCH_PAGE_MAX_CHARS,
  type FetchItem,
  RESULT_MAX_CHARS,
  SCHEMA_IDS,
} from "@askboard/contract";
import {
  DOCUMENT_REVIEW_FIXTURE_ITEM,
  documentReviewFetchItemResult,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { canonicalize } from "@askboard/core";
import { connect, depsWith, fakeCore, textOf } from "./helpers.ts";

// MCP adapter spec, Fetch pages (document-review, task 3.1): a Document review whose answer holds
// 100 annotations with replacements of 4,000 code points was logged `tooLarge`, and `fetch` of the
// item returns the annotations as its `result`, in pages that join into the full value.

const A = documentReviewFetchItemResult.askId as string;
const emoji = "\u{1F600}";

const annotations = Array.from({ length: 100 }, (_, at) => ({
  id: `u-${at + 1}`,
  target: { selector: { type: "quote", exact: `passage ${at}` } },
  body: { text: `say "why" \\ ${at}`, replacement: `${emoji}r`.repeat(2_000) },
}));

const item = {
  ...(documentReviewFetchItemResult.item as object),
  ...DOCUMENT_REVIEW_FIXTURE_ITEM,
  questionId: "choose",
  state: "answered",
  result: { annotations },
} as unknown as FetchItem;

const holding = () =>
  fakeCore({
    fullValue: (askId, itemId) =>
      askId === A && itemId === DOCUMENT_REVIEW_FIXTURE_ITEM.id
        ? { kind: "item", askId, state: "partly-answered", item, generation: 4 }
        : { kind: "missing", askId, itemId },
  });

describe("a Document review's too-large answer fetched", () => {
  test("comes in pages, each within a page and a result, that join into the item with all its annotations", async () => {
    const canonical = canonicalize(item);
    expect(canonical.length).toBeGreaterThan(10 * FETCH_PAGE_MAX_CHARS);
    const { deps } = depsWith(holding());
    const { client, close } = await connect(deps);
    try {
      const parts: string[] = [];
      let continuation: string | undefined;
      do {
        const result = await client.callTool({
          name: "fetch",
          arguments: {
            askId: A,
            itemId: DOCUMENT_REVIEW_FIXTURE_ITEM.id,
            ...(continuation === undefined ? {} : { continuation }),
          },
        });
        expect(result.isError).toBeFalsy();
        const json = JSON.parse(textOf(result as never)) as Record<string, unknown>;
        expect(textOf(result as never).length).toBeLessThan(RESULT_MAX_CHARS);
        expect(validateAgainst(SCHEMA_IDS.fetchPage, json).ok).toBe(true);
        const part = json.part as string;
        expect(part.length).toBeLessThanOrEqual(FETCH_PAGE_MAX_CHARS);
        expect(part.isWellFormed()).toBe(true);
        parts.push(part);
        continuation = json.continuation as string | undefined;
      } while (continuation !== undefined && parts.length < 200);
      expect(parts.length).toBeGreaterThan(10);
      const joined = parts.join("");
      expect(joined).toBe(canonical);
      const back = JSON.parse(joined) as { result: { annotations: unknown[] } };
      expect(back.result.annotations).toEqual(annotations);
    } finally {
      await close();
    }
  });
});
