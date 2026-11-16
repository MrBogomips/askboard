import { describe, expect, test } from "bun:test";
import { ANSWER_STATES } from "./answer-state.ts";
import { answeredLookOf } from "./answered-look.ts";
import { outboxLineOf } from "./outbox-line.ts";

// The outbox's line and the answered look (answering-flow-visual, design decisions 3 and 7).
const NO_PANEL = { kind: "none" } as const;
const SEND_ALL = { kind: "send-all", count: 2 } as const;

describe("outboxLineOf", () => {
  test("updates over everything while held work is blocked", () => {
    expect(outboxLineOf({ blocked: ["b", "c"], completion: SEND_ALL, held: 2 })).toEqual({
      kind: "updates",
      count: 2,
      first: "b",
    });
  });

  test("all-ready when the completion is send-all", () => {
    expect(outboxLineOf({ blocked: [], completion: SEND_ALL, held: 2 })).toEqual({
      kind: "all-ready",
    });
  });

  test("held {count} while answers are held", () => {
    expect(outboxLineOf({ blocked: [], completion: NO_PANEL, held: 3 })).toEqual({
      kind: "held",
      count: 3,
    });
  });

  test("none otherwise", () => {
    expect(outboxLineOf({ blocked: [], completion: NO_PANEL, held: 0 })).toBeUndefined();
    expect(
      outboxLineOf({ blocked: [], completion: { kind: "done", sent: 1, delivered: 1 }, held: 0 }),
    ).toBeUndefined();
  });
});

describe("answeredLookOf", () => {
  const ANSWERED = ["ready", "sent", "delivered", "declined"];

  test("true for Ready, Sent, Delivered and Declined without a revision in draft", () => {
    for (const state of ANSWER_STATES)
      expect(answeredLookOf(state, false)).toBe(ANSWERED.includes(state));
  });

  test("false for every state while a revision is in draft", () => {
    for (const state of ANSWER_STATES) expect(answeredLookOf(state, true)).toBe(false);
  });
});
