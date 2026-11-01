import { describe, expect, test } from "bun:test";
import {
  type CollectAskEntry,
  LOCAL_API_MAX_BYTES,
  LOCAL_API_VERSION,
  type OpenAsk,
  OUTPUT_FORMAT_VERSION,
} from "@askboard/contract";
import type { StopAsk } from "@askboard/core";
import {
  blockDecision,
  fitStop,
  OPEN_ASKS_MAX_BYTES,
} from "../../../src/board-host/local-api/stop-block.ts";

// Board-host spec, Stop decisions (review fix, task 13.5): the block holds the events above
// `received` in order up to the response limit, leaving room for the open asks, and cut only
// between board commands (AD-20, review fix M1); ask-core raises `received` only to the last event
// it carries. The cuts inside an ask, which E3's events make possible, are checked here on made-up
// entries.

const EPOCH = "q8w2zz11";

type Event = CollectAskEntry["events"][number];

const eventOf = (seq: number, size: number): Event =>
  ({
    cursor: `${EPOCH}.${seq}`,
    type: "answer",
    itemId: "database",
    rev: 1,
    who: "Paola Greco",
    when: "2026-10-29T09:41:27Z",
    choice: ["L".repeat(size)],
  }) as Event;

const askOf = (askId: string, events: readonly Event[]): CollectAskEntry => ({
  askId,
  state: "answered",
  cursor: events.at(-1)?.cursor ?? `${EPOCH}.0`,
  events: [...events],
});

// A candidate: each event its own command, unless groups are given.
const candidateOf = (entry: CollectAskEntry, groups?: readonly number[]): StopAsk => ({
  entry,
  groups: groups ?? entry.events.map((_, index) => index + 1),
});

const candidatesOf = (asks: readonly CollectAskEntry[], openAsks = openOf(asks)) => ({
  asks: asks.map((ask) => candidateOf(ask)),
  openAsks,
});

const openOf = (asks: readonly CollectAskEntry[]): OpenAsk[] =>
  asks.map(({ askId, state, cursor }) => ({ askId, state, cursor }));

const sizeOf = (block: Parameters<typeof blockDecision>[1]) =>
  Buffer.byteLength(JSON.stringify(blockDecision(EPOCH, block)), "utf8");

describe("the stop block's fit", () => {
  test("keeps a block that fits as it is", () => {
    const asks = [askOf("order-db-choice", [eventOf(1, 100)])];
    expect(fitStop(EPOCH)(candidatesOf(asks))).toEqual({ asks, openAsks: openOf(asks) });
  });

  test("cuts inside an ask at its last whole event, with that event's cursor", () => {
    const events = [eventOf(1, 400_000), eventOf(2, 400_000), eventOf(3, 400_000)];
    const asks = [askOf("order-db-choice", events), askOf("cache-choice", [eventOf(1, 10)])];
    const fitted = fitStop(EPOCH)(candidatesOf(asks));
    expect(fitted.asks).toEqual([
      { ...askOf("order-db-choice", events.slice(0, 2)), cursor: `${EPOCH}.2` },
    ]);
    expect(fitted.openAsks).toEqual(openOf(asks));
    expect(sizeOf(fitted)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
  });

  test("stops between asks when the next one's first event does not fit", () => {
    const asks = [
      askOf("order-db-choice", [eventOf(1, 600_000)]),
      askOf("cache-choice", [eventOf(1, 600_000)]),
    ];
    const fitted = fitStop(EPOCH)(candidatesOf(asks));
    expect(fitted.asks.map(({ askId }) => askId)).toEqual(["order-db-choice"]);
  });

  test("fills the response up to the limit, not beyond", () => {
    const asks = Array.from({ length: 80 }, (_, index) =>
      askOf(`ask-${index}`, [eventOf(1, 15_000)]),
    );
    const fitted = fitStop(EPOCH)(candidatesOf(asks));
    const size = sizeOf(fitted);
    expect(size).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
    // One more event would not have fitted.
    const next = asks[fitted.asks.length] as CollectAskEntry;
    expect(size + Buffer.byteLength(JSON.stringify(next)) + 1).toBeGreaterThan(LOCAL_API_MAX_BYTES);
  });

  test("gives the open asks at most half the response, so the first event always fits", () => {
    const openAsks: OpenAsk[] = Array.from({ length: 12_000 }, (_, index) => ({
      askId: `open-ask-with-a-long-id-${index}`,
      state: "waiting",
      cursor: `${EPOCH}.0`,
    }));
    const asks = [askOf("order-db-choice", [eventOf(1, 100_000)])];
    const fitted = fitStop(EPOCH)(candidatesOf(asks, openAsks));
    expect(fitted.asks).toEqual(asks);
    expect(fitted.openAsks.length).toBeLessThan(openAsks.length);
    expect(fitted.openAsks).toEqual(openAsks.slice(0, fitted.openAsks.length));
    expect(Buffer.byteLength(JSON.stringify(fitted.openAsks))).toBeLessThanOrEqual(
      OPEN_ASKS_MAX_BYTES,
    );
    expect(sizeOf(fitted)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
  });
});

describe("the stop block's fit, by board command (AD-20)", () => {
  test("leaves a command that straddles the limit whole for the next block", () => {
    const events = [eventOf(1, 400_000), eventOf(2, 400_000), eventOf(3, 400_000)];
    const ask = askOf("order-db-choice", events);
    const fitted = fitStop(EPOCH)({ asks: [candidateOf(ask, [1, 2, 2])], openAsks: openOf([ask]) });
    expect(fitted.asks).toEqual([{ ...askOf("order-db-choice", events.slice(0, 1)) }]);
    expect(sizeOf(fitted)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
  });

  test("stops before the next ask's first command when it does not fit whole", () => {
    const first = askOf("order-db-choice", [eventOf(1, 400_000)]);
    const second = askOf("cache-choice", [eventOf(1, 400_000), eventOf(2, 400_000)]);
    const fitted = fitStop(EPOCH)({
      asks: [candidateOf(first), candidateOf(second, [4, 4])],
      openAsks: openOf([first, second]),
    });
    expect(fitted.asks).toEqual([first]);
  });

  test("takes the first command whole when it fits, though larger than one event's share", () => {
    const events = [eventOf(1, 300_000), eventOf(2, 300_000), eventOf(3, 300_000)];
    const ask = askOf("order-db-choice", events);
    const fitted = fitStop(EPOCH)({ asks: [candidateOf(ask, [5, 5, 5])], openAsks: openOf([ask]) });
    expect(fitted.asks).toEqual([ask]);
    expect(sizeOf(fitted)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
  });

  // The hook drops a response over the limit and lets the stop through: the block then carries
  // none of the command, raising nothing, and its open asks tell the subagent to collect.
  test("carries the ask without events when even its first command passes the limit", () => {
    const events = [eventOf(4, 600_000), eventOf(5, 600_000)];
    const ask = askOf("order-db-choice", events);
    const fitted = fitStop(EPOCH)({ asks: [candidateOf(ask, [3, 3])], openAsks: openOf([ask]) });
    expect(fitted.asks).toEqual([{ ...ask, cursor: `${EPOCH}.3`, events: [] }]);
    expect(fitted.openAsks).toEqual(openOf([ask]));
    expect(sizeOf(fitted)).toBeLessThanOrEqual(LOCAL_API_MAX_BYTES);
  });
});

describe("the block's decision", () => {
  test("is the push message with the open asks, at the local API's and output's versions", () => {
    const asks = [askOf("order-db-choice", [eventOf(1, 10)])];
    expect(blockDecision(EPOCH, { asks, openAsks: openOf(asks) })).toEqual({
      version: LOCAL_API_VERSION,
      decision: "block",
      message: {
        versions: { output: OUTPUT_FORMAT_VERSION },
        epoch: EPOCH,
        asks,
        openAsks: openOf(asks),
      },
    });
  });
});
