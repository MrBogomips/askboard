import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  FETCH_PAGE_MAX_CHARS,
  type FetchItem,
  type OutputEvent,
  SCHEMA_IDS,
} from "@askboard/contract";
import { uj2WidgetFetchResult, uj2WidgetTooLargeEvent } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { canonicalize, type FullValue } from "@askboard/core";
import { connect, depsWith, EPOCH, fakeCore, jsonOf, textOf } from "./helpers.ts";

// MCP adapter spec: Collecting widget answers, Fetching widget items and references (widget-answers
// task 3.2), against a fake core.

const approved = (await Bun.file(
  join(import.meta.dir, "../../../contract/test/fixtures/answers/uj2-wbs-gantt.json"),
).json()) as { asks: { askId: string; events: { cursor: string }[] }[] };
const ASK = approved.asks[0]?.askId ?? "";
// The approved events, on this session's epoch.
const approvedEvents = (approved.asks[0]?.events ?? []).map((event) => ({
  ...event,
  cursor: event.cursor.replace(/^[^.]+/, EPOCH),
})) as unknown as OutputEvent[];

const collectFrom = async (events: OutputEvent[], groups?: number[]) => {
  const core = fakeCore({
    read: (askId, after) => ({
      kind: "events",
      askId,
      state: "answered",
      cursor: `${EPOCH}.${events.length}`,
      events: events.slice(Number(after.split(".")[1])),
      ...(groups === undefined ? {} : { groups }),
    }),
  });
  const { client, close } = await connect(depsWith(core).deps);
  const result = await client.callTool({
    name: "collect",
    arguments: { asks: [{ askId: ASK, after: `${EPOCH}.0` }] },
  });
  await close();
  return { result, core };
};

describe("collecting widget answers", () => {
  test("a UJ-2 submit comes back as the approved answer and postponed events, unchanged", async () => {
    const { result, core } = await collectFrom(approvedEvents, [1, 1]);
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result) as { asks: { events: OutputEvent[]; cursor: string }[] };
    expect(json.asks[0]?.events).toEqual(approvedEvents);
    expect(json.asks[0]?.cursor).toBe(`${EPOCH}.2`);
    expect(JSON.stringify(json)).not.toContain('"values"');
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
    expect(core.calls).toContain(`markRead ${ASK} ${EPOCH}.2`);
  });

  test("a too-large event is collected with tooLarge and without changes or derived", async () => {
    const event = { ...uj2WidgetTooLargeEvent, cursor: `${EPOCH}.1` } as OutputEvent;
    const { result } = await collectFrom([event]);
    const json = jsonOf(result) as { asks: { events: Record<string, unknown>[] }[] };
    const [collected] = json.asks[0]?.events ?? [];
    expect(collected).toMatchObject({ tooLarge: true });
    expect("changes" in (collected ?? {})).toBe(false);
    expect("derived" in (collected ?? {})).toBe(false);
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
  });
});

const holding = (item: FetchItem, askId = ASK) =>
  fakeCore({
    fullValue: (id, itemId): FullValue =>
      id !== askId
        ? { kind: "discarded", askId: id }
        : itemId === item.id
          ? { kind: "item", askId, state: "answered", item, generation: 3 }
          : { kind: "missing", askId, itemId },
  });

const fetchWith = async (core: ReturnType<typeof fakeCore>, args: Record<string, unknown>) => {
  const { client, close } = await connect(depsWith(core).deps);
  const call = (more: Record<string, unknown> = {}) =>
    client.callTool({ name: "fetch", arguments: { askId: ASK, ...args, ...more } as never });
  return { call, close };
};

describe("fetching widget items and references", () => {
  test("a reference comes back as its item under its own ID, and validates", async () => {
    const { item } = uj2WidgetFetchResult;
    const { call, close } = await fetchWith(holding(item), { itemId: "wbs" });
    const result = await call();
    await close();
    const json = jsonOf(result) as { item: { id: string; type: string } };
    expect(json.item).toMatchObject({ type: "tree", id: "wbs" });
    expect(JSON.stringify(json)).not.toContain("wbs__tree");
    expect(validateAgainst(SCHEMA_IDS.fetchResult, json).ok).toBe(true);
  });

  test("an expanded ID is an error naming it", async () => {
    const { call, close } = await fetchWith(holding(uj2WidgetFetchResult.item), {
      itemId: "wbs__tree",
    });
    const result = await call();
    await close();
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('"wbs__tree"');
    expect(textOf(result)).toContain("by the ID you sent");
  });

  test("a too-large answer is fetched in pages whose joined text parses as the full answer", async () => {
    const values = Object.fromEntries(
      Array.from({ length: 400 }, (_, n) => [
        `node-${n}`,
        { label: `Work package ${n} `.repeat(20) },
      ]),
    );
    const question = {
      type: "question",
      id: "plan",
      rev: 1,
      props: { text: "Estimate?" },
      state: "answered",
      answer: { ...uj2WidgetTooLargeEvent, cursor: `${EPOCH}.1`, values, derived: { "a.b": 1 } },
    } as unknown as FetchItem;
    const { call, close } = await fetchWith(holding(question), { itemId: "plan" });
    const parts: string[] = [];
    let continuation: string | undefined;
    do {
      const result = await call(continuation === undefined ? {} : { continuation });
      expect(result.isError).toBeFalsy();
      const json = jsonOf(result) as { part?: string; continuation?: string };
      expect(json.part?.length ?? 0).toBeLessThanOrEqual(FETCH_PAGE_MAX_CHARS);
      parts.push(json.part ?? "");
      continuation = json.continuation;
    } while (continuation !== undefined && parts.length < 50);
    await close();
    expect(parts.length).toBeGreaterThan(1);
    const joined = parts.join("");
    expect(joined).toBe(canonicalize(question));
    expect(JSON.parse(joined).answer).toMatchObject({
      tooLarge: true,
      values,
      derived: { "a.b": 1 },
    });
  });
});

describe("fetching a layout", () => {
  // Layouts (layouts, design decision 5): a layout is fetched with every item inside it, so a large
  // Group pages like any item, and the pages join to its full value.
  test("a large Group is fetched in pages whose joined text is the full Group", async () => {
    const items = Array.from({ length: 300 }, (_, n) => ({
      type: "text-field",
      id: `field-${n}`,
      props: { label: `Field number ${n} `.repeat(10) },
    }));
    const group = {
      type: "group",
      id: "wide",
      questionId: "plan",
      props: { title: "Wide", items },
      state: "answered",
    } as unknown as FetchItem;
    const { call, close } = await fetchWith(holding(group), { itemId: "wide" });
    const parts: string[] = [];
    let continuation: string | undefined;
    do {
      const result = await call(continuation === undefined ? {} : { continuation });
      expect(result.isError).toBeFalsy();
      const json = jsonOf(result) as { part?: string; continuation?: string };
      expect(json.part?.length ?? 0).toBeLessThanOrEqual(FETCH_PAGE_MAX_CHARS);
      parts.push(json.part ?? "");
      continuation = json.continuation;
    } while (continuation !== undefined && parts.length < 50);
    await close();
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(canonicalize(group));
    expect(JSON.parse(parts.join("")).props.items).toHaveLength(300);
  });
});
