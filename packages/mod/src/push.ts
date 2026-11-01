// Pushing a poll's events (AD-3, AD-4; mod spec, "Push only to the ask's owner", "Push to a
// subagent", "Push to the main conversation", "An event is pushed once"; design decision 7, Per
// poll). The poll lists only owned asks, each with its owner's agent ID or none for the main
// conversation, and only events above `received`. Each event goes once per epoch, and each agent
// gets at most one push message per poll, carrying every new event of its asks. A push to the main
// conversation is reported once its call succeeds; one to a subagent only once a request of the
// subagent carries it (subagent-turns.ts).

import type { PollResponse } from "@askboard/contract";
import { appendPush, markPushed, submitPush, unmarkPushed } from "./deliver.ts";
import { debug } from "./diagnostics.ts";
import type { Memory } from "./memory.ts";
import type { AgentStatus, ModApi } from "./mod-api.ts";
import { eventKey, type PushedAsk } from "./push-message.ts";
import { subagentAppended, subagentTurnAt } from "./subagent-turns.ts";
import { appendToMain, keepDropped } from "./turns.ts";

/** A subagent in one of these states is not pushed to: a message would resume it (finding D1). */
const FINISHED: ReadonlySet<AgentStatus> = new Set(["completed", "failed", "killed"]);

/** The poll's events not pushed yet in this epoch, by owner: `undefined` is the main conversation. */
const newEventsByOwner = (
  memory: Memory,
  poll: PollResponse,
): Map<string | undefined, PushedAsk[]> => {
  const byOwner = new Map<string | undefined, PushedAsk[]>();
  for (const ask of poll.asks) {
    const events = ask.events.filter(
      (event) => !memory.pushed.has(eventKey(ask.askId, event.cursor)),
    );
    if (events.length === 0) continue;
    const entry: PushedAsk = { askId: ask.askId, state: ask.state, cursor: ask.cursor, events };
    byOwner.set(ask.agent_id, [...(byOwner.get(ask.agent_id) ?? []), entry]);
  }
  return byOwner;
};

/** The subagents that may be pushed to: listed, and not finished. */
const runningAgents = async ($: ModApi): Promise<ReadonlySet<string> | undefined> => {
  try {
    const agents = await $.agent.list();
    return new Set(agents.filter((agent) => !FINISHED.has(agent.status)).map((agent) => agent.id));
  } catch {
    debug($, "the agent list could not be read; no subagent is pushed to at this poll");
    return undefined;
  }
};

/** Appends to a subagent; the report waits for a request of the subagent that carries the row. */
const pushToSubagent = async (
  memory: Memory,
  $: ModApi,
  epoch: string,
  agentId: string,
  asks: readonly PushedAsk[],
): Promise<void> => {
  const turn = subagentTurnAt(memory, agentId);
  markPushed(memory, asks);
  if (!(await appendPush($, epoch, asks, agentId))) {
    unmarkPushed(memory, epoch, asks);
    return;
  }
  if (memory.session?.epoch === epoch) subagentAppended(memory, agentId, turn, asks);
};

const pushToMain = async (
  memory: Memory,
  $: ModApi,
  epoch: string,
  asks: readonly PushedAsk[],
): Promise<void> => {
  if (memory.main.running) {
    await appendToMain(memory, $, epoch, asks);
    return;
  }
  markPushed(memory, asks);
  submitPush(memory, $, epoch, asks, {
    dropped: (dropped) => keepDropped(memory, dropped),
    failed: (failed) => unmarkPushed(memory, epoch, failed),
  });
};

/** Pushes what a poll lists that was not pushed yet, one push message per agent. */
export const pushPoll = async (memory: Memory, $: ModApi, poll: PollResponse): Promise<void> => {
  const byOwner = newEventsByOwner(memory, poll);
  const main = byOwner.get(undefined);
  if (main !== undefined) await pushToMain(memory, $, poll.epoch, main);
  const subagents = [...byOwner].filter(
    (owner): owner is [string, PushedAsk[]] => owner[0] !== undefined,
  );
  if (subagents.length === 0) return;
  const running = await runningAgents($);
  if (running === undefined) return;
  for (const [agentId, asks] of subagents) {
    if (running.has(agentId)) await pushToSubagent(memory, $, poll.epoch, agentId, asks);
  }
};
