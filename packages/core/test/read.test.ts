import { describe, expect, test } from "bun:test";
import { AskCore, type CoreEvent } from "../src/index.ts";
import { answer, coreWith, fakePorts, plainChoiceAsk } from "./fakes.ts";

// Core spec: One append-only event log per ask, Reading events after a cursor, Received watermark
// (task 4.3). The discard's notification is tested with the discard (task 4.5).

const ASK_ID = "order-db-choice-x7k2";
const answered = async () => {
  const fixture = coreWith({ git: "Paola Greco" });
  await fixture.core.ask(plainChoiceAsk());
  fixture.core.answer(ASK_ID, answer());
  return fixture;
};

describe("reading events after a cursor", () => {
  test("an answered ask read after <epoch>.0 holds its answer event at <epoch>.1", async () => {
    const { core } = await answered();
    const read = core.read(ASK_ID, `${core.epoch}.0`);
    expect(read).toEqual({
      kind: "events",
      askId: ASK_ID,
      state: "answered",
      cursor: `${core.epoch}.1`,
      events: [
        {
          cursor: `${core.epoch}.1`,
          type: "answer",
          itemId: "database",
          rev: 1,
          who: "Paola Greco",
          when: "2026-10-29T09:41:27Z",
          choice: ["PostgreSQL"],
        },
      ],
      groups: [1],
    });
  });

  test("after the latest cursor there is nothing new", async () => {
    const { core } = await answered();
    expect(core.read(ASK_ID, `${core.epoch}.1`)).toMatchObject({
      kind: "events",
      state: "answered",
      cursor: `${core.epoch}.1`,
      events: [],
    });
  });

  test("a waiting ask has no events and its first cursor", async () => {
    const { core } = coreWith();
    await core.ask(plainChoiceAsk());
    expect(core.read(ASK_ID, `${core.epoch}.0`)).toEqual({
      kind: "events",
      askId: ASK_ID,
      state: "waiting",
      cursor: `${core.epoch}.0`,
      events: [],
      groups: [],
    });
  });

  test("a cursor of another epoch reports the ask discarded, never as no answer yet", async () => {
    const { core } = await answered();
    const old = "q8w2zz11.1";
    expect(core.read(ASK_ID, old)).toEqual({ kind: "discarded", askId: ASK_ID, cursor: old });
    expect(core.read("asked-before-restart", old)).toEqual({
      kind: "discarded",
      askId: "asked-before-restart",
      cursor: old,
    });
  });

  test("an ask this epoch does not hold, with a cursor of this epoch, is unknown", async () => {
    const { core } = await answered();
    expect(core.read("never-asked", `${core.epoch}.0`)).toEqual({
      kind: "unknown",
      askId: "never-asked",
    });
  });

  test("a cursor this ask never issued, or not a cursor at all, is refused", async () => {
    const { core } = await answered();
    expect(core.read(ASK_ID, `${core.epoch}.5`)).toEqual({
      kind: "beyond",
      askId: ASK_ID,
      cursor: `${core.epoch}.5`,
      latest: `${core.epoch}.1`,
    });
    expect(core.read(ASK_ID, "latest")).toEqual({
      kind: "malformed",
      askId: ASK_ID,
      cursor: "latest",
    });
  });

  test("events are immutable: a reader cannot change the log", async () => {
    const { core } = await answered();
    const first = core.read(ASK_ID, `${core.epoch}.0`);
    const [event] = first.kind === "events" ? first.events : [];
    expect(Object.isFrozen(event)).toBe(true);
    expect(() => {
      (event as { who: string }).who = "someone else";
    }).toThrow();
  });
});

describe("the received watermark", () => {
  test("reading alone does not raise it", async () => {
    const { core } = await answered();
    core.read(ASK_ID, `${core.epoch}.0`);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
  });

  test("marking the answer read raises it, and the board is told", async () => {
    const { core, heard } = await answered();
    expect(core.markRead(ASK_ID, `${core.epoch}.1`)).toBe(true);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(true);
    expect(heard.at(-1)).toEqual({ type: "received", askId: ASK_ID, cursor: `${core.epoch}.1` });
  });

  test("an older cursor does not lower it, and the same one does not raise it again", async () => {
    const { core, heard } = await answered();
    core.markRead(ASK_ID, `${core.epoch}.1`);
    const count = heard.length;
    expect(core.markRead(ASK_ID, `${core.epoch}.0`)).toBe(false);
    expect(core.markRead(ASK_ID, `${core.epoch}.1`)).toBe(false);
    expect(heard).toHaveLength(count);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(true);
  });

  test("it never passes the latest event", async () => {
    const { core, heard } = await answered();
    expect(core.markRead(ASK_ID, `${core.epoch}.9`)).toBe(true);
    expect(heard.at(-1)).toEqual({ type: "received", askId: ASK_ID, cursor: `${core.epoch}.1` });
  });

  test("marking an ask this epoch does not hold, or a cursor of another epoch, is a bug", async () => {
    const { core } = await answered();
    expect(() => core.markRead("never-asked", `${core.epoch}.1`)).toThrow("never-asked");
    expect(() => core.markRead(ASK_ID, "q8w2zz11.1")).toThrow("q8w2zz11.1");
  });
});

describe("the subscription", () => {
  test("hears each appended event with its ask, in order", async () => {
    const { core, heard } = await answered();
    const event = expect.objectContaining({ cursor: `${core.epoch}.1`, type: "answer" });
    expect(heard).toEqual([{ type: "appended", askId: ASK_ID, event, events: [event] }]);
  });

  test("an unsubscribed listener hears nothing more", async () => {
    const core = new AskCore(fakePorts().ports);
    const heard: CoreEvent[] = [];
    const unsubscribe = core.subscribe((event) => heard.push(event));
    await core.ask(plainChoiceAsk());
    unsubscribe();
    core.answer(ASK_ID, answer());
    expect(heard).toEqual([]);
  });

  test("a listener that throws is reported, and the others still hear", async () => {
    const fakes = fakePorts();
    const core = new AskCore(fakes.ports);
    const failure = new Error("listener failed");
    const heard: CoreEvent[] = [];
    core.subscribe(() => {
      throw failure;
    });
    core.subscribe((event) => heard.push(event));
    await core.ask(plainChoiceAsk());
    expect(core.answer(ASK_ID, answer()).ok).toBe(true);
    expect(heard).toHaveLength(1);
    expect(fakes.reported).toEqual([failure]);
  });
});
