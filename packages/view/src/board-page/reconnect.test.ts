import { describe, expect, test } from "bun:test";
import { BOARD_CLOSE_CODES, MESSAGE_TOO_BIG_CLOSE } from "@askboard/contract";
import { closeKindOf, isTooBigClose, RECONNECT_DELAYS_MS, reconnectDelay } from "./reconnect.ts";

describe("closes and reconnecting (design decision 5, AD-21)", () => {
  test("the contract's three close codes say what ended the socket", () => {
    expect(closeKindOf(BOARD_CLOSE_CODES.refused)).toBe("refused");
    expect(closeKindOf(BOARD_CLOSE_CODES.moved)).toBe("moved");
    expect(closeKindOf(BOARD_CLOSE_CODES.discarded)).toBe("discarded");
  });

  test("any other code is an ordinary drop, 1006 and 1013 included", () => {
    for (const code of [1000, 1001, 1006, 1011, 1012, 1013, 4000, 4404, 4999]) {
      expect(closeKindOf(code)).toBe("drop");
    }
  });

  test("1009, a message too big, is still a drop that reconnects, and the only close isTooBigClose names", () => {
    expect(closeKindOf(MESSAGE_TOO_BIG_CLOSE)).toBe("drop");
    expect(isTooBigClose(1009)).toBe(true);
    for (const code of [1000, 1006, 1008, 1010, 1013, ...Object.values(BOARD_CLOSE_CODES)]) {
      expect(isTooBigClose(code)).toBe(false);
    }
  });

  test("the backoff grows from a quarter second and stays at its longest wait", () => {
    expect(RECONNECT_DELAYS_MS).toEqual([250, 500, 1_000, 2_000, 4_000]);
    expect([0, 1, 2, 3, 4, 5, 50].map(reconnectDelay)).toEqual([
      250, 500, 1_000, 2_000, 4_000, 4_000, 4_000,
    ]);
  });

  test("a negative or fractional attempt counts as the nearest one inside the schedule", () => {
    expect(reconnectDelay(-1)).toBe(250);
    expect(reconnectDelay(1.5)).toBe(500);
  });
});
