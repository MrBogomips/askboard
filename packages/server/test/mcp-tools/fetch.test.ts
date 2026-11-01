import { describe, expect, test } from "bun:test";
import {
  FETCH_PAGE_MAX_CHARS,
  type FetchItem,
  RESULT_MAX_CHARS,
  RESULT_VERSIONS,
  SCHEMA_IDS,
} from "@askboard/contract";
import { lifecycleFetchPage, lifecycleFetchResult } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { canonicalize, type FullValue } from "@askboard/core";
import { connect, depsWith, EPOCH, fakeCore, jsonOf, textOf } from "./helpers.ts";

// MCP adapter spec: Fetching an item, Fetch pages, Closed and discarded asks in update and fetch
// (ask-lifecycle, task 4.3), against a fake core.

const A = lifecycleFetchResult.askId;
const { item } = lifecycleFetchResult;

type Held = { item: FetchItem; generation: number; state?: "partly-answered" | "closed" };

// A core holding one item, which the test may change between fetches.
const holding = (held: Held | FullValue) => {
  const core = fakeCore({
    fullValue: (askId, itemId) => {
      if ("kind" in held) return held;
      if (askId !== A) return { kind: "discarded", askId };
      if (itemId !== held.item.id) return { kind: "missing", askId, itemId };
      const { item, generation, state = "partly-answered" } = held;
      return { kind: "item", askId, state, item, generation };
    },
  });
  return core;
};

const fetcher = async (core: ReturnType<typeof fakeCore>) => {
  const { deps, written } = depsWith(core);
  const { client, close } = await connect(deps);
  const call = (args: unknown) => client.callTool({ name: "fetch", arguments: args as never });
  return { call, close, written };
};

// A question whose full value takes several pages: text that is escaped twice on the way out
// (quotes and backslashes), characters outside the BMP, and control characters.
const longQuestion = (): FetchItem => {
  const piece = 'say "hi" \\ ok 𝄞🎹 \u0001 é ';
  const description = piece.repeat(3_000);
  return {
    type: "question",
    id: "region",
    rev: 2,
    props: {
      text: "Which regions?",
      options: [
        { label: "EU", description },
        { label: "US", description: description.slice(0, 20_001) },
      ],
    },
    state: "open",
  };
};

// A continuation as `fetch` writes it, for this session's ask unless `at` says otherwise.
const continuationOf = (at: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ askId: A, epoch: EPOCH, ...at }), "utf8").toString("base64url");

const pagesOf = async (call: (args: unknown) => Promise<unknown>, itemId: string) => {
  const results: { text: string; json: Record<string, unknown> }[] = [];
  let continuation: string | undefined;
  do {
    const result = (await call({
      askId: A,
      itemId,
      ...(continuation ? { continuation } : {}),
    })) as { content: unknown; isError?: boolean };
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    const json = JSON.parse(text) as Record<string, unknown>;
    results.push({ text, json });
    continuation = json.continuation as string | undefined;
  } while (continuation !== undefined && results.length < 100);
  return results;
};

describe("fetching an item", () => {
  test("returns the item as ask-core holds it, unchecked, and reads or marks nothing", async () => {
    const core = holding({ item, generation: 3 });
    const { call, close } = await fetcher(core);
    const result = await call({ askId: A, itemId: item.id });
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({ ...lifecycleFetchResult, epoch: EPOCH });
    expect(validateAgainst(SCHEMA_IDS.fetchResult, json).ok).toBe(true);
    expect(core.calls).toEqual([`fullValue ${A} ${item.id}`]);
    await close();
  });

  test("a closed ask's item is fetched with the ask's state", async () => {
    const { call, close } = await fetcher(holding({ item, generation: 3, state: "closed" }));
    expect(jsonOf(await call({ askId: A, itemId: item.id }))).toMatchObject({
      state: "closed",
      item,
    });
    await close();
  });

  test("an item the ask never held is an error naming it", async () => {
    const { call, close } = await fetcher(holding({ item, generation: 3 }));
    const result = await call({ askId: A, itemId: "billing" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`the ask "${A}" has no item "billing"`);
    await close();
  });

  test("a deleted item is an error naming it and saying it was deleted", async () => {
    const core = holding({ kind: "deleted", askId: A, itemId: "analytics" });
    const { call, close } = await fetcher(core);
    const result = await call({ askId: A, itemId: "analytics" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('"analytics"');
    expect(textOf(result)).toContain("deleted");
    await close();
  });

  test("a discarded ask, or one this session does not hold, is a typed discarded result", async () => {
    const { call, close } = await fetcher(holding({ kind: "discarded", askId: A }));
    const result = await call({ askId: A, itemId: item.id });
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: EPOCH,
      askId: A,
      outcome: "discarded",
    });
    expect(validateAgainst(SCHEMA_IDS.fetchOutcome, json).ok).toBe(true);
    await close();
  });

  test("a request outside the envelope is refused before ask-core is asked", async () => {
    const core = holding({ item, generation: 3 });
    const { call, close } = await fetcher(core);
    const result = await call({ askId: A, itemId: item.id, continuation: "not base64url!" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toStartWith("The fetch request was refused");
    expect(textOf(result)).toContain("continuation");
    expect(core.calls).toEqual([]);
    await close();
  });
});

describe("fetch pages", () => {
  test("a long question comes in slices that join into its full value", async () => {
    const long = longQuestion();
    const canonical = canonicalize(long);
    expect(canonical.length).toBeGreaterThan(3 * FETCH_PAGE_MAX_CHARS);
    const core = holding({ item: long, generation: 5 });
    const { call, close } = await fetcher(core);
    const pages = await pagesOf(call, long.id);
    expect(pages.length).toBeGreaterThan(3);
    for (const [at, { text, json }] of pages.entries()) {
      expect(text.length).toBeLessThan(RESULT_MAX_CHARS);
      const part = json.part as string;
      expect(part.length).toBeGreaterThan(0);
      expect(part.length).toBeLessThanOrEqual(FETCH_PAGE_MAX_CHARS);
      // No page starts or ends inside a surrogate pair.
      expect(part.isWellFormed()).toBe(true);
      expect(json).toMatchObject({ versions: RESULT_VERSIONS, epoch: EPOCH, askId: A });
      expect(json.itemId).toBe(long.id);
      expect(json.unchecked).toBe(true);
      expect("continuation" in json).toBe(at < pages.length - 1);
      expect(validateAgainst(SCHEMA_IDS.fetchPage, json).ok).toBe(true);
    }
    const joined = pages.map(({ json }) => json.part as string).join("");
    expect(joined).toBe(canonical);
    expect(JSON.parse(joined)).toEqual(long);
    expect(core.calls.some((call) => call.startsWith("markRead") || call.startsWith("read"))).toBe(
      false,
    );
    await close();
  });

  test("the continuation is base64url of the ask, the epoch, the item, its rev, the generation and the offset", async () => {
    const long = longQuestion();
    const { call, close } = await fetcher(holding({ item: long, generation: 5 }));
    const [first] = await pagesOf(call, long.id).then((pages) => pages.slice(0, 1));
    const continuation = first?.json.continuation as string;
    const decoded = JSON.parse(Buffer.from(continuation, "base64url").toString("utf8"));
    expect(decoded).toEqual({
      askId: A,
      epoch: EPOCH,
      itemId: long.id,
      rev: 2,
      generation: 5,
      offset: String(first?.json.part).length,
    });
    // The fixture's continuation is written the same way.
    const fixture = JSON.parse(
      Buffer.from(lifecycleFetchPage.continuation as string, "base64url").toString("utf8"),
    );
    expect(Object.keys(fixture)).toEqual(Object.keys(decoded));
    await close();
  });

  test("a continuation for a value that changed since is refused, saying to fetch again", async () => {
    const held: Held = { item: longQuestion(), generation: 5 };
    const core = holding(held);
    const { call, close } = await fetcher(core);
    const first = jsonOf(await call({ askId: A, itemId: "region" })) as { continuation: string };
    held.generation = 6;
    const result = await call({ askId: A, itemId: "region", continuation: first.continuation });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("changed");
    expect(textOf(result)).toContain("fetch it again");
    await close();
  });

  test.each([
    ["another item's", { itemId: "payment", rev: 2, generation: 5, offset: 10 }],
    ["an offset past the value's end", { itemId: "region", rev: 2, generation: 5, offset: 9e6 }],
    ["a negative offset", { itemId: "region", rev: 2, generation: 5, offset: -1 }],
    ["another epoch's", { epoch: "older", itemId: "region", rev: 2, generation: 5, offset: 10 }],
    ["an ask-less", { askId: undefined, itemId: "region", rev: 2, generation: 5, offset: 10 }],
    ["a malformed", "not json"],
  ])("%s continuation is refused, saying to fetch again", async (_what, payload) => {
    const long = longQuestion();
    const { call, close } = await fetcher(holding({ item: long, generation: 5 }));
    const continuation =
      typeof payload === "string"
        ? Buffer.from(payload, "utf8").toString("base64url")
        : continuationOf(payload);
    const result = await call({ askId: A, itemId: "region", continuation });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("fetch it again");
    await close();
  });

  // Fail closed: ask B's item of the same ID, rev and generation is not the value ask A's
  // continuation was a page of.
  test("another ask's continuation for an item of the same ID, rev and generation is refused", async () => {
    const B = "another-ask-b7";
    const long = longQuestion();
    const core = fakeCore({
      fullValue: (askId, itemId) =>
        itemId === long.id
          ? { kind: "item", askId, state: "partly-answered", item: long, generation: 5 }
          : { kind: "missing", askId, itemId },
    });
    const { call, close } = await fetcher(core);
    const first = jsonOf(await call({ askId: A, itemId: long.id })) as { continuation: string };
    const result = await call({ askId: B, itemId: long.id, continuation: first.continuation });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("fetch it again");
    // The same continuation still pages ask A's item.
    const own = await call({ askId: A, itemId: long.id, continuation: first.continuation });
    expect(own.isError).toBeFalsy();
    await close();
  });

  test("an offset that splits a surrogate pair is refused", async () => {
    const long = longQuestion();
    const canonical = canonicalize(long);
    const inside = canonical.indexOf("𝄞") + 1;
    const { call, close } = await fetcher(holding({ item: long, generation: 5 }));
    const continuation = continuationOf({
      itemId: "region",
      rev: 2,
      generation: 5,
      offset: inside,
    });
    const result = await call({ askId: A, itemId: "region", continuation });
    expect(result.isError).toBe(true);
    await close();
  });

  test("a continuation for a value that fits one result is refused, saying to fetch again", async () => {
    const { call, close } = await fetcher(holding({ item, generation: 3 }));
    const continuation = continuationOf({ itemId: item.id, rev: 1, generation: 3, offset: 10 });
    const result = await call({ askId: A, itemId: item.id, continuation });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("fetch it again");
    await close();
  });
});
