import { describe, expect, test } from "bun:test";
import { type AgentRecord, LOCAL_API_VERSION } from "@askboard/contract";
import type { Origin } from "@askboard/core";
import type { OriginOf } from "../../../src/board-host/local-api/origin.ts";
import { RecordTable } from "../../../src/board-host/local-api/records.ts";

// The mod's teammate reports in the record table (task 18.2; board-host spec, Telling a teammate;
// design decision 4, Origin, plan B): per agent ID, whether the mod reported it a teammate, with its
// name, or not. A reported teammate's asks are "Teammate <name>", with no ordinal, and it is not
// counted among the subagents of its type; a report that lands while an origin resolves still
// labels it. A teammate stays one.

const TEAMMATE = "aresearcher-096d99adc3d94b0a";
const ASK_ID = "order-db-choice-x7k2";

const recordOf = (agentId: string, agentType: string, toolUseId: string): AgentRecord => ({
  version: LOCAL_API_VERSION,
  agent_id: agentId,
  agent_type: agentType,
  cwd: "/Users/paola/src/order-service",
  tool_use_id: toolUseId,
  tool_name: "mcp__plugin_askboard_askboard__ask",
  askIds: [ASK_ID],
  timestamp: "2026-11-03T09:40:31Z",
});

// The origin resolver's label, as origin.ts gives it for a subagent.
const subagentOrigin: OriginOf = async (record) => ({
  label: `Subagent ${record.agent_type}`,
  cwd: record.cwd,
});

const tableOf = (originOf: OriginOf = subagentOrigin) =>
  new RecordTable({ now: () => 1_000, originOf });

const originOf = async (table: RecordTable, toolUseId: string): Promise<Origin | undefined> =>
  (await table.bind({ tool: "ask", askIds: [ASK_ID], toolUseId }))?.origin;

describe("a teammate the mod reported", () => {
  test("before its first record: Teammate <name>, no ordinal, and not counted among its type", async () => {
    const table = tableOf();
    expect(table.reported(TEAMMATE, "researcher")).toBe("Teammate researcher");
    table.add(recordOf("a1", "researcher", "toolu_1"));
    table.add(recordOf(TEAMMATE, "researcher", "toolu_teammate"));
    table.add(recordOf("a2", "researcher", "toolu_2"));
    expect(await originOf(table, "toolu_teammate")).toEqual({
      label: "Teammate researcher",
      cwd: "/Users/paola/src/order-service",
    });
    expect((await originOf(table, "toolu_2"))?.ordinal).toBe(2);
  });

  test("after its first record: it gives its number back while no later subagent of its type took one", async () => {
    const table = tableOf();
    table.add(recordOf(TEAMMATE, "researcher", "toolu_teammate"));
    table.reported(TEAMMATE, "researcher");
    table.add(recordOf("a2", "researcher", "toolu_2"));
    table.add(recordOf("a3", "researcher", "toolu_3"));
    expect(await originOf(table, "toolu_teammate")).not.toHaveProperty("ordinal");
    expect(await originOf(table, "toolu_2")).not.toHaveProperty("ordinal");
    expect((await originOf(table, "toolu_3"))?.ordinal).toBe(2);
  });

  test("after a later subagent of its type was numbered: the later numbers stay", async () => {
    const table = tableOf();
    table.add(recordOf(TEAMMATE, "researcher", "toolu_teammate"));
    table.add(recordOf("a2", "researcher", "toolu_2"));
    table.reported(TEAMMATE, "researcher");
    table.add(recordOf("a3", "researcher", "toolu_3"));
    expect((await originOf(table, "toolu_2"))?.ordinal).toBe(2);
    expect((await originOf(table, "toolu_3"))?.ordinal).toBe(3);
    expect((await originOf(table, "toolu_teammate"))?.label).toBe("Teammate researcher");
  });

  test("while its origin resolves: the origin is labelled when it resolves", async () => {
    let resolve: (origin: Origin) => void = () => {};
    const pending = new Promise<Origin>((done) => {
      resolve = done;
    });
    const table = tableOf(() => pending);
    table.add(recordOf(TEAMMATE, "researcher", "toolu_teammate"));
    const bound = originOf(table, "toolu_teammate");
    table.reported(TEAMMATE, "researcher");
    resolve({ label: "Subagent researcher", cwd: "/Users/paola/src/order-service" });
    expect(await bound).toEqual({
      label: "Teammate researcher",
      cwd: "/Users/paola/src/order-service",
    });
  });
});

describe("what the table keeps of the reports", () => {
  test("nothing before a report, no teammate after one without a name, then the teammate, who stays one", () => {
    const table = tableOf();
    expect(table.reportOf(TEAMMATE)).toBeUndefined();
    expect(table.reported(TEAMMATE, undefined)).toBeUndefined();
    expect(table.reportOf(TEAMMATE)).toBeNull();
    expect(table.reported(TEAMMATE, "researcher")).toBe("Teammate researcher");
    expect(table.reportOf(TEAMMATE)).toBe("researcher");
    expect(table.reported(TEAMMATE, undefined)).toBeUndefined();
    expect(table.reported(TEAMMATE, "researcher")).toBeUndefined();
    expect(table.reportOf(TEAMMATE)).toBe("researcher");
    expect(table.reported(TEAMMATE, " scout-2 ")).toBe("Teammate scout-2");
    expect(table.reportOf(TEAMMATE)).toBe("scout-2");
  });

  test("a blank name names no teammate", () => {
    const table = tableOf();
    expect(table.reported(TEAMMATE, "  ")).toBeUndefined();
    expect(table.reportOf(TEAMMATE)).toBeNull();
  });
});
