// Pushing a poll's events (AD-3, AD-4; mod spec, "Push only to the ask's owner", "Push to a
// subagent", "Waking an idle teammate", "Push to the main conversation", "An event is pushed once";
// design decision 7, Per poll and the idle in-process teammate). The poll lists only owned asks,
// each with its owner's agent ID or none for the main conversation, and only events above
// `received`. Each event goes once per epoch, and each agent gets at most one push message per
// poll, carrying every new event of its asks. A push to the main conversation is reported once its
// call succeeds; one appended to a subagent or a teammate only once a request of that agent carries
// it (subagent-turns.ts). An idle in-process teammate, which an append does not wake, gets the push
// as one message instead, reported once delivered; a message not delivered, as auto mode answers a
// mod's (finding D13), falls back to the append (G2).

import type { PollResponse } from "@askboard/contract";
import { appendPush, markPushed, sendPush, submitPush, unmarkPushed } from "./deliver.ts";
import { debug, debugOnce } from "./diagnostics.ts";
import type { Memory } from "./memory.ts";
import type { AgentInfo, AgentStatus, ModApi } from "./mod-api.ts";
import { eventKey, type PushedAsk } from "./push-message.ts";
import { reportDelivered } from "./reports.ts";
import { subagentAppended, subagentTurnAt } from "./subagent-turns.ts";
import { appendToMain, keepDropped } from "./turns.ts";

/** An agent in one of these states is not pushed to: a message would resume it (finding D1). */
const FINISHED: ReadonlySet<AgentStatus> = new Set(["completed", "failed", "killed"]);

/** A live agent and the asks it owns that have new events. */
type Owned = { readonly agent: AgentInfo; readonly asks: readonly PushedAsk[] };

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

/** The agents that may be pushed to: listed, and not finished. */
const liveAgents = async ($: ModApi): Promise<readonly AgentInfo[] | undefined> => {
  try {
    const agents = await $.agent.list();
    return agents.filter((agent) => !FINISHED.has(agent.status));
  } catch {
    debug($, "the agent list could not be read; no subagent is pushed to at this poll");
    return undefined;
  }
};

/**
 * The live agent an ask's `agent_id` names: the one listed with that ID, an in-process teammate's
 * included, since its hooks give the same ID the agent list does (the PO's probe, task 17.6).
 */
const ownerOf = (agents: readonly AgentInfo[], owner: string): AgentInfo | undefined =>
  agents.find((agent) => agent.id === owner);

/** The new events of the subagents' and teammates' asks, by the live agent that owns them. */
const byLiveAgent = (
  agents: readonly AgentInfo[],
  owners: readonly (readonly [string, readonly PushedAsk[]])[],
): Owned[] => {
  const byId = new Map<string, Owned>();
  for (const [owner, asks] of owners) {
    const agent = ownerOf(agents, owner);
    if (agent === undefined) continue;
    byId.set(agent.id, { agent, asks: [...(byId.get(agent.id)?.asks ?? []), ...asks] });
  }
  return [...byId.values()];
};

/** A teammate that waits for a message: an appended row would not start its turn. */
const isIdleTeammate = (agent: AgentInfo): boolean =>
  agent.teammateId !== undefined && agent.status === "idle";

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

/**
 * Wakes an idle in-process teammate with one message, reported as a submit that was not dropped
 * is. A message not delivered goes as an append instead: one call or the other pushes the events.
 */
const wakeTeammate = async (
  memory: Memory,
  $: ModApi,
  epoch: string,
  agentId: string,
  asks: readonly PushedAsk[],
): Promise<void> => {
  markPushed(memory, asks);
  if (await sendPush($, epoch, asks, agentId)) {
    if (memory.session?.epoch === epoch) await reportDelivered(memory, $, epoch, asks, "submit");
    return;
  }
  debugOnce(memory, $, "a message to an idle teammate was not delivered; its push is appended");
  await pushToSubagent(memory, $, epoch, agentId, asks);
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
  const live = await liveAgents($);
  if (live === undefined) return;
  for (const { agent, asks } of byLiveAgent(live, subagents)) {
    if (isIdleTeammate(agent)) await wakeTeammate(memory, $, poll.epoch, agent.id, asks);
    else await pushToSubagent(memory, $, poll.epoch, agent.id, asks);
  }
};
