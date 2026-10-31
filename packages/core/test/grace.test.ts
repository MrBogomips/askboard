import { describe, expect, test } from "bun:test";
import { GRACE_PERIOD_MS } from "@askboard/contract";
import { lifecycleDraftRecord } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { fakeClock } from "./fakes.ts";
import {
  answerAct,
  areasAsk,
  boardOf,
  command,
  created,
  FLAT_ID,
  flatAsk,
  LIFECYCLE_ID,
  logOf,
  WHEN,
} from "./lifecycle-fakes.ts";

// Core spec: Grace timer, Tombstone (ask-lifecycle, task 3.4; AD-21), with a fake Clock.

const withClock = async (ask = flatAsk()) => {
  const clock = fakeClock();
  const fixture = await created(ask, { clock });
  return { ...fixture, clock };
};

describe("the grace timer", () => {
  test("is 120 seconds, the contract's constant", () => {
    expect(GRACE_PERIOD_MS).toBe(120_000);
  });

  test("a reload reconnects within the period: the ask stays open, with its draft record", async () => {
    const { core, clock } = await withClock(areasAsk());
    core.connected(LIFECYCLE_ID);
    core.holdDraft(LIFECYCLE_ID, lifecycleDraftRecord);
    core.disconnected(LIFECYCLE_ID);
    expect(clock.pending).toBe(1);
    clock.advance(GRACE_PERIOD_MS - 1);
    core.connected(LIFECYCLE_ID);
    expect(clock.pending).toBe(0);
    clock.advance(GRACE_PERIOD_MS * 2);
    expect(boardOf(core, LIFECYCLE_ID).state).toBe("waiting");
    expect(core.draftToRestore(LIFECYCLE_ID)).toEqual(lifecycleDraftRecord);
  });

  test("the tab is closed: past the period a discarded event with board-closed is appended", async () => {
    const { core, clock, heard } = await withClock();
    core.connected(FLAT_ID);
    core.disconnected(FLAT_ID);
    clock.advance(GRACE_PERIOD_MS - 1);
    expect(heard).toEqual([]);
    clock.advance(1);
    const event = { cursor: `${core.epoch}.1`, type: "discarded", reason: "board-closed" } as const;
    expect(heard).toEqual([
      { type: "appended", askId: FLAT_ID, event, events: [event] },
      { type: "discarded", askId: FLAT_ID, reason: "board-closed" },
    ]);
    expect(validateAgainst("urn:askboard:output:discarded-event", event).ok).toBe(true);
    expect(core.lifecycleBoard(FLAT_ID)).toEqual({ askId: FLAT_ID, state: "discarded" });
  });

  test("a takeover: the new tab connects before the old one's close, and no timer starts", async () => {
    const { core, clock } = await withClock();
    core.connected(FLAT_ID);
    core.connected(FLAT_ID);
    core.disconnected(FLAT_ID);
    expect(clock.pending).toBe(0);
    core.disconnected(FLAT_ID);
    expect(clock.pending).toBe(1);
  });

  test("an ask never connected starts no timer, however long it waits", async () => {
    const { core, clock } = await withClock();
    core.disconnected(FLAT_ID);
    clock.advance(GRACE_PERIOD_MS * 10);
    expect(clock.pending).toBe(0);
    expect(boardOf(core, FLAT_ID).state).toBe("waiting");
  });

  test("a closed ask starts no timer, and closing cancels one that runs", async () => {
    const { core, clock } = await withClock();
    core.connected(FLAT_ID);
    core.disconnected(FLAT_ID);
    expect(clock.pending).toBe(1);
    core.close(FLAT_ID, "agent");
    expect(clock.pending).toBe(0);
    core.connected(FLAT_ID);
    core.disconnected(FLAT_ID);
    clock.advance(GRACE_PERIOD_MS * 2);
    expect(boardOf(core, FLAT_ID).state).toBe("closed");
  });

  test("a second disconnect starts no second timer", async () => {
    const { core, clock } = await withClock();
    core.connected(FLAT_ID);
    core.disconnected(FLAT_ID);
    core.disconnected(FLAT_ID);
    expect(clock.pending).toBe(1);
  });

  test("reports about an ask this epoch does not hold, or a discarded one, start nothing", async () => {
    const { core, clock } = await withClock();
    core.connected("never-asked");
    core.disconnected("never-asked");
    core.discardAll("session-exit");
    core.connected(FLAT_ID);
    core.disconnected(FLAT_ID);
    expect(clock.pending).toBe(0);
  });

  test("a session exit cancels a running timer", async () => {
    const { core, clock, heard } = await withClock();
    core.connected(FLAT_ID);
    core.disconnected(FLAT_ID);
    core.discardAll("session-exit");
    expect(clock.pending).toBe(0);
    heard.length = 0;
    clock.advance(GRACE_PERIOD_MS);
    expect(heard).toEqual([]);
  });
});

describe("the tombstone", () => {
  const discarded = async () => {
    const fixture = await withClock(areasAsk());
    const { core, clock } = fixture;
    core.connected(LIFECYCLE_ID);
    core.holdDraft(LIFECYCLE_ID, lifecycleDraftRecord);
    core.act(
      LIFECYCLE_ID,
      command([
        answerAct({ itemId: "region", choice: ["EU"] }),
        { type: "follow-up", itemId: "rollout", rev: 1, text: "Why?", when: WHEN },
      ]),
    );
    core.update({
      askId: LIFECYCLE_ID,
      actions: [
        {
          action: "reply",
          itemId: "rollout",
          followUp: `${core.epoch}.2`,
          text: "A flag lets us switch back.",
        },
      ],
    });
    core.disconnected(LIFECYCLE_ID);
    clock.advance(GRACE_PERIOD_MS);
    return fixture;
  };

  test("an answer logged before the discard is read, then the discarded event", async () => {
    const { core } = await discarded();
    const read = core.read(LIFECYCLE_ID, `${core.epoch}.0`);
    expect(read).toMatchObject({ kind: "events", state: "discarded", cursor: `${core.epoch}.3` });
    expect(read.kind === "events" && read.events.map((event) => event.type)).toEqual([
      "answer",
      "follow-up",
      "discarded",
    ]);
  });

  test("it drops the board documents, threads, draft record and full values", async () => {
    const { core } = await discarded();
    expect(core.lifecycleBoard(LIFECYCLE_ID)).toEqual({ askId: LIFECYCLE_ID, state: "discarded" });
    expect(core.board(LIFECYCLE_ID)).toMatchObject({ state: "discarded", questions: [] });
    expect(core.board(LIFECYCLE_ID)?.document.items).toEqual([] as never);
    expect(core.draftToRestore(LIFECYCLE_ID)).toBeUndefined();
    expect(core.holdDraft(LIFECYCLE_ID, lifecycleDraftRecord)).toBe(false);
    expect(core.fullValue(LIFECYCLE_ID, "region")).toEqual({
      kind: "discarded",
      askId: LIFECYCLE_ID,
    });
    const texts = JSON.stringify([core.board(LIFECYCLE_ID), core.lifecycleBoard(LIFECYCLE_ID)]);
    expect(texts).not.toContain("A flag lets us switch back.");
    expect(texts).not.toContain("Checkout redesign plan");
  });

  test("it keeps the ID in use, the epoch, the state and received", async () => {
    const { core } = await discarded();
    core.markRead(LIFECYCLE_ID, `${core.epoch}.1`);
    expect(await core.ask(areasAsk())).toEqual({ kind: "in-use", askId: LIFECYCLE_ID });
    expect(core.markRead(LIFECYCLE_ID, `${core.epoch}.3`)).toBe(true);
    expect(core.update({ askId: LIFECYCLE_ID, actions: [{ action: "close" }] })).toEqual({
      kind: "discarded",
      askId: LIFECYCLE_ID,
    });
    expect(core.act(LIFECYCLE_ID, command([answerAct({ itemId: "payment" })]))).toMatchObject({
      ok: false,
      refusal: "discarded",
    });
  });

  test("events are dropped once a read acknowledges them, by an after at or above them", async () => {
    const { core } = await discarded();
    expect(logOf(core, LIFECYCLE_ID)).toHaveLength(3);
    core.read(LIFECYCLE_ID, `${core.epoch}.2`);
    expect(logOf(core, LIFECYCLE_ID).map((event) => event.cursor)).toEqual([`${core.epoch}.3`]);
    expect(core.read(LIFECYCLE_ID, `${core.epoch}.3`)).toMatchObject({ events: [] });
    expect(logOf(core, LIFECYCLE_ID)).toEqual([]);
    expect(core.read(LIFECYCLE_ID, `${core.epoch}.4`)).toMatchObject({ kind: "beyond" });
  });

  test("events acknowledged before the discard are dropped with it", async () => {
    const { core, clock } = await withClock();
    core.connected(FLAT_ID);
    core.act(FLAT_ID, command([answerAct()]));
    core.read(FLAT_ID, `${core.epoch}.1`);
    core.disconnected(FLAT_ID);
    clock.advance(GRACE_PERIOD_MS);
    expect(logOf(core, FLAT_ID).map((event) => event.type)).toEqual(["discarded"]);
  });
});
