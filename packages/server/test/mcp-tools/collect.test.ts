import { describe, expect, test } from "bun:test";
import {
  type OutputEvent,
  RESULT_MAX_CHARS,
  RESULT_VERSIONS,
  SCHEMA_IDS,
} from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import type { ReadOutcome } from "@askboard/core";
import { connect, depsWith, EPOCH, fakeCore, jsonOf, textOf } from "./helpers.ts";

// MCP adapter spec: Collecting events, A session without hooks, Result size (task 5.3).

const A = "order-db-choice-x7k2";
const B = "cache-choice-b5n1";
const C = "queue-choice-m3d8";

const answerEvent = (seq: number, choice: string[] = ["PostgreSQL"]): OutputEvent => ({
  cursor: `${EPOCH}.${seq}`,
  type: "answer",
  itemId: "database",
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-29T09:41:27Z",
  choice,
});

// A fake log per ask that honours cursors as ask-core does.
const logs =
  (byAsk: Record<string, OutputEvent[]>) =>
  (askId: string, after: string): ReadOutcome => {
    if (!after.startsWith(`${EPOCH}.`)) return { kind: "discarded", askId, cursor: after };
    const events = byAsk[askId];
    if (events === undefined) return { kind: "unknown", askId };
    const seq = Number(after.split(".")[1]);
    if (seq > events.length) {
      return { kind: "beyond", askId, cursor: after, latest: `${EPOCH}.${events.length}` };
    }
    return {
      kind: "events",
      askId,
      state: events.length > 0 ? "answered" : "waiting",
      cursor: `${EPOCH}.${events.length}`,
      events: events.slice(seq),
    };
  };

const collect = async (core: ReturnType<typeof fakeCore>, args: unknown) => {
  const { client, close } = await connect(depsWith(core).deps);
  const result = await client.callTool({ name: "collect", arguments: args as never });
  await close();
  return result;
};

describe("collecting events", () => {
  test("groups by ask in the request's order, every entry unchecked", async () => {
    const core = fakeCore({ read: logs({ [A]: [answerEvent(1)], [B]: [] }) });
    const result = await collect(core, {
      asks: [
        { askId: B, after: `${EPOCH}.0` },
        { askId: A, after: `${EPOCH}.0` },
      ],
    });
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: EPOCH,
      asks: [
        { askId: B, state: "waiting", cursor: `${EPOCH}.0`, events: [], unchecked: true },
        {
          askId: A,
          state: "answered",
          cursor: `${EPOCH}.1`,
          events: [answerEvent(1)],
          unchecked: true,
        },
      ],
    });
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
  });

  test("marks read what it returned, and nothing for an ask with nothing new", async () => {
    const core = fakeCore({ read: logs({ [A]: [answerEvent(1)], [B]: [] }) });
    await collect(core, {
      asks: [
        { askId: A, after: `${EPOCH}.0` },
        { askId: B, after: `${EPOCH}.0` },
      ],
    });
    expect(core.calls.filter((call) => call.startsWith("markRead"))).toEqual([
      `markRead ${A} ${EPOCH}.1`,
    ]);
  });

  test("a cursor of an earlier epoch reports that ask discarded, with no events", async () => {
    const core = fakeCore({ read: logs({ [A]: [answerEvent(1)] }) });
    const json = jsonOf(await collect(core, { asks: [{ askId: A, after: "q8w2zz11.1" }] }));
    expect(json).toMatchObject({
      asks: [{ askId: A, state: "discarded", cursor: "q8w2zz11.1", events: [], unchecked: true }],
    });
    expect(core.calls.some((call) => call.startsWith("markRead"))).toBe(false);
  });

  test("an ask this session does not hold, with a cursor of this epoch, is an error naming it", async () => {
    const core = fakeCore({ read: logs({ [A]: [answerEvent(1)] }) });
    const result = await collect(core, {
      asks: [
        { askId: A, after: `${EPOCH}.0` },
        { askId: "never-asked", after: `${EPOCH}.0` },
      ],
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      'asks[1].askId: the ask "never-asked" is not one of this session',
    );
    expect(core.calls.some((call) => call.startsWith("markRead"))).toBe(false);
  });

  test("a cursor this ask never issued is an error naming it", async () => {
    const core = fakeCore({ read: logs({ [A]: [answerEvent(1)] }) });
    const result = await collect(core, { asks: [{ askId: A, after: `${EPOCH}.7` }] });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`asks[0].after: the cursor "${EPOCH}.7"`);
    expect(textOf(result)).toContain(`${EPOCH}.1`);
  });

  test("a cursor ask-core cannot read is an error naming it", async () => {
    const core = fakeCore({
      read: (askId, after) => ({ kind: "malformed", askId, cursor: after }),
    });
    const result = await collect(core, { asks: [{ askId: A, after: `${EPOCH}.0` }] });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`asks[0].after: "${EPOCH}.0" is not a cursor`);
  });

  test("a request outside the envelope is refused before anything is read", async () => {
    const core = fakeCore();
    const result = await collect(core, { asks: [{ askId: A, after: "latest" }] });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toStartWith("The collect request was refused");
    expect(textOf(result)).toContain("asks[0].after must be the latest cursor");
    expect(core.calls.some((call) => call.startsWith("read"))).toBe(false);
  });
});

describe("result size", () => {
  const big = (seq: number, mark: string) => answerEvent(seq, [`${mark}${"x".repeat(12_000)}`]);
  const byAsk = { [A]: [big(1, "a")], [B]: [big(1, "b")], [C]: [big(1, "c")] };
  const all = (cursors: Record<string, string>) => ({
    asks: [A, B, C].map((askId) => ({ askId, after: cursors[askId] ?? `${EPOCH}.0` })),
  });

  test("returns the events that fit, in order, with more: true, and the rest after", async () => {
    const core = fakeCore({ read: logs(byAsk) });
    const first = await collect(core, all({}));
    const text = textOf(first);
    expect(text.length).toBeLessThan(RESULT_MAX_CHARS);
    const page = JSON.parse(text);
    expect(page.more).toBe(true);
    expect(page.asks.map((entry: { events: unknown[] }) => entry.events.length)).toEqual([1, 1, 0]);
    expect(page.asks.map((entry: { cursor: string }) => entry.cursor)).toEqual([
      `${EPOCH}.1`,
      `${EPOCH}.1`,
      `${EPOCH}.0`,
    ]);
    expect(validateAgainst(SCHEMA_IDS.collectResult, page).ok).toBe(true);
    expect(core.calls.filter((call) => call.startsWith("markRead"))).toEqual([
      `markRead ${A} ${EPOCH}.1`,
      `markRead ${B} ${EPOCH}.1`,
    ]);
    const cursors = Object.fromEntries(
      page.asks.map((entry: { askId: string; cursor: string }) => [entry.askId, entry.cursor]),
    );
    const rest = jsonOf(await collect(core, all(cursors))) as {
      more?: true;
      asks: { events: OutputEvent[] }[];
    };
    expect(rest.more).toBeUndefined();
    expect(rest.asks.flatMap((entry) => entry.events)).toEqual([big(1, "c")]);
  });

  test("an ask cut off keeps its place, with its cursor as passed", async () => {
    const core = fakeCore({
      read: logs({ [A]: [big(1, "a"), big(2, "d"), big(3, "e")], [B]: [big(1, "b")] }),
    });
    const page = jsonOf(
      await collect(core, {
        asks: [
          { askId: A, after: `${EPOCH}.0` },
          { askId: B, after: `${EPOCH}.0` },
        ],
      }),
    ) as { more: true; asks: { askId: string; cursor: string; events: unknown[] }[] };
    expect(page.more).toBe(true);
    expect(page.asks.map((entry) => [entry.askId, entry.cursor, entry.events.length])).toEqual([
      [A, `${EPOCH}.2`, 2],
      [B, `${EPOCH}.0`, 0],
    ]);
  });
});
