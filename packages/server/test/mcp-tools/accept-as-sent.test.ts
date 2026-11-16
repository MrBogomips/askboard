import { describe, expect, test } from "bun:test";
import { type FetchItem, type OutputEvent, SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import type { FullValue } from "@askboard/core";
import { connect, depsWith, EPOCH, fakeCore, jsonOf } from "./helpers.ts";

// MCP adapter spec, accept-as-sent (task 3.2): `collect` returns the answer event that carries
// `asSent`, and `fetch` the question's answer with it; both results validate against the tool
// envelopes. No source change beyond ask-core's: the adapter passes the event on as it is.

const ASK = "roadmap-review-t2v6";
const WHEN = "2026-11-16T09:30:00Z";

const event = {
  cursor: `${EPOCH}.1`,
  type: "answer",
  itemId: "plan",
  rev: 1,
  who: "Sara Conti",
  when: WHEN,
  asSent: true,
  note: "Va bene così.",
} as unknown as OutputEvent;

describe("collecting an answer accepted as sent", () => {
  test("returns the event with asSent, and the result validates", async () => {
    const core = fakeCore({
      read: (askId) => ({
        kind: "events",
        askId,
        state: "answered",
        cursor: `${EPOCH}.1`,
        events: [event],
      }),
    });
    const { client, close } = await connect(depsWith(core).deps);
    const result = await client.callTool({
      name: "collect",
      arguments: { asks: [{ askId: ASK, after: `${EPOCH}.0` }] },
    });
    await close();
    const json = jsonOf(result) as { asks: { events: Record<string, unknown>[] }[] };
    expect(json.asks[0]?.events).toEqual([event as unknown as Record<string, unknown>]);
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
  });
});

describe("fetching a question accepted as sent", () => {
  test("returns its answer with asSent, and the result validates", async () => {
    const item = {
      type: "question",
      id: "plan",
      rev: 1,
      props: { text: "Does the roadmap fit?" },
      state: "answered",
      answer: {
        cursor: `${EPOCH}.1`,
        asSent: true,
        note: "Va bene così.",
        who: "Sara Conti",
        when: WHEN,
      },
    } as unknown as FetchItem;
    const core = fakeCore({
      fullValue: (askId, itemId): FullValue => ({
        kind: "item",
        askId,
        state: "answered",
        item,
        generation: 1,
      }),
    });
    const { client, close } = await connect(depsWith(core).deps);
    const result = await client.callTool({
      name: "fetch",
      arguments: { askId: ASK, itemId: "plan" },
    });
    await close();
    const json = jsonOf(result) as { item: { answer: Record<string, unknown> } };
    expect(json.item.answer).toMatchObject({ asSent: true, who: "Sara Conti" });
    expect(validateAgainst(SCHEMA_IDS.fetchResult, json).ok).toBe(true);
  });
});
