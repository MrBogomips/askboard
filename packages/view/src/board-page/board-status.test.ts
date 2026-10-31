import { describe, expect, test } from "bun:test";
import { BOARD_CLOSE_CODES } from "@askboard/contract";
import {
  type BoardStatus,
  bannerOf,
  connectionOf,
  INITIAL_STATUS,
  lockOf,
  nextStatus,
  type StatusEvent,
} from "./board-status.ts";

const live: BoardStatus = { kind: "live" };
const retrying: BoardStatus = { kind: "retrying" };
const moved: BoardStatus = { kind: "moved" };
const discarded: BoardStatus = { kind: "discarded" };
const closed = (code: number): StatusEvent => ({ type: "closed", code });

describe("the board's status (AD-21, design decision 5)", () => {
  test("a board starts connecting and is live once its socket's connect is accepted", () => {
    expect(INITIAL_STATUS).toEqual({ kind: "connecting" });
    expect(nextStatus(INITIAL_STATUS, { type: "accepted" })).toEqual(live);
  });

  test("an ordinary close, at any time before an end, retries; a new socket resumes", () => {
    for (const status of [INITIAL_STATUS, live, retrying]) {
      for (const code of [1006, 1013, 1001])
        expect(nextStatus(status, closed(code))).toEqual(retrying);
    }
    expect(nextStatus(retrying, { type: "accepted" })).toEqual(live);
  });

  test("4403 and 4410 discard the board, 4409 moves it, whatever it was doing", () => {
    for (const status of [INITIAL_STATUS, live, retrying]) {
      expect(nextStatus(status, closed(BOARD_CLOSE_CODES.refused))).toEqual(discarded);
      expect(nextStatus(status, closed(BOARD_CLOSE_CODES.discarded))).toEqual(discarded);
      expect(nextStatus(status, closed(BOARD_CLOSE_CODES.moved))).toEqual(moved);
    }
  });

  test("the moved and discarded messages end the board before their close arrives", () => {
    expect(nextStatus(live, { type: "moved" })).toEqual(moved);
    expect(nextStatus(live, { type: "discarded" })).toEqual(discarded);
    expect(nextStatus(moved, closed(BOARD_CLOSE_CODES.moved))).toEqual(moved);
    expect(nextStatus(discarded, closed(BOARD_CLOSE_CODES.discarded))).toEqual(discarded);
  });

  test("a moved board waits for Continue here: no close or socket makes it live again", () => {
    for (const event of [closed(1006), closed(1013), { type: "accepted" } as const]) {
      expect(nextStatus(moved, event)).toEqual(moved);
    }
    expect(nextStatus(moved, { type: "continue" })).toEqual(INITIAL_STATUS);
    expect(nextStatus(moved, { type: "discarded" })).toEqual(discarded);
  });

  test("Continue here does nothing on a board that has not moved", () => {
    for (const status of [INITIAL_STATUS, live, retrying, discarded]) {
      expect(nextStatus(status, { type: "continue" })).toBe(status);
    }
  });

  test("discarded is final (AD-10)", () => {
    const events: StatusEvent[] = [
      { type: "accepted" },
      { type: "moved" },
      { type: "continue" },
      closed(1006),
      closed(BOARD_CLOSE_CODES.moved),
    ];
    for (const event of events) expect(nextStatus(discarded, event)).toBe(discarded);
  });

  test("the view is locked while the board moved or once it is discarded", () => {
    expect(lockOf(moved)).toBe("moved");
    expect(lockOf(discarded)).toBe("discarded");
    for (const status of [INITIAL_STATUS, live, retrying]) expect(lockOf(status)).toBeUndefined();
  });
});

describe("the board banners (EXPERIENCE.md, Board banner)", () => {
  test("no banner while connecting or live", () => {
    expect(bannerOf(INITIAL_STATUS)).toBeUndefined();
    expect(bannerOf(live)).toBeUndefined();
  });

  test("Connection lost, retrying, which takes no focus", () => {
    expect(bannerOf(retrying)).toEqual({
      variant: "connection-lost",
      text: "Connection lost, retrying",
      takesFocus: false,
    });
  });

  test("Board moved, with Continue here, which takes no focus", () => {
    expect(bannerOf(moved)).toEqual({
      variant: "moved",
      text: "This board moved to another tab.",
      action: "Continue here",
      takesFocus: false,
    });
  });

  test("Discarded takes the focus, and says when answers were not sent", () => {
    expect(bannerOf(discarded)).toEqual({
      variant: "discarded",
      text: "This ask was discarded. The board is read-only.",
      takesFocus: true,
    });
    expect(bannerOf(discarded, true)).toEqual({
      variant: "discarded",
      text: "This ask was discarded. The board is read-only.",
      detail: "Your unsent work was not sent",
      action: "Copy my unsent work",
      takesFocus: true,
    });
  });
});

describe("a closed ask (ask-lifecycle: FR-6, Board banner, Closed)", () => {
  const closedAsk: BoardStatus = { kind: "closed" };

  test("the closed message, or a state of a closed ask, closes the board, live or not", () => {
    for (const status of [INITIAL_STATUS, live, retrying]) {
      expect(nextStatus(status, { type: "ask-closed" })).toEqual(closedAsk);
    }
  });

  test("a closed board stays closed through drops and reconnects, and locks the view", () => {
    for (const event of [closed(1006), closed(1013), { type: "accepted" } as const]) {
      expect(nextStatus(closedAsk, event)).toBe(closedAsk);
    }
    expect(lockOf(closedAsk)).toBe("closed");
  });

  test("a closed ask can still be discarded, or its board taken by another tab", () => {
    expect(nextStatus(closedAsk, { type: "discarded" })).toEqual(discarded);
    expect(nextStatus(closedAsk, closed(BOARD_CLOSE_CODES.discarded))).toEqual(discarded);
    expect(nextStatus(closedAsk, { type: "moved" })).toEqual(moved);
    expect(nextStatus(discarded, { type: "ask-closed" })).toBe(discarded);
    expect(nextStatus(moved, { type: "ask-closed" })).toBe(moved);
  });

  test("the Closed banner takes the focus; with unsent work it says so and offers the copy", () => {
    expect(bannerOf(closedAsk)).toEqual({
      variant: "closed",
      text: "This ask was closed. The board is read-only.",
      takesFocus: true,
    });
    expect(bannerOf(closedAsk, true)).toEqual({
      variant: "closed",
      text: "This ask was closed. The board is read-only.",
      detail: "Your unsent work was not sent",
      action: "Copy my unsent work",
      takesFocus: true,
    });
  });

  test("whether the connection is lost, as the view hears it to disable Submit", () => {
    expect(connectionOf(retrying)).toBe("lost");
    expect(connectionOf(INITIAL_STATUS)).toBe("lost");
    for (const status of [live, moved, discarded, closedAsk]) {
      expect(connectionOf(status)).toBeUndefined();
    }
  });
});
