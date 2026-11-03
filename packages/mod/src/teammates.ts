// Which subagents are in-process teammates (design decision 4, Origin, plan B; mod spec, Turn
// reports). An in-process teammate's hook `agent_id` is opaque, but `$.agent.list()` lists it under
// that same ID with a `teammateId` and a `name`, so the mod looks a subagent up when its turn
// changes and names it a teammate in its turn reports. An agent the list told of is not looked up
// again; one the list does not hold, or a list that fails, is looked up at the agent's next change.

import { TEAMMATE_NAME_MAX_CHARS } from "@askboard/contract";
import { debugOnce } from "./diagnostics.ts";
import type { Memory } from "./memory.ts";
import type { AgentInfo, ModApi } from "./mod-api.ts";

// A listed teammate's name: its own, else its address's part before the last `@`, cut to the
// contract's bound.
const nameOf = ({ name, teammateId = "" }: AgentInfo): string => {
  const at = teammateId.lastIndexOf("@");
  const fromAddress = (at < 0 ? teammateId : teammateId.slice(0, at)).trim();
  const given = name?.trim() || fromAddress;
  return Array.from(given).slice(0, TEAMMATE_NAME_MAX_CHARS).join("");
};

/**
 * Looks the subagent up in the agent list, unless it was told of already: `memory.teammates` then
 * holds its teammate name, or null when the list gives it no `teammateId`. It never rejects.
 */
export const lookUpTeammate = async (memory: Memory, $: ModApi, agentId: string): Promise<void> => {
  if (memory.teammates.has(agentId)) return;
  let agents: readonly AgentInfo[];
  try {
    agents = await $.agent.list();
  } catch {
    debugOnce(memory, $, "the agent list could not be read; a turn report names no teammate");
    return;
  }
  const entry = agents.find((agent) => agent.id === agentId);
  if (entry === undefined) return;
  const name = entry.teammateId === undefined ? null : nameOf(entry);
  if (name !== "") memory.teammates.set(agentId, name);
};

/** The teammate name a subagent's turn reports carry, once the list named it one. */
export const teammateNameOf = (memory: Memory, agentId: string): string | undefined => {
  const name = memory.teammates.get(agentId);
  return typeof name === "string" ? name : undefined;
};
