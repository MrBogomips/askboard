import { describe, expect, test } from "bun:test";
import { COLLECT_MAX_WAIT_MS, type OutputEvent } from "@askboard/contract";
import type { Binding, ReadOutcome } from "@askboard/core";
import { connect, depsWith, EPOCH, fakeCore, manualTimers } from "./helpers.ts";

// Core spec, Agent status of an ask (task 8.6, design decision 12): `mcp-tools` reports each
// waiting `collect`'s start and end on the waited ask, saying whether its owner is the main
// conversation, whose wait counts only until Claude Code's background threshold.

const ASK = "order-db-choice-x7k2";
const answer: OutputEvent = {
  cursor: `${EPOCH}.1`,
  type: "answer",
  itemId: "database",
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-29T09:41:27Z",
  choice: ["PostgreSQL"],
};

const MAIN: Binding = { ownerKey: "owner-1" };
const SUBAGENT: Binding = { ownerKey: "owner-2" };

// A core whose log the test fills, recording the waits it hears.
const waitingCore = (owner?: Binding) => {
  const log: OutputEvent[] = [];
  let state: "waiting" | "answered" = "waiting";
  const read = (askId: string, after: string): ReadOutcome => ({
    kind: "events",
    askId,
    state,
    cursor: `${EPOCH}.${log.length}`,
    events: log.slice(Number(after.split(".")[1])),
  });
  const core = fakeCore({
    read,
    ...(owner === undefined ? {} : { binding: owner, owners: { [ASK]: owner } }),
  });
  const waits: string[] = [];
  const recording = {
    ...core,
    waitStarted: (askId: string, mainConversation: boolean) => {
      waits.push(`start ${askId} ${mainConversation ? "main" : "not main"}`);
      return () => waits.push(`end ${askId}`);
    },
  };
  const appendAnswer = () => {
    log.push(answer);
    state = "answered";
    core.emit({ type: "appended", askId: ASK, event: answer, events: [answer] });
  };
  return { core: recording, waits, appendAnswer, log };
};

const waitingCollect = {
  asks: [{ askId: ASK, after: `${EPOCH}.0` }],
  wait: { askId: ASK, itemId: "database" },
};

const started = async (owner?: Binding, signal?: AbortSignal) => {
  const live = waitingCore(owner);
  const clock = manualTimers();
  const { deps } = depsWith(live.core, clock.timers);
  const { client, close } = await connect({
    ...deps,
    mainConversation: (ownerKey) => ownerKey === MAIN.ownerKey,
  });
  const result = client.callTool(
    { name: "collect", arguments: waitingCollect },
    signal === undefined ? {} : { signal },
  );
  await Bun.sleep(5);
  return { ...live, clock, result, close };
};

describe("a waiting collect's report", () => {
  test("on the main conversation's ask: its start, then its end when the answer returns", async () => {
    const run = await started(MAIN);
    expect(run.waits).toEqual([`start ${ASK} main`]);
    run.appendAnswer();
    await run.result;
    expect(run.waits).toEqual([`start ${ASK} main`, `end ${ASK}`]);
    await run.close();
  });

  test("on a subagent's ask, not the main conversation's", async () => {
    const run = await started(SUBAGENT);
    expect(run.waits).toEqual([`start ${ASK} not main`]);
    run.appendAnswer();
    await run.result;
    await run.close();
  });

  test("on an unchecked ask, whose owner AskBoard does not know, not the main conversation's", async () => {
    const run = await started();
    expect(run.waits).toEqual([`start ${ASK} not main`]);
    run.appendAnswer();
    await run.result;
    expect(run.waits).toHaveLength(2);
    await run.close();
  });

  test("ends when the longest wait passes", async () => {
    const run = await started(SUBAGENT);
    await run.clock.advance(COLLECT_MAX_WAIT_MS);
    await run.result;
    expect(run.waits).toEqual([`start ${ASK} not main`, `end ${ASK}`]);
    await run.close();
  });

  test("ends when the call is cancelled", async () => {
    const abort = new AbortController();
    const run = await started(SUBAGENT, abort.signal);
    abort.abort();
    await run.result.catch(() => undefined);
    for (let tries = 0; tries < 50 && run.waits.length < 2; tries += 1) await Bun.sleep(5);
    expect(run.waits).toEqual([`start ${ASK} not main`, `end ${ASK}`]);
    await run.close();
  });

  test("is not made by a collect that returns at once", async () => {
    const live = waitingCore(SUBAGENT);
    live.log.push(answer);
    const { deps } = depsWith(live.core);
    const { client, close } = await connect(deps);
    await client.callTool({ name: "collect", arguments: waitingCollect });
    expect(live.waits).toEqual([]);
    await close();
  });
});
