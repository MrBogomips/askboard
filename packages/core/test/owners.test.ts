import { describe, expect, test } from "bun:test";
import { RECORD_TIMEOUT_MS } from "@askboard/contract";
import { askWith, plainChoiceAsk } from "./fakes.ts";
import { callOf, MAIN_ORIGIN, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// Core spec: Owner of an ask, Binding a record to its call, Origin of an ask (task 3.1). The
// record table's rules are the local API's (task 4.4); here a fake table follows them, and the
// tests check what ask-core passes it and what ask-core keeps.

const ASK_ID = "order-db-choice-x7k2";

describe("binding a record to its call", () => {
  test("a call carrying its tool_use_id binds that record, whatever other records exist", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID], toolUseId: "toolu_01A" });
    table.add({
      ownerKey: "agent-2",
      tool: "ask",
      askIds: [ASK_ID],
      toolUseId: "toolu_01B",
      origin: REVIEWER_ORIGIN,
    });
    const outcome = await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID, "toolu_01B"));
    expect(outcome.kind).toBe("created");
    expect(table.calls).toEqual([{ tool: "ask", askIds: [ASK_ID], toolUseId: "toolu_01B" }]);
    expect(core.ownerOf(ASK_ID)).toEqual({ ownerKey: "agent-2", origin: REVIEWER_ORIGIN });
  });

  test("a call without one binds the oldest unbound record of its tool and ask IDs", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-0", tool: "collect", askIds: [ASK_ID] });
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: ["another-ask"] });
    table.add({ ownerKey: "agent-2", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    table.add({ ownerKey: "agent-3", tool: "ask", askIds: [ASK_ID], origin: REVIEWER_ORIGIN });
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    expect(core.ownerOf(ASK_ID)).toEqual({ ownerKey: "agent-2", origin: MAIN_ORIGIN });
  });

  test("a slow permission prompt: the call carrying the record's tool_use_id binds it two minutes later", async () => {
    const { core, table } = pushCoreWith();
    table.add({
      ownerKey: "agent-1",
      tool: "ask",
      askIds: [ASK_ID],
      toolUseId: "toolu_01A",
      origin: REVIEWER_ORIGIN,
    });
    table.advance(2 * 60 * 1000);
    const outcome = await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID, "toolu_01A"));
    expect(outcome.kind).toBe("created");
    expect(core.ownerOf(ASK_ID)).toEqual({ ownerKey: "agent-1", origin: REVIEWER_ORIGIN });
  });

  test("a stale record: a call without a tool_use_id after the record timeout binds nothing", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    table.advance(RECORD_TIMEOUT_MS + 1);
    const outcome = await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    expect(outcome.kind).toBe("created");
    expect(core.ownerOf(ASK_ID)).toBeUndefined();
  });

  test("a record binds once: a second call finds it taken", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-1", tool: "collect", askIds: [ASK_ID] });
    expect(await core.bind(callOf("collect", ASK_ID))).toEqual({ ownerKey: "agent-1" });
    expect(await core.bind(callOf("collect", ASK_ID))).toBeUndefined();
  });

  test("without the record table, a call binds nothing and asks are unchecked", async () => {
    const { core } = pushCoreWith({ noRecords: true });
    expect(await core.bind(callOf("collect", ASK_ID, "toolu_01A"))).toBeUndefined();
    expect((await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID, "toolu_01A"))).kind).toBe(
      "created",
    );
    expect(core.ownerOf(ASK_ID)).toBeUndefined();
  });

  test("a table that fails is reported, and the call counts as carrying no record", async () => {
    const fixture = pushCoreWith();
    const failure = new Error("record table failed");
    Object.assign(fixture.table.port, {
      bind: async () => {
        throw failure;
      },
    });
    expect(await fixture.core.bind(callOf("collect", ASK_ID))).toBeUndefined();
    expect((await fixture.core.ask(plainChoiceAsk(), callOf("ask", ASK_ID))).kind).toBe("created");
    expect(fixture.core.ownerOf(ASK_ID)).toBeUndefined();
    expect(fixture.reported).toEqual([failure, failure]);
  });

  test("an ask call binds its record even when its request is refused", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID], toolUseId: "toolu_01A" });
    const invalid = await core.ask({ askId: ASK_ID }, callOf("ask", ASK_ID, "toolu_01A"));
    expect(invalid.kind).toBe("invalid");
    expect(table.calls).toHaveLength(1);
    expect(await core.bind(callOf("ask", ASK_ID))).toBeUndefined();
  });
});

describe("the owner of an ask", () => {
  test("a subagent's bound ask is owned by its key, with its origin; no agent ID reaches the core", async () => {
    const { core, table } = pushCoreWith();
    table.add({
      ownerKey: "owner-7",
      tool: "ask",
      askIds: [ASK_ID],
      toolUseId: "toolu_01A",
      origin: REVIEWER_ORIGIN,
    });
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID, "toolu_01A"));
    expect(core.ownerOf(ASK_ID)).toEqual({ ownerKey: "owner-7", origin: REVIEWER_ORIGIN });
  });

  test("an ask with no bound record has no owner", async () => {
    const { core } = pushCoreWith();
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID, "toolu_01A"));
    expect(core.ownerOf(ASK_ID)).toBeUndefined();
  });

  test("an ask sent with no call identity, as E1's callers send it, has no owner", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID] });
    await core.ask(plainChoiceAsk());
    expect(table.calls).toEqual([]);
    expect(core.ownerOf(ASK_ID)).toBeUndefined();
  });

  test("a later record of another agent leaves the owner and the origin unchanged", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    table.add({ ownerKey: "agent-2", tool: "ask", askIds: [ASK_ID], origin: REVIEWER_ORIGIN });
    expect(await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID))).toEqual({
      kind: "other-owner",
      askId: ASK_ID,
    });
    table.add({ ownerKey: "agent-2", tool: "ask", askIds: [ASK_ID], origin: REVIEWER_ORIGIN });
    await core.ask(askWith({ title: "Another title" }), callOf("ask", ASK_ID));
    expect(core.ownerOf(ASK_ID)).toEqual({ ownerKey: "agent-1", origin: MAIN_ORIGIN });
  });

  test("the owner's resend from another folder keeps the first origin", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    const moved = { ...MAIN_ORIGIN, cwd: "/home/paola/orders/services" };
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID], origin: moved });
    expect((await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID))).kind).toBe("resent");
    expect(core.ownerOf(ASK_ID)?.origin).toEqual(MAIN_ORIGIN);
  });

  test("an unchecked ask stays unchecked when a later resend carries a record", async () => {
    const { core, table } = pushCoreWith();
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    table.add({ ownerKey: "agent-1", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    expect((await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID))).kind).toBe("resent");
    expect(core.ownerOf(ASK_ID)).toBeUndefined();
  });

  test("an ask this epoch does not hold has no owner", () => {
    const { core } = pushCoreWith();
    expect(core.ownerOf("never-asked")).toBeUndefined();
  });
});
