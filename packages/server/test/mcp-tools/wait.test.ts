import { describe, expect, test } from "bun:test";
import {
  COLLECT_MAX_WAIT_MS,
  COLLECT_PROGRESS_INTERVAL_MS,
  type OutputEvent,
  SCHEMA_IDS,
} from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import type { ReadOutcome } from "@askboard/core";
import { waitForItem } from "../../src/mcp-tools/wait.ts";
import { connect, depsWith, EPOCH, fakeCore, jsonOf, manualTimers, textOf } from "./helpers.ts";

// MCP adapter spec: Waiting for an item (AD-4; task 5.4), on a clock the test moves.

const A = "order-db-choice-x7k2";
const B = "cache-choice-b5n1";
const answer: OutputEvent = {
  cursor: `${EPOCH}.1`,
  type: "answer",
  itemId: "database",
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-29T09:41:27Z",
  choice: ["PostgreSQL"],
};
const discarded: OutputEvent = { cursor: `${EPOCH}.1`, type: "discarded", reason: "session-exit" };

// A core whose log the test fills: each ask starts waiting with no event.
const liveCore = () => {
  const logs: Record<string, OutputEvent[]> = { [A]: [], [B]: [] };
  const states: Record<string, "waiting" | "answered" | "discarded"> = {
    [A]: "waiting",
    [B]: "waiting",
  };
  const read = (askId: string, after: string): ReadOutcome => {
    if (!after.startsWith(`${EPOCH}.`)) return { kind: "discarded", askId, cursor: after };
    const events = logs[askId] ?? [];
    return {
      kind: "events",
      askId,
      state: states[askId] ?? "waiting",
      cursor: `${EPOCH}.${events.length}`,
      events: events.slice(Number(after.split(".")[1])),
    };
  };
  const core = fakeCore({ read, states });
  const append = (askId: string, event: OutputEvent, state: "answered" | "discarded") => {
    logs[askId]?.push(event);
    states[askId] = state;
    core.emit({ type: "appended", askId, event });
  };
  return { core, append };
};

const request = (wait = { askId: A, itemId: "database" }) => ({
  asks: [
    { askId: A, after: `${EPOCH}.0` },
    { askId: B, after: `${EPOCH}.0` },
  ],
  wait,
});

const started = async (options: { progress?: number[]; signal?: AbortSignal } = {}) => {
  const live = liveCore();
  const clock = manualTimers();
  const { client, close } = await connect(depsWith(live.core, clock.timers).deps);
  const result = client.callTool(
    { name: "collect", arguments: request() },
    {
      ...(options.progress
        ? { onprogress: ({ progress }) => options.progress?.push(progress) }
        : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  await Bun.sleep(5);
  return { ...live, clock, result, close };
};

describe("collect with wait", () => {
  test("returns as soon as the log gains an event for the item", async () => {
    const { core, append, clock, result, close } = await started();
    expect(core.listeners.size).toBe(1);
    await clock.advance(5 * 60_000);
    append(A, answer, "answered");
    const json = jsonOf(await result) as { outcome?: string; asks: { events: OutputEvent[] }[] };
    expect(json.outcome).toBeUndefined();
    expect(json.asks[0]?.events).toEqual([answer]);
    expect(core.calls).toContain(`markRead ${A} ${EPOCH}.1`);
    expect(core.listeners.size).toBe(0);
    expect(clock.pending()).toBe(0);
    await close();
  });

  test("returns on an event that changes the ask's state", async () => {
    const { append, result, close } = await started();
    append(A, discarded, "discarded");
    const json = jsonOf(await result) as { asks: { state: string; events: OutputEvent[] }[] };
    expect(json.asks[0]).toMatchObject({ state: "discarded", events: [discarded] });
    await close();
  });

  test("keeps waiting through what is not for its item", async () => {
    const { core, append, clock, result, close } = await started();
    core.emit({ type: "received", askId: A, cursor: `${EPOCH}.0` });
    append(B, { ...answer }, "answered");
    await Bun.sleep(5);
    expect(core.listeners.size).toBe(1);
    expect(clock.pending()).toBeGreaterThan(0);
    append(A, answer, "answered");
    const json = jsonOf(await result) as { asks: { events: OutputEvent[] }[] };
    expect(json.asks.map((entry) => entry.events.length)).toEqual([1, 1]);
    await close();
  });

  test("sends progress at least every 60 s when given a progress token", async () => {
    const progress: number[] = [];
    const { append, clock, result, close } = await started({ progress });
    await clock.advance(COLLECT_PROGRESS_INTERVAL_MS);
    await clock.advance(COLLECT_PROGRESS_INTERVAL_MS);
    await Bun.sleep(5);
    expect(progress).toEqual([1, 2]);
    append(A, answer, "answered");
    await result;
    await close();
  });

  test("returns open after 20 minutes, having sent progress every 60 s", async () => {
    const progress: number[] = [];
    const { core, clock, result, close } = await started({ progress });
    await clock.advance(COLLECT_MAX_WAIT_MS);
    const json = jsonOf(await result);
    expect(json).toMatchObject({ outcome: "open", asks: [{ events: [] }, { events: [] }] });
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
    await Bun.sleep(5);
    expect(progress.length).toBe(COLLECT_MAX_WAIT_MS / COLLECT_PROGRESS_INTERVAL_MS - 1);
    expect(core.listeners.size).toBe(0);
    expect(clock.pending()).toBe(0);
    await close();
  });

  test("stops on abort, marking nothing read", async () => {
    const controller = new AbortController();
    const { core, clock, result, close } = await started({ signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toThrow();
    await Bun.sleep(5);
    expect(core.listeners.size).toBe(0);
    expect(clock.pending()).toBe(0);
    expect(core.calls.some((call) => call.startsWith("markRead"))).toBe(false);
    await close();
  });

  test("returns at once when an ask already has events after its cursor", async () => {
    const live = liveCore();
    live.append(B, { ...answer }, "answered");
    const { client, close } = await connect(depsWith(live.core).deps);
    const json = jsonOf(await client.callTool({ name: "collect", arguments: request() }));
    expect(json).toMatchObject({ asks: [{ events: [] }, { events: [answer] }] });
    expect(live.core.calls).not.toContain("subscribe");
    await close();
  });

  test("returns at once for an ask of an earlier epoch", async () => {
    const live = liveCore();
    const { client, close } = await connect(depsWith(live.core).deps);
    const args = {
      asks: [{ askId: A, after: "q8w2zz11.3" }],
      wait: { askId: A, itemId: "database" },
    };
    const json = jsonOf(await client.callTool({ name: "collect", arguments: args }));
    expect(json).toMatchObject({ asks: [{ state: "discarded", events: [] }] });
    await close();
  });

  test("a wait on an item the ask does not have is an error naming it", async () => {
    const live = liveCore();
    const { client, close } = await connect(depsWith(live.core).deps);
    const result = await client.callTool({
      name: "collect",
      arguments: request({ askId: A, itemId: "cache" }),
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`wait.itemId: the ask "${A}" has no item "cache"`);
    expect(live.core.calls).not.toContain("subscribe");
    await close();
  });
});

describe("waitForItem", () => {
  const wait = { askId: A, itemId: "database" };

  test("without a progress token, it schedules only the longest wait", async () => {
    const { core } = liveCore();
    const clock = manualTimers();
    const ended = waitForItem({ ...depsWith(core, clock.timers).deps }, wait, {
      signal: new AbortController().signal,
    });
    expect(clock.pending()).toBe(1);
    await clock.advance(COLLECT_MAX_WAIT_MS);
    expect(await ended).toBe("timeout");
  });

  test("an already aborted request ends at once", async () => {
    const { core } = liveCore();
    const controller = new AbortController();
    controller.abort();
    const ended = waitForItem(depsWith(core).deps, wait, { signal: controller.signal });
    expect(await ended).toBe("aborted");
    expect(core.listeners.size).toBe(0);
  });

  test("a progress notification that fails is written to diagnostics, and the wait goes on", async () => {
    const { core, append } = liveCore();
    const clock = manualTimers();
    const { deps, written } = depsWith(core, clock.timers);
    const ended = waitForItem(deps, wait, {
      signal: new AbortController().signal,
      progress: async () => {
        throw new TypeError("transport closed");
      },
    });
    await clock.advance(COLLECT_PROGRESS_INTERVAL_MS);
    expect(written).toEqual(["askboard: progress failed: TypeError"]);
    append(A, answer, "answered");
    expect(await ended).toBe("event");
  });
});
