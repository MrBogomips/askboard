import { describe, expect, test } from "bun:test";
import { GRACE_PERIOD_MS } from "@askboard/contract";
import { validatePushMessage } from "@askboard/contract/validate";
import type { CoreEvent } from "../src/index.ts";
import { answer, askWith, plainChoiceAsk } from "./fakes.ts";
import { answerAct, command, FLAT_ID, flatAsk } from "./lifecycle-fakes.ts";
import { callOf, fakeReceipts, pushCoreWith, REVIEWER_ORIGIN } from "./push-fakes.ts";

// Core spec: Received watermark, as modified: raised by a reported push and by a stop block, each
// through the aggregate and the subscription's "received" event, so the receipt follows (task 3.3).

const ASK_ID = "order-db-choice-x7k2";
const OTHER_ID = "cache-choice-b5n1";

// Asks owned by `ownerKey`, created through the fake record table.
const askAs = async (
  fixture: ReturnType<typeof pushCoreWith>,
  ownerKey: string,
  askId: string = ASK_ID,
) => {
  fixture.table.add({ ownerKey, tool: "ask", askIds: [askId], origin: REVIEWER_ORIGIN });
  return fixture.core.ask(askWith({ askId }), callOf("ask", askId));
};

const ownedAndAnswered = async () => {
  const fixture = pushCoreWith({ git: "Paola Greco" });
  await askAs(fixture, "reviewer-1");
  fixture.core.answer(ASK_ID, answer());
  const receipts = fakeReceipts(fixture.core);
  return { ...fixture, receipts };
};

describe("a reported push", () => {
  test("raises received, and the board marks the answer delivered", async () => {
    const { core, heard, receipts } = await ownedAndAnswered();
    expect(core.delivered(ASK_ID, `${core.epoch}.1`)).toBe("raised");
    expect(heard.at(-1)).toEqual({ type: "received", askId: ASK_ID, cursor: `${core.epoch}.1` });
    expect(receipts).toEqual([`${ASK_ID} database`]);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(true);
  });

  test("reported again, or with an older cursor, changes nothing", async () => {
    const { core, heard } = await ownedAndAnswered();
    core.delivered(ASK_ID, `${core.epoch}.1`);
    const count = heard.length;
    expect(core.delivered(ASK_ID, `${core.epoch}.1`)).toBe("unchanged");
    expect(core.delivered(ASK_ID, `${core.epoch}.0`)).toBe("unchanged");
    expect(heard).toHaveLength(count);
  });

  test("a report no poll could have given is refused, and received does not move", async () => {
    const { core, heard } = await ownedAndAnswered();
    const count = heard.length;
    for (const [askId, cursor] of [
      [ASK_ID, `${core.epoch}.2`],
      [ASK_ID, "q8w2zz11.1"],
      [ASK_ID, "latest"],
      ["never-asked", `${core.epoch}.1`],
    ] as const) {
      expect(core.delivered(askId, cursor)).toBe("refused");
    }
    expect(heard).toHaveLength(count);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
  });

  test("a report on an unchecked ask, whose events no poll lists, is refused", async () => {
    const { core, heard } = pushCoreWith();
    await core.ask(plainChoiceAsk());
    core.answer(ASK_ID, answer());
    expect(core.delivered(ASK_ID, `${core.epoch}.1`)).toBe("refused");
    expect(heard.filter((event) => event.type === "received")).toEqual([]);
  });
});

describe("the stop guard", () => {
  test("blocks with the owner's events above received and its open asks, and raises received", async () => {
    const { core, heard, receipts } = await ownedAndAnswered();
    const decision = core.stop("reviewer-1", false);
    expect(decision).toEqual({
      decision: "block",
      asks: [
        {
          askId: ASK_ID,
          state: "answered",
          cursor: `${core.epoch}.1`,
          events: [expect.objectContaining({ cursor: `${core.epoch}.1`, type: "answer" })],
        },
      ],
      openAsks: [{ askId: ASK_ID, state: "answered", cursor: `${core.epoch}.1` }],
    });
    expect(heard.at(-1)).toEqual({ type: "received", askId: ASK_ID, cursor: `${core.epoch}.1` });
    expect(receipts).toEqual([`${ASK_ID} database`]);
  });

  test("its block makes a push message valid against the contract", async () => {
    const { core } = await ownedAndAnswered();
    const decision = core.stop("reviewer-1", false);
    if (decision.decision !== "block") throw new Error("expected a block");
    const message = {
      versions: { output: "1.0" },
      epoch: core.epoch,
      asks: decision.asks,
      openAsks: decision.openAsks,
    };
    expect(validatePushMessage(message)).toMatchObject({ ok: true });
  });

  test("blocks once: with nothing left above received, the next stop is allowed", async () => {
    const { core } = await ownedAndAnswered();
    core.stop("reviewer-1", false);
    expect(core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
  });

  test("allows the second stop, stop_hook_active, even with events above received", async () => {
    const { core, heard } = await ownedAndAnswered();
    const count = heard.length;
    expect(core.stop("reviewer-1", true)).toEqual({ decision: "allow" });
    // Nothing raises received; the allow closes the subagent's ask (task 3.6).
    expect(heard.slice(count).map((event) => event.type)).toEqual(["appended", "closed"]);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
  });

  test("carries only what is above received, and lists the open asks with nothing new", async () => {
    const fixture = pushCoreWith();
    await askAs(fixture, "reviewer-1");
    await askAs(fixture, "reviewer-1", OTHER_ID);
    const { core } = fixture;
    core.answer(ASK_ID, answer());
    core.delivered(ASK_ID, `${core.epoch}.1`);
    core.answer(OTHER_ID, answer());
    expect(core.stop("reviewer-1", false)).toEqual({
      decision: "block",
      asks: [expect.objectContaining({ askId: OTHER_ID, cursor: `${core.epoch}.1` })],
      openAsks: [
        { askId: ASK_ID, state: "answered", cursor: `${core.epoch}.1` },
        { askId: OTHER_ID, state: "answered", cursor: `${core.epoch}.1` },
      ],
    });
  });

  test("allows an owner with nothing above received, and an owner it does not know", async () => {
    const fixture = pushCoreWith();
    await askAs(fixture, "reviewer-1");
    expect(fixture.core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
    expect(fixture.core.stop("someone-else", false)).toEqual({ decision: "allow" });
  });

  test("never carries another owner's asks, nor unchecked ones", async () => {
    const fixture = pushCoreWith();
    await askAs(fixture, "reviewer-2");
    await fixture.core.ask(askWith({ askId: OTHER_ID }));
    fixture.core.answer(ASK_ID, answer());
    fixture.core.answer(OTHER_ID, answer());
    expect(fixture.core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
  });

  // Board-host spec, Stop decisions (review fix, task 13.5): the local API passes a fit that keeps
  // what its response limit holds; received rises only to the last event the block carries.
  test("raises received only to the last event the fit lets the block carry", async () => {
    const fixture = pushCoreWith();
    await askAs(fixture, "reviewer-1");
    await askAs(fixture, "reviewer-1", OTHER_ID);
    const { core, heard } = fixture;
    core.answer(ASK_ID, answer());
    core.answer(OTHER_ID, answer());
    const seen: unknown[] = [];
    const decision = core.stop("reviewer-1", false, (candidates) => {
      seen.push(candidates);
      return {
        asks: candidates.asks.slice(0, 1).map(({ entry }) => entry),
        openAsks: candidates.openAsks,
      };
    });
    const openAsks = [
      { askId: ASK_ID, state: "answered", cursor: `${core.epoch}.1` },
      { askId: OTHER_ID, state: "answered", cursor: `${core.epoch}.1` },
    ] as const;
    expect(seen).toEqual([
      {
        asks: [
          {
            entry: expect.objectContaining({ askId: ASK_ID, cursor: `${core.epoch}.1` }),
            groups: [expect.any(Number)],
          },
          {
            entry: expect.objectContaining({ askId: OTHER_ID, cursor: `${core.epoch}.1` }),
            groups: [expect.any(Number)],
          },
        ],
        openAsks,
      },
    ]);
    expect(decision).toEqual({
      decision: "block",
      asks: [expect.objectContaining({ askId: ASK_ID })],
      openAsks,
    });
    expect(heard.filter((event) => event.type === "received")).toEqual([
      { type: "received", askId: ASK_ID, cursor: `${core.epoch}.1` },
    ]);
    expect(core.board(OTHER_ID)?.questions[0]?.answer?.delivered).toBe(false);
    // What the block left stays above received, for the next block.
    expect(core.stop("reviewer-1", false)).toEqual({
      decision: "block",
      asks: [expect.objectContaining({ askId: OTHER_ID })],
      openAsks,
    });
  });

  test("raises nothing for an ask the fit carries no event of", async () => {
    const { core, heard } = await ownedAndAnswered();
    core.stop("reviewer-1", false, ({ asks, openAsks }) => ({
      asks: asks.map(({ entry }) => ({ ...entry, events: [] })),
      openAsks,
    }));
    expect(heard.filter((event) => event.type === "received")).toEqual([]);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
  });

  // PO decision of 2026-11-03 on AD-10 and AD-21: the guard delivers a discarded ask's tombstone,
  // the answers the user gave and the discard, and never a closed ask's events.
  test("carries a discarded ask's events above received, and lists it among no open asks", async () => {
    const { core, heard } = await ownedAndAnswered();
    core.discardAll("session-exit");
    const decision = core.stop("reviewer-1", false);
    expect(decision).toEqual({
      decision: "block",
      asks: [
        {
          askId: ASK_ID,
          state: "discarded",
          cursor: `${core.epoch}.2`,
          events: [
            expect.objectContaining({ cursor: `${core.epoch}.1`, type: "answer" }),
            { cursor: `${core.epoch}.2`, type: "discarded", reason: "session-exit" },
          ],
        },
      ],
      openAsks: [],
    });
    expect(heard.at(-1)).toEqual({ type: "received", askId: ASK_ID, cursor: `${core.epoch}.2` });
    // Nothing is left above received: the next stop goes through.
    expect(core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
  });

  test("carries an open ask's events and a discarded one's together, listing the open one", async () => {
    const fixture = pushCoreWith();
    await askAs(fixture, "reviewer-1");
    await askAs(fixture, "reviewer-1", OTHER_ID);
    const { core, clock } = fixture;
    core.answer(ASK_ID, answer());
    core.answer(OTHER_ID, answer());
    // The first ask's board leaves and does not come back within the grace period (AD-21).
    core.connected(ASK_ID);
    core.disconnected(ASK_ID);
    clock.advance(GRACE_PERIOD_MS);
    expect(core.lifecycleBoard(ASK_ID)?.state).toBe("discarded");
    expect(core.stop("reviewer-1", false)).toEqual({
      decision: "block",
      asks: [
        expect.objectContaining({ askId: ASK_ID, state: "discarded", cursor: `${core.epoch}.2` }),
        expect.objectContaining({ askId: OTHER_ID, state: "answered", cursor: `${core.epoch}.1` }),
      ],
      openAsks: [{ askId: OTHER_ID, state: "answered", cursor: `${core.epoch}.1` }],
    });
    // The allow that follows closes the open ask only; the tombstone stays as it is.
    expect(core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
    expect(core.lifecycleBoard(OTHER_ID)?.state).toBe("closed");
    expect(core.lifecycleBoard(ASK_ID)?.state).toBe("discarded");
  });

  test("never carries a closed ask's events", async () => {
    const { core, heard } = await ownedAndAnswered();
    expect(core.close(ASK_ID, "agent")).toEqual({ kind: "closed", askId: ASK_ID });
    expect(core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
    expect(heard.filter((event) => event.type === "received")).toEqual([]);
  });
});

// AD-20: a board command's events are never split. The local API pages cut only between commands,
// and received rises only to the end of one (review fix M1).
describe("a board command's events", () => {
  // Two answers in one act command, then one alone: seq 1 and 2 share a command, 3 has its own.
  const twoCommands = async () => {
    const fixture = pushCoreWith();
    fixture.table.add({
      ownerKey: "reviewer-1",
      tool: "ask",
      askIds: [FLAT_ID],
      origin: REVIEWER_ORIGIN,
    });
    await fixture.core.ask(flatAsk(), callOf("ask", FLAT_ID));
    const { core } = fixture;
    core.act(FLAT_ID, command([answerAct(), answerAct({ itemId: "q2", choice: ["Linux"] })]));
    core.act(FLAT_ID, command([answerAct({ itemId: "q3", choice: ["Sara"] })]));
    return fixture;
  };

  const raisedOf = (heard: readonly CoreEvent[]) =>
    heard.flatMap((event) => (event.type === "received" ? [event.cursor] : []));

  test("a report inside a command is one no poll gives: refused, and received does not move", async () => {
    const { core, heard } = await twoCommands();
    expect(core.delivered(FLAT_ID, `${core.epoch}.1`)).toBe("refused");
    expect(raisedOf(heard)).toEqual([]);
    expect(core.delivered(FLAT_ID, `${core.epoch}.2`)).toBe("raised");
    expect(core.delivered(FLAT_ID, `${core.epoch}.3`)).toBe("raised");
  });

  test("the stop guard gives its fit each event's command group", async () => {
    const { core } = await twoCommands();
    const groups: (readonly number[])[] = [];
    core.stop("reviewer-1", false, (candidates) => {
      for (const ask of candidates.asks) groups.push(ask.groups);
      return { asks: candidates.asks.map(({ entry }) => entry), openAsks: candidates.openAsks };
    });
    const [first, second, third] = groups[0] ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
    expect(second).toBe(first as number);
    expect(third).not.toBe(first as number);
  });

  test("a block cut after a whole command raises received to that command's end", async () => {
    const { core, heard } = await twoCommands();
    const decision = core.stop("reviewer-1", false, ({ asks, openAsks }) => ({
      asks: asks.map(({ entry }) => ({
        ...entry,
        cursor: `${core.epoch}.2`,
        events: entry.events.slice(0, 2),
      })),
      openAsks,
    }));
    expect(decision).toMatchObject({ decision: "block" });
    expect(raisedOf(heard)).toEqual([`${core.epoch}.2`]);
  });

  test("a fit that cuts inside a command is a bug: the stop throws and raises nothing", async () => {
    const { core, heard } = await twoCommands();
    expect(() =>
      core.stop("reviewer-1", false, ({ asks, openAsks }) => ({
        asks: asks.map(({ entry }) => ({
          ...entry,
          cursor: `${core.epoch}.1`,
          events: entry.events.slice(0, 1),
        })),
        openAsks,
      })),
    ).toThrow(/inside a command/);
    expect(raisedOf(heard)).toEqual([]);
  });
});
