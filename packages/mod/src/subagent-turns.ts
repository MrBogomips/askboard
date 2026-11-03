// A subagent's turn (AD-4, AD-10; mod spec, "An event is pushed once", "Delivery reports"; design
// decision 7, Turn tracking, review fix of 2026-11-01): its model requests are counted by
// `agentId`, as the main conversation's are, and the rule of carried.ts says which of its appended
// rows a request carried. An append to a subagent is reported only once a request carries it, and
// never when its turn completes first: its events then stay above `received`, and the stop guard
// carries them. The `turn.step` hook never waits for the report: it goes with the next poll.
//
// A turn starts at the subagent's `turn.start` or, where the engine raises none for a subagent's
// run, at its first event after the previous turn completed.

import { carriedFrom, isCarried } from "./carried.ts";
import type { Memory, SubagentTurn } from "./memory.ts";
import { merged, type PushedAsk } from "./push-message.ts";
import { queueReports } from "./reports.ts";

const freshTurn = (memory: Memory, agentId: string): SubagentTurn => {
  memory.subagentTurns += 1;
  const turn = { serial: memory.subagentTurns, steps: 0, appended: [] };
  memory.subagents.set(agentId, turn);
  return turn;
};

const turnOf = (memory: Memory, agentId: string): SubagentTurn =>
  memory.subagents.get(agentId) ?? freshTurn(memory, agentId);

/** The subagent's turn now, to tell, once an append resolves, whether that turn completed. */
export const subagentTurnAt = (memory: Memory, agentId: string): number =>
  turnOf(memory, agentId).serial;

/**
 * An append to the subagent resolved: the row waits for a request that carries it, unless the turn
 * it was made in has completed meanwhile.
 */
export const subagentAppended = (
  memory: Memory,
  agentId: string,
  serial: number,
  asks: readonly PushedAsk[],
): void => {
  const turn = memory.subagents.get(agentId);
  if (turn === undefined || turn.serial !== serial) return;
  const row = { asks, carriedFrom: carriedFrom(turn.steps) };
  memory.subagents.set(agentId, { ...turn, appended: [...turn.appended, row] });
};

/**
 * The subagent's run started: a new turn, with no request yet. Rows appended while it was idle, to
 * a turn record that made no request (an idle teammate's fallback append, decision 7), were in the
 * conversation before this turn started, so its first request carries them.
 */
export const subagentTurnStarted = (memory: Memory, agentId: string): void => {
  const idle = memory.subagents.get(agentId);
  const turn = freshTurn(memory, agentId);
  if (idle === undefined || idle.steps > 0 || idle.appended.length === 0) return;
  const rows = idle.appended.map((row) => ({ ...row, carriedFrom: 1 }));
  memory.subagents.set(agentId, { ...turn, appended: rows });
};

/** A model request of the subagent is about to go: what it carries is reported at the next poll. */
export const subagentStepped = (memory: Memory, agentId: string): void => {
  const turn = turnOf(memory, agentId);
  const steps = turn.steps + 1;
  const carried = turn.appended.filter((row) => isCarried(row, steps));
  const waiting = turn.appended.filter((row) => !isCarried(row, steps));
  memory.subagents.set(agentId, { ...turn, steps, appended: waiting });
  if (carried.length > 0)
    queueReports(memory, merged(carried.flatMap((row) => row.asks)), "append");
};

/** The subagent's turn completed: what no request carried is left to the stop guard, unreported. */
export const subagentTurnCompleted = (memory: Memory, agentId: string): void => {
  memory.subagents.delete(agentId);
};
