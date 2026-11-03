import { describe, expect, test } from "bun:test";
import { answer, plainChoiceAsk } from "./fakes.ts";
import { callOf, MAIN_ORIGIN, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// Core spec: Only the owner acts on an owned ask, Re-sending comes from the owner (task 3.2).
// `collect` reads through `read` with the call's binding; its isError text is mcp-tools'.

const ASK_ID = "order-db-choice-x7k2";

// An ask owned by "reviewer-1", answered, and a binding for each of two agents' collects.
const ownedAndAnswered = async () => {
  const fixture = pushCoreWith({ git: "Paola Greco" });
  const { core, table } = fixture;
  table.add({ ownerKey: "reviewer-1", tool: "ask", askIds: [ASK_ID], origin: REVIEWER_ORIGIN });
  await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
  core.answer(ASK_ID, answer());
  table.add({ ownerKey: "reviewer-1", tool: "collect", askIds: [ASK_ID] });
  const owner = await core.bind(callOf("collect", ASK_ID));
  table.add({ ownerKey: "reviewer-2", tool: "collect", askIds: [ASK_ID] });
  const other = await core.bind(callOf("collect", ASK_ID));
  return { ...fixture, owner, other };
};

describe("only the owner reads an owned ask", () => {
  test("the owner's collect reads the events", async () => {
    const { core, owner } = await ownedAndAnswered();
    expect(core.read(ASK_ID, `${core.epoch}.0`, owner)).toMatchObject({
      kind: "events",
      state: "answered",
      cursor: `${core.epoch}.1`,
      events: [expect.objectContaining({ type: "answer" })],
    });
  });

  test("another agent's collect is refused, naming the ask, and reveals nothing of it", async () => {
    const { core, other } = await ownedAndAnswered();
    expect(other).toEqual({ ownerKey: "reviewer-2" });
    expect(core.read(ASK_ID, `${core.epoch}.0`, other)).toEqual({
      kind: "other-owner",
      askId: ASK_ID,
    });
    expect(core.read(ASK_ID, `${core.epoch}.7`, other)).toEqual({
      kind: "other-owner",
      askId: ASK_ID,
    });
  });

  test("a collect that carried no record is refused as such, so it may be retried", async () => {
    const { core, table } = await ownedAndAnswered();
    const unbound = await core.bind(callOf("collect", ASK_ID, "toolu_lost"));
    expect(unbound).toBeUndefined();
    expect(core.read(ASK_ID, `${core.epoch}.0`, unbound)).toEqual({
      kind: "no-record",
      askId: ASK_ID,
    });
    expect(core.read(ASK_ID, `${core.epoch}.0`)).toEqual({ kind: "no-record", askId: ASK_ID });
    table.add({ ownerKey: "reviewer-1", tool: "collect", askIds: [ASK_ID] });
    const retried = await core.bind(callOf("collect", ASK_ID));
    expect(core.read(ASK_ID, `${core.epoch}.0`, retried).kind).toBe("events");
  });

  test("a refusal leaves received where it was, and the board is told nothing", async () => {
    const { core, heard, other } = await ownedAndAnswered();
    const before = heard.length;
    core.read(ASK_ID, `${core.epoch}.0`, other);
    core.read(ASK_ID, `${core.epoch}.0`);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
    expect(heard).toHaveLength(before);
  });

  test("a cursor of another epoch still reports the ask discarded, to any caller", async () => {
    const { core, other } = await ownedAndAnswered();
    expect(core.read(ASK_ID, "q8w2zz11.1", other)).toEqual({
      kind: "discarded",
      askId: ASK_ID,
      cursor: "q8w2zz11.1",
    });
  });
});

describe("an unchecked ask", () => {
  test("is read by any caller, bound or not", async () => {
    const { core, table } = pushCoreWith();
    await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    core.answer(ASK_ID, answer());
    table.add({ ownerKey: "reviewer-2", tool: "collect", askIds: [ASK_ID] });
    const someone = await core.bind(callOf("collect", ASK_ID));
    expect(someone).toBeDefined();
    expect(core.read(ASK_ID, `${core.epoch}.0`, someone).kind).toBe("events");
    expect(core.read(ASK_ID, `${core.epoch}.0`).kind).toBe("events");
  });
});

describe("re-sending comes from the owner", () => {
  const owned = async () => {
    const fixture = pushCoreWith();
    fixture.table.add({
      ownerKey: "reviewer-1",
      tool: "ask",
      askIds: [ASK_ID],
      origin: REVIEWER_ORIGIN,
    });
    await fixture.core.ask(plainChoiceAsk(), callOf("ask", ASK_ID));
    return fixture;
  };

  test("the owner's identical resend returns the board and opens nothing", async () => {
    const { core, table, opened } = await owned();
    table.add({ ownerKey: "reviewer-1", tool: "ask", askIds: [ASK_ID], origin: REVIEWER_ORIGIN });
    expect((await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID))).kind).toBe("resent");
    expect(opened).toHaveLength(1);
  });

  test("two subagents pick one ID: the second's identical ask is refused as another agent's", async () => {
    const { core, table } = await owned();
    table.add({ ownerKey: "reviewer-2", tool: "ask", askIds: [ASK_ID], origin: MAIN_ORIGIN });
    expect(await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID))).toEqual({
      kind: "other-owner",
      askId: ASK_ID,
    });
  });

  test("two subagents sending one ask at once: the first owns it, the second is refused", async () => {
    const { core, table } = pushCoreWith();
    table.add({ ownerKey: "reviewer-1", tool: "ask", askIds: [ASK_ID], toolUseId: "toolu_1" });
    table.add({ ownerKey: "reviewer-2", tool: "ask", askIds: [ASK_ID], toolUseId: "toolu_2" });
    const outcomes = await Promise.all([
      core.ask(plainChoiceAsk(), callOf("ask", ASK_ID, "toolu_1")),
      core.ask(plainChoiceAsk(), callOf("ask", ASK_ID, "toolu_2")),
    ]);
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(["created", "other-owner"]);
    expect(core.ownerOf(ASK_ID)?.ownerKey).toBe("reviewer-1");
  });

  test("an identical resend that carried no record is refused as such, not as in use", async () => {
    const { core } = await owned();
    expect(await core.ask(plainChoiceAsk(), callOf("ask", ASK_ID))).toEqual({
      kind: "no-record",
      askId: ASK_ID,
    });
    expect(await core.ask(plainChoiceAsk())).toEqual({ kind: "no-record", askId: ASK_ID });
  });

  test("a different request under an owned ID is in use, even from the owner", async () => {
    const { core, table } = await owned();
    table.add({ ownerKey: "reviewer-1", tool: "ask", askIds: [ASK_ID], origin: REVIEWER_ORIGIN });
    const request = { ...plainChoiceAsk(), title: "Another title" };
    expect(await core.ask(request, callOf("ask", ASK_ID))).toEqual({
      kind: "in-use",
      askId: ASK_ID,
    });
  });
});

// One owner check for every tool that acts on an ask: `read` applies it, and E3's `fetch` and E7's
// `snapshot` call it before they act.
describe("the owner check, on its own", () => {
  test("lets the owner through and refuses another agent or a call with no record", async () => {
    const { core, owner, other } = await ownedAndAnswered();
    expect(core.ownerRefusal(ASK_ID, owner)).toBeUndefined();
    expect(core.ownerRefusal(ASK_ID, other)).toBe("other-owner");
    expect(core.ownerRefusal(ASK_ID, undefined)).toBe("no-record");
    expect(core.ownerRefusal(ASK_ID)).toBe("no-record");
  });

  test("lets any caller act on an unchecked ask", async () => {
    const { core } = pushCoreWith({ git: "Paola Greco" });
    await core.ask(plainChoiceAsk());
    expect(core.ownerRefusal(ASK_ID)).toBeUndefined();
    expect(core.ownerRefusal(ASK_ID, { ownerKey: "reviewer-2" })).toBeUndefined();
  });
});
