import { describe, expect, test } from "bun:test";
import { validatePushMessage } from "@askboard/contract/validate";
import { answer, askWith, plainChoiceAsk } from "./fakes.ts";
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
    expect(heard).toHaveLength(count);
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
    const decision = core.stop("reviewer-1", false, (block) => {
      seen.push(block);
      return { asks: block.asks.slice(0, 1), openAsks: block.openAsks };
    });
    const openAsks = [
      { askId: ASK_ID, state: "answered", cursor: `${core.epoch}.1` },
      { askId: OTHER_ID, state: "answered", cursor: `${core.epoch}.1` },
    ] as const;
    expect(seen).toEqual([
      {
        asks: [
          expect.objectContaining({ askId: ASK_ID, cursor: `${core.epoch}.1` }),
          expect.objectContaining({ askId: OTHER_ID, cursor: `${core.epoch}.1` }),
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
      asks: asks.map((entry) => ({ ...entry, events: [] })),
      openAsks,
    }));
    expect(heard.filter((event) => event.type === "received")).toEqual([]);
    expect(core.board(ASK_ID)?.questions[0]?.answer?.delivered).toBe(false);
  });

  test("leaves out discarded asks", async () => {
    const { core } = await ownedAndAnswered();
    core.discardAll("session-exit");
    expect(core.stop("reviewer-1", false)).toEqual({ decision: "allow" });
  });
});
