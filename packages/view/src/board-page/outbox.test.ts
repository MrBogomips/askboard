import { describe, expect, mock, test } from "bun:test";
import {
  ACTION_ID_PATTERN,
  type ActCommand,
  BOARD_PROTOCOL_VERSION,
  type LifecycleBoardState,
} from "@askboard/contract";
import {
  acknowledged,
  EMPTY_OUTBOX,
  flush,
  hasUnsent,
  hold,
  newActionId,
  pendingOf,
  refusedCommand,
  refusedTooLarge,
  SETTLED_KEPT,
  settleDone,
  withoutAll,
} from "./outbox.ts";

const command = (actionId: string, itemId = "database"): ActCommand => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId,
  acts: [{ type: "postpone", itemId, rev: 1 }],
});
const A = "AAAAAAAAAAAAAAAAAAAAAA";
const B = "BBBBBBBBBBBBBBBBBBBBBB";
const open: LifecycleBoardState = {
  ask: "waiting",
  questions: [
    { itemId: "database", rev: 1, state: "open" },
    { itemId: "cache", rev: 1, state: "open" },
  ],
};
const basis = (itemId = "database") => [{ itemId, rev: 1, state: "open" }];

describe("action IDs (ask-lifecycle, design decision 6; AD-20)", () => {
  test("22 base64url characters from 16 random bytes", () => {
    const id = newActionId();
    expect(id).toMatch(new RegExp(ACTION_ID_PATTERN));
    expect(newActionId()).not.toBe(id);
    const fixed = newActionId((bytes) => bytes.fill(255));
    expect(fixed).toBe("_____________________w");
  });
});

describe("the commands the board page holds until board-host settles them (AD-10, AD-20)", () => {
  test("a command is held, sent or queued, in the order given", () => {
    const outbox = hold(
      hold(EMPTY_OUTBOX, command(A), basis(), true),
      command(B, "cache"),
      basis("cache"),
      false,
    );
    expect(pendingOf(outbox)).toEqual([
      { actionId: A, outcome: "sent" },
      { actionId: B, outcome: "queued" },
    ]);
    expect(hasUnsent(outbox)).toBe(true);
    expect(hasUnsent(hold(EMPTY_OUTBOX, command(A), basis(), true))).toBe(false);
  });

  test("done is kept until the state that follows it, then settled", () => {
    const held = hold(EMPTY_OUTBOX, command(A), basis(), true);
    const done = acknowledged(held, A);
    expect(pendingOf(done)).toEqual([{ actionId: A, outcome: "sent" }]);
    const settled = settleDone(done);
    expect(pendingOf(settled)).toEqual([]);
    expect(settled.settled).toEqual([{ actionId: A, outcome: "done" }]);
    expect(acknowledged(held, B)).toBe(held);
    expect(settleDone(held)).toBe(held);
  });

  test("a refused command is dropped at once and settled as refused", () => {
    const held = hold(EMPTY_OUTBOX, command(A), basis(), true);
    const refused = refusedCommand(held, A);
    expect(pendingOf(refused)).toEqual([]);
    expect(refused.settled).toEqual([{ actionId: A, outcome: "refused" }]);
    expect(refusedCommand(held, B)).toBe(held);
  });

  // oversized-acts, design decision 3: a socket closed as too large carried every command sent on
  // it and not yet acknowledged; none of them is sent again.
  test("a socket closed as too large settles every sent, unacknowledged command as refused and too large, and keeps the rest", () => {
    let outbox = hold(EMPTY_OUTBOX, command(A), basis(), true);
    outbox = hold(outbox, command(B, "cache"), basis("cache"), true);
    const C = "CCCCCCCCCCCCCCCCCCCCCC";
    outbox = hold(outbox, command(C), basis(), false);
    const D = "DDDDDDDDDDDDDDDDDDDDDD";
    outbox = acknowledged(hold(outbox, command(D), basis(), true), D);
    const dropped = refusedTooLarge(outbox);
    expect(dropped.settled).toEqual([
      { actionId: A, outcome: "refused", tooLarge: true },
      { actionId: B, outcome: "refused", tooLarge: true },
    ]);
    expect(dropped.held.map((held) => held.command.actionId)).toEqual([C, D]);
    expect(pendingOf(dropped)).toEqual([
      { actionId: C, outcome: "queued" },
      { actionId: D, outcome: "sent" },
    ]);
  });

  test("a socket closed as too large with nothing sent on it changes nothing", () => {
    const empty = refusedTooLarge(EMPTY_OUTBOX);
    expect(empty).toBe(EMPTY_OUTBOX);
    const queued = hold(EMPTY_OUTBOX, command(A), basis(), false);
    expect(refusedTooLarge(queued)).toBe(queued);
  });

  test("only the latest settled commands are kept", () => {
    let outbox = EMPTY_OUTBOX;
    for (let n = 0; n < SETTLED_KEPT + 5; n += 1) {
      const id = `${String(n).padStart(2, "0")}${"x".repeat(20)}`;
      outbox = refusedCommand(hold(outbox, command(id), basis(), true), id);
    }
    expect(outbox.settled).toHaveLength(SETTLED_KEPT);
    expect(outbox.settled[0]?.actionId.startsWith("05")).toBe(true);
  });

  test("on a new socket, every held command goes again with its action ID, in order", () => {
    const outbox = hold(
      hold(EMPTY_OUTBOX, command(A), basis(), true),
      command(B, "cache"),
      basis("cache"),
      false,
    );
    const sent: ActCommand[] = [];
    const flushed = flush(outbox, open, (each) => {
      sent.push(each);
      return true;
    });
    expect(sent).toEqual([command(A), command(B, "cache")]);
    expect(pendingOf(flushed.outbox)).toEqual([
      { actionId: A, outcome: "sent" },
      { actionId: B, outcome: "sent" },
    ]);
    expect(flushed.dropped).toEqual([]);
  });

  test("a queued command whose question changed meanwhile is dropped, never sent (AD-10)", () => {
    const changed: LifecycleBoardState = {
      ask: "partly-answered",
      questions: [
        { itemId: "database", rev: 2, state: "open" },
        { itemId: "cache", rev: 1, state: "postponed" },
      ],
    };
    const outbox = hold(
      hold(EMPTY_OUTBOX, command(A), basis(), false),
      command(B, "cache"),
      basis("cache"),
      false,
    );
    const send = mock((_: ActCommand) => true);
    const flushed = flush(outbox, changed, send);
    expect(send).not.toHaveBeenCalled();
    expect(flushed.dropped.map(({ actionId }) => actionId)).toEqual([A, B]);
    expect(flushed.outbox.settled).toEqual([
      { actionId: A, outcome: "dropped" },
      { actionId: B, outcome: "dropped" },
    ]);
  });

  test("a queued command the board page would refuse now is dropped, saying why", () => {
    const flushed = flush(
      hold(EMPTY_OUTBOX, command(A), basis(), false),
      open,
      () => true,
      () => "the question's item failed in the view",
    );
    expect(flushed.dropped).toEqual([
      { actionId: A, detail: "the question's item failed in the view" },
    ]);
  });

  test("a sent command goes again even if its question changed: board-host knows whether it landed", () => {
    const answered: LifecycleBoardState = {
      ask: "answered",
      questions: [
        { itemId: "database", rev: 1, state: "postponed" },
        { itemId: "cache", rev: 1, state: "open" },
      ],
    };
    const send = mock((_: ActCommand) => true);
    const flushed = flush(hold(EMPTY_OUTBOX, command(A), basis(), true), answered, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(flushed.dropped).toEqual([]);
  });

  test("a command the socket did not take stays queued; a discard drops them all", () => {
    const flushed = flush(hold(EMPTY_OUTBOX, command(A), basis(), false), open, () => false);
    expect(pendingOf(flushed.outbox)).toEqual([{ actionId: A, outcome: "queued" }]);
    const gone = withoutAll(flushed.outbox);
    expect(pendingOf(gone)).toEqual([]);
    expect(gone.settled).toEqual([{ actionId: A, outcome: "dropped" }]);
  });
});
