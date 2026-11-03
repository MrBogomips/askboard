import { describe, expect, test } from "bun:test";
import {
  type AgentRecord,
  LOCAL_API_VERSION,
  RECORD_HOLD_MS,
  RECORD_TIMEOUT_MS,
  RECORDS_HELD_MAX,
} from "@askboard/contract";
import { mainAgentRecord, subagentRecord } from "@askboard/contract/fixtures";
import type { Origin } from "@askboard/core";
import { RecordTable } from "../../../src/board-host/local-api/records.ts";

// The record table and the `AgentRecords` adapter (design decision 4; core spec, Binding a record
// to its call, Owner of an ask; tasks 4.4 and 13.4).

const ASK_ID = "order-db-choice-x7k2";

const recordOf = (fields: Partial<AgentRecord> = {}): AgentRecord => ({
  version: LOCAL_API_VERSION,
  cwd: "/Users/paola/src/order-service",
  tool_name: "mcp__plugin_askboard_askboard__ask",
  askIds: [ASK_ID],
  timestamp: "2026-10-29T09:40:31Z",
  ...fields,
});

const tableOf = () => {
  let now = 1_000;
  const resolved: AgentRecord[] = [];
  const table = new RecordTable({
    now: () => now,
    originOf: async (record) => {
      resolved.push(record);
      const label = record.agent_id === undefined ? "Main agent" : "Subagent";
      return { label, cwd: record.cwd, root: record.cwd };
    },
  });
  return {
    table,
    resolved,
    advance: (ms: number) => {
      now += ms;
    },
  };
};

const ask = (toolUseId?: string) => ({
  tool: "ask",
  askIds: [ASK_ID],
  ...(toolUseId === undefined ? {} : { toolUseId }),
});

describe("binding a call to its record", () => {
  test("a call binds the record with its tool_use_id, whatever other records exist", async () => {
    const { table } = tableOf();
    table.add(recordOf({ agent_id: "a1", tool_use_id: "toolu_older" }));
    table.add(recordOf({ tool_use_id: "toolu_main" }));
    const bound = await table.bind(ask("toolu_main"));
    expect(bound?.ownerKey).toBeDefined();
    expect(table.agentIdOf(bound?.ownerKey ?? "")).toBeUndefined();
  });

  test("a call that carries a tool_use_id binds no record of another one", async () => {
    const { table } = tableOf();
    table.add(recordOf({ tool_use_id: "toolu_other" }));
    expect(await table.bind(ask("toolu_main"))).toBeUndefined();
  });

  test("a call without one binds the oldest unbound record of the same tool and ask IDs", async () => {
    const { table } = tableOf();
    table.add(recordOf({ agent_id: "a1", tool_name: "mcp__askboard__collect" }));
    table.add(recordOf({ agent_id: "a2", askIds: ["cache-choice-b5n1"] }));
    table.add(recordOf({ agent_id: "a3" }));
    table.add(recordOf({ agent_id: "a4" }));
    const first = await table.bind(ask());
    const second = await table.bind(ask());
    expect(table.agentIdOf(first?.ownerKey ?? "")).toBe("a3");
    expect(table.agentIdOf(second?.ownerKey ?? "")).toBe("a4");
    expect(await table.bind(ask())).toBeUndefined();
  });

  test("a call without one prefers a record without one, then takes one that has it", async () => {
    const { table } = tableOf();
    table.add(recordOf({ agent_id: "a1", tool_use_id: "toolu_1" }));
    table.add(recordOf({ agent_id: "a2" }));
    const first = await table.bind(ask());
    const second = await table.bind(ask());
    expect(table.agentIdOf(first?.ownerKey ?? "")).toBe("a2");
    // The conformance suite's client sends no tool_use_id, while its hooks' records carry one.
    expect(table.agentIdOf(second?.ownerKey ?? "")).toBe("a1");
    expect(await table.bind(ask("toolu_1"))).toBeUndefined();
  });

  test("the ask IDs match in their order, and both tool name forms name the tool", async () => {
    const { table } = tableOf();
    const ids = ["retry-policy-q3m8", "retry-limit-w2n5"];
    table.add(recordOf({ tool_name: "mcp__askboard__collect", askIds: [...ids].reverse() }));
    table.add(recordOf({ agent_id: "a1", tool_name: "mcp__askboard__collect", askIds: ids }));
    const bound = await table.bind({ tool: "collect", askIds: ids });
    expect(table.agentIdOf(bound?.ownerKey ?? "")).toBe("a1");
    expect(bound).toEqual({ ownerKey: expect.any(String) });
  });

  test("a record binds once", async () => {
    const { table } = tableOf();
    table.add(recordOf({ tool_use_id: "toolu_main" }));
    expect(await table.bind(ask("toolu_main"))).toBeDefined();
    expect(await table.bind(ask("toolu_main"))).toBeUndefined();
    expect(await table.bind(ask())).toBeUndefined();
  });

  // Core spec, A slow permission prompt: `PreToolUse` runs before Claude Code's permission prompt.
  test("a call with its tool_use_id binds its record two minutes after it arrived", async () => {
    const { table, advance } = tableOf();
    table.add(recordOf({ agent_id: "a1", tool_use_id: "toolu_slow" }));
    advance(2 * 60 * 1000);
    const bound = await table.bind(ask("toolu_slow"));
    expect(table.agentIdOf(bound?.ownerKey ?? "")).toBe("a1");
    expect(bound?.origin).toEqual({ label: "Subagent", cwd: recordOf().cwd, root: recordOf().cwd });
  });

  // Core spec, A stale record.
  test("a call without one binds no record older than the record timeout", async () => {
    const { table, advance } = tableOf();
    table.add(recordOf({ agent_id: "a1" }));
    table.add(recordOf({ agent_id: "a2", tool_use_id: "toolu_2" }));
    advance(RECORD_TIMEOUT_MS + 1);
    expect(await table.bind(ask())).toBeUndefined();
    // The record with a tool_use_id is still there for its own call.
    expect(table.agentIdOf((await table.bind(ask("toolu_2")))?.ownerKey ?? "")).toBe("a2");
  });

  test("a call without one binds a record just at the record timeout", async () => {
    const { table, advance } = tableOf();
    table.add(recordOf({ agent_id: "a1" }));
    advance(RECORD_TIMEOUT_MS);
    expect(table.agentIdOf((await table.bind(ask()))?.ownerKey ?? "")).toBe("a1");
  });

  test("an unbound record is held for the hold time, then dropped", async () => {
    const { table, advance } = tableOf();
    table.add(recordOf({ tool_use_id: "toolu_kept" }));
    table.add(recordOf({ tool_use_id: "toolu_stale" }));
    advance(RECORD_HOLD_MS);
    expect(await table.bind(ask("toolu_kept"))).toBeDefined();
    advance(1);
    expect(await table.bind(ask("toolu_stale"))).toBeUndefined();
  });

  test("holds at most the contract's bound of records, dropping the oldest first", async () => {
    const { table, advance } = tableOf();
    table.add(recordOf({ tool_use_id: "toolu_oldest" }));
    table.add(recordOf({ tool_use_id: "toolu_second" }));
    for (let index = 0; index < RECORDS_HELD_MAX - 1; index += 1) {
      advance(1);
      table.add(recordOf({ tool_use_id: `toolu_${index}` }));
    }
    expect(await table.bind(ask("toolu_oldest"))).toBeUndefined();
    expect(await table.bind(ask("toolu_second"))).toBeDefined();
    expect(await table.bind(ask(`toolu_${RECORDS_HELD_MAX - 2}`))).toBeDefined();
  });
});

describe("owner keys", () => {
  test("one per agent, opaque, the main conversation's its own", async () => {
    const { table } = tableOf();
    table.add(mainAgentRecord);
    table.add(subagentRecord);
    table.add(recordOf({ ...subagentRecord, tool_use_id: "toolu_again" }));
    const main = await table.bind({
      tool: "ask",
      askIds: mainAgentRecord.askIds,
      toolUseId: mainAgentRecord.tool_use_id,
    });
    const sub = await table.bind({
      tool: "collect",
      askIds: subagentRecord.askIds,
      toolUseId: subagentRecord.tool_use_id,
    });
    const again = await table.bind({ tool: "ask", askIds: [ASK_ID], toolUseId: "toolu_again" });
    expect(main?.ownerKey).not.toBe(sub?.ownerKey);
    expect(again?.ownerKey).toBe(sub?.ownerKey);
    expect(sub?.ownerKey).not.toContain(subagentRecord.agent_id ?? "");
    expect(table.agentIdOf(sub?.ownerKey ?? "")).toBe(subagentRecord.agent_id);
    expect(table.agentIdOf(main?.ownerKey ?? "")).toBeUndefined();
    expect(table.agentIdOf("never-given")).toBeUndefined();
  });

  test("an agent's key is found by its agent ID only once the agent has bound a record", async () => {
    const { table } = tableOf();
    expect(table.ownerKeyOf("a1")).toBeUndefined();
    table.add(recordOf({ agent_id: "a1", tool_use_id: "toolu_1" }));
    expect(table.ownerKeyOf("a1")).toBeUndefined();
    const bound = await table.bind(ask("toolu_1"));
    expect(table.ownerKeyOf("a1")).toBe(bound?.ownerKey);
    expect(table.ownerKeyOf("a2")).toBeUndefined();
  });
});

describe("the key a turn report names (task 8.3)", () => {
  test("is the agent's key, or the main conversation's without an agent ID, once it bound a record", async () => {
    const { table } = tableOf();
    expect(table.keyOfAgent(undefined)).toBeUndefined();
    expect(table.keyOfAgent("a1")).toBeUndefined();
    table.add(recordOf({ tool_use_id: "toolu_main" }));
    table.add(recordOf({ agent_id: "a1", tool_use_id: "toolu_1" }));
    const main = await table.bind(ask("toolu_main"));
    const sub = await table.bind(ask("toolu_1"));
    expect(table.keyOfAgent(undefined)).toBe(main?.ownerKey);
    expect(table.keyOfAgent("a1")).toBe(sub?.ownerKey);
    expect(table.keyOfAgent("a2")).toBeUndefined();
  });
});

describe("the main conversation's key (task 8.6)", () => {
  test("is told apart from a subagent's and from a key the table never gave", async () => {
    const { table } = tableOf();
    table.add(recordOf({ tool_use_id: "toolu_main" }));
    table.add(recordOf({ agent_id: "a1", tool_use_id: "toolu_1" }));
    const main = await table.bind(ask("toolu_main"));
    const sub = await table.bind(ask("toolu_1"));
    expect(table.isMainConversation(main?.ownerKey ?? "")).toBe(true);
    expect(table.isMainConversation(sub?.ownerKey ?? "")).toBe(false);
    expect(table.isMainConversation("owner-99")).toBe(false);
  });
});

describe("the origin", () => {
  test("comes with an ask's binding only, resolved from its record", async () => {
    const { table, resolved } = tableOf();
    table.add(recordOf({ agent_id: "a1", tool_use_id: "toolu_ask" }));
    table.add(
      recordOf({
        agent_id: "a1",
        tool_name: "mcp__askboard__collect",
        tool_use_id: "toolu_collect",
      }),
    );
    const asked = await table.bind(ask("toolu_ask"));
    const collected = await table.bind({
      tool: "collect",
      askIds: [ASK_ID],
      toolUseId: "toolu_collect",
    });
    const origin: Origin = { label: "Subagent", cwd: recordOf().cwd, root: recordOf().cwd };
    expect(asked).toEqual({ ownerKey: expect.any(String), origin });
    expect(collected).toEqual({ ownerKey: asked?.ownerKey ?? "" });
    expect(resolved).toHaveLength(1);
  });

  test("is resolved once per ask and owner: a resend reuses it", async () => {
    const { table, resolved } = tableOf();
    table.add(recordOf({ tool_use_id: "toolu_1" }));
    table.add(recordOf({ tool_use_id: "toolu_2" }));
    table.add(recordOf({ tool_use_id: "toolu_3", askIds: ["cache-choice-b5n1"] }));
    await table.bind(ask("toolu_1"));
    await table.bind(ask("toolu_2"));
    await table.bind({ tool: "ask", askIds: ["cache-choice-b5n1"], toolUseId: "toolu_3" });
    expect(resolved.map((record) => record.tool_use_id)).toEqual(["toolu_1", "toolu_3"]);
  });
});

describe("the ordinal of a subagent (task 8.1, design decision 12)", () => {
  const subagent = (agentId: string, type: string, toolUseId: string, fields = {}) =>
    recordOf({ agent_id: agentId, agent_type: type, tool_use_id: toolUseId, ...fields });

  const ordinalOf = async (table: RecordTable, toolUseId: string) =>
    (await table.bind(ask(toolUseId)))?.origin?.ordinal;

  test("the second and third subagents of one type get #2 and #3; the first gets none", async () => {
    const { table } = tableOf();
    table.add(subagent("a1", "code-reviewer", "toolu_1"));
    table.add(subagent("a2", "code-reviewer", "toolu_2"));
    table.add(subagent("a3", "code-reviewer", "toolu_3"));
    expect(await ordinalOf(table, "toolu_3")).toBe(3);
    expect(await ordinalOf(table, "toolu_2")).toBe(2);
    expect(await ordinalOf(table, "toolu_1")).toBeUndefined();
  });

  test("subagents are numbered in the order of their first record, of any tool", async () => {
    const { table } = tableOf();
    table.add(subagent("a1", "code-reviewer", "toolu_1", { tool_name: "mcp__askboard__collect" }));
    table.add(subagent("a2", "code-reviewer", "toolu_2"));
    // The first's later record keeps its number.
    table.add(subagent("a1", "code-reviewer", "toolu_1b"));
    expect(await ordinalOf(table, "toolu_2")).toBe(2);
    expect(await ordinalOf(table, "toolu_1b")).toBeUndefined();
  });

  test("each type is numbered on its own, ignoring surrounding spaces", async () => {
    const { table } = tableOf();
    table.add(subagent("a1", "code-reviewer", "toolu_1"));
    table.add(subagent("b1", "Explore", "toolu_2"));
    table.add(subagent("a2", " code-reviewer ", "toolu_3"));
    expect(await ordinalOf(table, "toolu_2")).toBeUndefined();
    expect(await ordinalOf(table, "toolu_3")).toBe(2);
  });

  test("the main conversation never gets one", async () => {
    const { table } = tableOf();
    table.add(subagent("a1", "general-purpose", "toolu_1"));
    table.add(recordOf({ tool_use_id: "toolu_main" }));
    table.add(recordOf({ tool_use_id: "toolu_main_2", askIds: ["cache-choice-b5n1"] }));
    expect(await ordinalOf(table, "toolu_main")).toBeUndefined();
    const again = await table.bind({
      tool: "ask",
      askIds: ["cache-choice-b5n1"],
      toolUseId: "toolu_main_2",
    });
    expect(again?.origin).not.toHaveProperty("ordinal");
  });

  test("a record that expired unbound still counted its agent", async () => {
    const { table, advance } = tableOf();
    table.add(subagent("a1", "code-reviewer", "toolu_1"));
    advance(RECORD_HOLD_MS + 1);
    table.add(subagent("a2", "code-reviewer", "toolu_2"));
    expect(await ordinalOf(table, "toolu_2")).toBe(2);
  });
});
