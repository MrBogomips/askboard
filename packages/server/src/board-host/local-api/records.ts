// The record table (design decision 4, AD-5): each `PreToolUse` hook's agent record, held until the
// call it describes binds it, and the owner keys ask-core holds, mapped to Claude Code's agent IDs.
// Only this table holds Claude Code identifiers; ask-core sees an opaque key, and agents see none.
// It also numbers the subagents of each type in the order of their first record, for the origin's
// ordinal (design decision 12).
//
// A call carrying a `tool_use_id` binds its record whatever its age, since `PreToolUse` runs before
// Claude Code's permission prompt (review fix, 2026-11-01); the record timeout limits only the
// next-call fallback. Unbound records are held for the hold time, at most the contract's bound of
// them, the oldest dropped first.

import {
  type AgentRecord,
  RECORD_HOLD_MS,
  RECORD_TIMEOUT_MS,
  RECORDS_HELD_MAX,
} from "@askboard/contract";
import type { AgentRecords, Binding, CallIdentity, Origin } from "@askboard/core";
import type { OriginOf } from "./origin.ts";

/** The main conversation's entry in the key map: an agent ID is never empty. */
const MAIN_CONVERSATION = "";

type Held = { readonly record: AgentRecord; readonly at: number };

export type RecordTableOptions = {
  /** Milliseconds, for the record timeout and the hold time. */
  readonly now: () => number;
  readonly originOf: OriginOf;
};

// The listed tool name a record's full name ends with: `mcp__plugin_askboard_askboard__ask` and
// `mcp__askboard__ask` both name `ask`.
const toolOf = (toolName: string): string => {
  const at = toolName.lastIndexOf("__");
  return at < 0 ? toolName : toolName.slice(at + 2);
};

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

// The origin with the subagent's number among those of its type, from the second on.
const withOrdinal = (origin: Origin, ordinal: number | undefined): Origin =>
  ordinal === undefined || ordinal < 2 ? origin : { ...origin, ordinal };

export class RecordTable implements AgentRecords {
  readonly #now: () => number;
  readonly #originOf: OriginOf;
  #held: Held[] = [];
  // Owner keys by agent ID, and back; a key is made when an agent's first record binds.
  readonly #keys = new Map<string, string>();
  readonly #agents = new Map<string, string>();
  // Each ask's origin, by owner key and ask ID, resolved at the first bound `ask` of that pair.
  readonly #origins = new Map<string, Promise<Origin>>();
  // Each subagent's number among the subagents of its type, and how many each type has.
  readonly #ordinals = new Map<string, number>();
  readonly #perType = new Map<string, number>();

  constructor(options: RecordTableOptions) {
    this.#now = options.now;
    this.#originOf = options.originOf;
  }

  /** Holds a hook's record until a call binds it, the hold time passes or newer ones push it out. */
  add(record: AgentRecord): void {
    this.#expire();
    this.#number(record);
    this.#held.push({ record, at: this.#now() });
    if (this.#held.length > RECORDS_HELD_MAX) {
      this.#held.splice(0, this.#held.length - RECORDS_HELD_MAX);
    }
  }

  /**
   * Binds the call to the held record with its `tool_use_id`, whatever its age, or, for a call
   * without one, to the oldest record of the same tool and ask IDs within the record timeout,
   * preferring one without a `tool_use_id`. A record binds once. An `ask`'s binding carries the
   * ask's origin.
   */
  async bind(call: CallIdentity): Promise<Binding | undefined> {
    this.#expire();
    const { toolUseId } = call;
    const index =
      toolUseId === undefined
        ? this.#fallback(call)
        : this.#held.findIndex(({ record }) => record.tool_use_id === toolUseId);
    if (index < 0) return undefined;
    // Taken before any wait, so that no other call binds it meanwhile.
    const [{ record }] = this.#held.splice(index, 1) as [Held];
    const ownerKey = this.#keyOf(record.agent_id);
    const [askId] = call.askIds;
    if (call.tool !== "ask" || askId === undefined) return { ownerKey };
    const cached = `${ownerKey}\n${askId}`;
    let origin = this.#origins.get(cached);
    if (origin === undefined) {
      const ordinal =
        record.agent_id === undefined ? undefined : this.#ordinals.get(record.agent_id);
      origin = this.#originOf(record).then((resolved) => withOrdinal(resolved, ordinal));
      this.#origins.set(cached, origin);
    }
    return { ownerKey, origin: await origin };
  }

  /** The agent ID behind an owner key; undefined for the main conversation or an unknown key. */
  agentIdOf(ownerKey: string): string | undefined {
    const agentId = this.#agents.get(ownerKey);
    return agentId === MAIN_CONVERSATION ? undefined : agentId;
  }

  /** Whether the owner key is the main conversation's (design decision 12). */
  isMainConversation(ownerKey: string): boolean {
    return this.#agents.get(ownerKey) === MAIN_CONVERSATION;
  }

  /** The owner key of an agent that has bound a record, without making one. */
  ownerKeyOf(agentId: string): string | undefined {
    return agentId === MAIN_CONVERSATION ? undefined : this.#keys.get(agentId);
  }

  // A subagent's first record gives it the next number of its type; the main conversation has none.
  #number({ agent_id, agent_type }: AgentRecord): void {
    if (agent_id === undefined || this.#ordinals.has(agent_id)) return;
    const type = agent_type?.trim() ?? "";
    const ordinal = (this.#perType.get(type) ?? 0) + 1;
    this.#perType.set(type, ordinal);
    this.#ordinals.set(agent_id, ordinal);
  }

  /**
   * The owner key of an agent that has bound a record, the main conversation's when the agent ID
   * is absent, without making one: a turn report names its agent this way (design decision 12).
   */
  keyOfAgent(agentId: string | undefined): string | undefined {
    return this.#keys.get(agentId ?? MAIN_CONVERSATION);
  }

  #keyOf(agentId: string | undefined): string {
    const agent = agentId ?? MAIN_CONVERSATION;
    let key = this.#keys.get(agent);
    if (key === undefined) {
      key = `owner-${this.#keys.size + 1}`;
      this.#keys.set(agent, key);
      this.#agents.set(key, agent);
    }
    return key;
  }

  // The next-call fallback: the oldest record of the call's tool and ask IDs within the record
  // timeout, one without a `tool_use_id` first, since a record with one waits for its own call.
  #fallback(call: CallIdentity): number {
    const oldest = this.#now() - RECORD_TIMEOUT_MS;
    const matches = ({ record, at }: Held) =>
      at >= oldest && toolOf(record.tool_name) === call.tool && sameIds(record.askIds, call.askIds);
    const without = this.#held.findIndex(
      (held) => matches(held) && held.record.tool_use_id === undefined,
    );
    return without >= 0 ? without : this.#held.findIndex(matches);
  }

  // Drops the records the hold time has passed.
  #expire(): void {
    const oldest = this.#now() - RECORD_HOLD_MS;
    if (this.#held.some(({ at }) => at < oldest)) {
      this.#held = this.#held.filter(({ at }) => at >= oldest);
    }
  }
}
