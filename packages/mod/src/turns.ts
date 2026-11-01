// The main conversation's turn (AD-4; mod spec, "Push to the main conversation", "Catch-up when a
// main turn ends", "After the user interrupts a turn", "An event is pushed once"; design decision 7,
// Turn tracking): only events without `agentId`. While a main turn runs, a push is appended and read
// at the turn's next model request; when idle, it is submitted as a new turn. A row that no request
// of the turn carried, by the rule of carried.ts, is submitted again when the turn completes, all
// such rows in one submit, which wakes one turn. After an interruption Claude Code drops every
// submit until the user's next input (finding D6): a dropped push is appended when the next main
// turn starts, before its first request, so that turn's second request is the first to carry it,
// and it is submitted at that turn's end otherwise.
//
// The hooks never wait for a delivery report: one made at a turn's start goes with the next poll.

import { carriedFrom, isCarried } from "./carried.ts";
import { appendPush, markPushed, submitPush, unmarkPushed } from "./deliver.ts";
import type { Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";
import { merged, type PushedAsk } from "./push-message.ts";
import { queueReports, reportDelivered } from "./reports.ts";

/** Keeps pushes Claude Code dropped, or could not take, for the next main turn. */
export const keepDropped = (memory: Memory, asks: readonly PushedAsk[]): void => {
  memory.main = { ...memory.main, dropped: merged([...memory.main.dropped, ...asks]) };
};

/**
 * Submits again pushes no request carried, in one submit. What Claude Code drops, or what the call
 * fails to submit, waits for the next main turn: these events were taken from the poll already.
 */
const catchUp = (memory: Memory, $: ModApi, epoch: string, asks: readonly PushedAsk[]): void => {
  if (asks.length === 0) return;
  const keep = (kept: readonly PushedAsk[]) => keepDropped(memory, kept);
  submitPush(memory, $, epoch, asks, { dropped: keep, failed: keep });
};

/**
 * A row now stored in the main conversation joins the running turn, carried from the request after
 * the ones made so far. With no turn running, no request may carry it: it is submitted at once.
 */
const appended = (memory: Memory, $: ModApi, epoch: string, asks: readonly PushedAsk[]): void => {
  if (!memory.main.running) {
    catchUp(memory, $, epoch, asks);
    return;
  }
  const row = { asks, carriedFrom: carriedFrom(memory.main.steps) };
  memory.main = { ...memory.main, appended: [...memory.main.appended, row] };
};

/** Appends the dropped pushes when a main turn starts; their reports go with the next poll. */
const appendDropped = async (memory: Memory, $: ModApi): Promise<void> => {
  const { dropped } = memory.main;
  const epoch = memory.session?.epoch;
  if (dropped.length === 0 || epoch === undefined) return;
  memory.main = { ...memory.main, dropped: [] };
  if (!(await appendPush($, epoch, dropped))) {
    keepDropped(memory, dropped);
    return;
  }
  if (memory.session?.epoch !== epoch) return;
  appended(memory, $, epoch, dropped);
  queueReports(memory, dropped, "append");
};

/** A main turn started: it runs, with no request yet, and the dropped pushes join it. */
export const mainTurnStarted = async (memory: Memory, $: ModApi): Promise<void> => {
  memory.main = { ...memory.main, running: true, steps: 0, appended: [] };
  await appendDropped(memory, $);
};

/** A main turn's model request is about to go: it carries the rows its rule says. */
export const mainTurnStepped = (memory: Memory): void => {
  memory.main = { ...memory.main, steps: memory.main.steps + 1 };
};

/**
 * A main turn completed, answered or interrupted: one submit carries every appended push no
 * request carried, and every push still dropped.
 */
export const mainTurnCompleted = (memory: Memory, $: ModApi): void => {
  const { appended: rows, dropped, steps } = memory.main;
  memory.main = { ...memory.main, running: false, appended: [], dropped: [] };
  const epoch = memory.session?.epoch;
  if (epoch === undefined) return;
  const unread = rows.filter((row) => !isCarried(row, steps));
  catchUp(memory, $, epoch, merged([...dropped, ...unread.flatMap((row) => row.asks)]));
};

/** Appends a push to the running main turn, and reports it once stored (a poll's step). */
export const appendToMain = async (
  memory: Memory,
  $: ModApi,
  epoch: string,
  asks: readonly PushedAsk[],
): Promise<void> => {
  markPushed(memory, asks);
  if (!(await appendPush($, epoch, asks))) {
    unmarkPushed(memory, epoch, asks);
    return;
  }
  if (memory.session?.epoch !== epoch) return;
  appended(memory, $, epoch, asks);
  await reportDelivered(memory, $, epoch, asks, "append");
};
