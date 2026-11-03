// The mod's poll (design decision 2; AD-3, AD-5): for each owned ask with events above `received`,
// in the order the asks were created, its ID, its owner's agent ID (none for the main conversation),
// its state, its latest cursor and those events; then the pending asks (EXPERIENCE, Counting). An
// unchecked ask's events are never listed. A response that would pass the contract's limit stops
// before the first board command that does not fit whole (AD-20), with `more` and the continuation,
// at that command's first event, which the mod passes back.

import {
  LOCAL_API_MAX_BYTES,
  LOCAL_API_VERSION,
  type PendingAsk,
  type PollContinuation,
  type PolledAsk,
  type PolledEvent,
  type PollResponse,
} from "@askboard/contract";
import { type AskCore, type AskOverview, parseCursor } from "@askboard/core";

export type PollCore = Pick<AskCore, "epoch" | "overview">;

/** Claude Code's agent ID behind an owner key, from the record table. */
export type AgentIdOf = (ownerKey: string) => string | undefined;

/** Who asked, for an unchecked ask (design decision 12). */
export const UNCHECKED_LABEL = "Agent";

// The states in which an ask is no longer open: E3's `closed` joins E1's `discarded`.
const ENDED: ReadonlySet<string> = new Set(["closed", "discarded"]);

/**
 * The most of a response the pending asks may take, so that the events always have room: one line
 * per ask is far below it in any real session.
 */
export const PENDING_MAX_BYTES = LOCAL_API_MAX_BYTES / 2;

// Room for `more` and the continuation, whose ask ID and `seq` are short.
const CONTINUATION_BYTES = 256;

/** A value's size as JSON in UTF-8, as a response body carries it. */
export const jsonBytes = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), "utf8");

const pendingOf = (asks: readonly AskOverview[], agentIdOf: AgentIdOf): PendingAsk[] => {
  const pending: PendingAsk[] = [];
  let size = 0;
  for (const ask of asks) {
    if (ENDED.has(ask.state) || ask.openQuestions === 0) continue;
    const { owner } = ask;
    const agentId = owner === undefined ? undefined : agentIdOf(owner.ownerKey);
    const entry: PendingAsk = {
      askId: ask.askId,
      title: ask.title,
      label: owner?.origin?.label ?? UNCHECKED_LABEL,
      ...(ask.agentName === undefined ? {} : { agentName: ask.agentName }),
      openQuestions: ask.openQuestions,
      link: ask.link,
      ...(agentId === undefined ? {} : { agent_id: agentId }),
    };
    size += jsonBytes(entry) + 1;
    if (size > PENDING_MAX_BYTES) break;
    pending.push(entry);
  }
  return pending;
};

const seqOf = (event: PolledEvent): number => parseCursor(event.cursor)?.seq ?? 0;

/**
 * Events as the pages take them: one board command's events together, in order (AD-20). An event
 * without a group is its own command.
 */
export const commandsOf = <E>(events: readonly E[], groups: readonly number[]): E[][] => {
  const commands: E[][] = [];
  events.forEach((event, index) => {
    const last = commands.at(-1);
    const group = groups[index];
    if (last !== undefined && group !== undefined && groups[index - 1] === group) last.push(event);
    else commands.push([event]);
  });
  return commands;
};

// The asks the poll goes through: from the continuation's ask on, when this epoch holds it.
const from = (asks: readonly AskOverview[], continuation: PollContinuation | undefined) => {
  const at =
    continuation === undefined ? -1 : asks.findIndex((a) => a.askId === continuation.askId);
  return at < 0 ? { asks, seq: 0 } : { asks: asks.slice(at), seq: continuation?.seq ?? 0 };
};

/** One page of the poll, from the start or from a continuation a previous page gave. */
export const pollResponse = (
  core: PollCore,
  agentIdOf: AgentIdOf,
  continuation?: PollContinuation,
): PollResponse => {
  const all = core.overview();
  const response = {
    version: LOCAL_API_VERSION,
    epoch: core.epoch,
    asks: [] as PolledAsk[],
    pending: pendingOf(all, agentIdOf),
  };
  const limit = LOCAL_API_MAX_BYTES - CONTINUATION_BYTES;
  let size = jsonBytes(response);
  const start = from(all, continuation);
  for (const [index, ask] of start.asks.entries()) {
    if (ask.owner === undefined) continue;
    // A continuation names a command's first event; one inside a command resumes at its start.
    const firstSeq = index === 0 ? start.seq : 0;
    const commands = commandsOf(ask.unreceived, ask.groups).filter(
      (command) => seqOf(command.at(-1) as PolledEvent) >= firstSeq,
    );
    if (commands.length === 0) continue;
    const agentId = agentIdOf(ask.owner.ownerKey);
    const head = {
      askId: ask.askId,
      ...(agentId === undefined ? {} : { agent_id: agentId }),
      state: ask.state,
      cursor: ask.cursor,
    };
    const taken: PolledEvent[] = [];
    // The ask's entry, its comma and its empty list, then each event and its comma.
    let cost = jsonBytes({ ...head, events: [] }) + (response.asks.length > 0 ? 1 : 0);
    for (const command of commands) {
      const more = command.reduce(
        (sum, event, at) => sum + jsonBytes(event) + (taken.length + at > 0 ? 1 : 0),
        0,
      );
      // The first command of a page always goes whole, so a poll always makes progress.
      const first = response.asks.length === 0 && taken.length === 0;
      if (!first && size + cost + more > limit) {
        if (taken.length > 0) {
          const last = taken.at(-1) as PolledEvent;
          response.asks.push({ ...head, cursor: last.cursor, events: taken });
        }
        const next = command[0] as PolledEvent;
        return { ...response, more: true, continuation: { askId: ask.askId, seq: seqOf(next) } };
      }
      taken.push(...command);
      cost += more;
    }
    size += cost;
    response.asks.push({ ...head, events: taken });
  }
  return response;
};
