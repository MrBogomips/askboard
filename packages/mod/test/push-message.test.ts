import { describe, expect, test } from "bun:test";
import { PUSH_MESSAGE_PREFACE } from "@askboard/contract";
import { validatePushMessage } from "@askboard/contract/validate";
import {
  eventKey,
  keysOf,
  lastCursor,
  merged,
  type PushedAsk,
  pushText,
  seqOf,
} from "../src/push-message.ts";
import { answerAt, EPOCH, entryOf, MAIN_ASK, SUB_ASK } from "./fake-local-api.ts";

// The push message (design decision 8) and how pushes of the same asks merge into one catch-up.

const pushed = (askId: string, seqs: readonly number[]): PushedAsk =>
  entryOf(
    askId,
    seqs.map((seq) => answerAt(seq)),
  );

describe("the push message", () => {
  test("is the preface, then the contract's push message for the asks", () => {
    const [preface, json] = pushText(EPOCH, [pushed(MAIN_ASK, [1])]).split("\n");
    expect(preface).toBe(PUSH_MESSAGE_PREFACE);
    expect(validatePushMessage(JSON.parse(json ?? "")).ok).toBe(true);
  });

  test("names each event by its ask and cursor, and reads a cursor's seq", () => {
    expect(keysOf([pushed(MAIN_ASK, [1, 2])])).toEqual([
      eventKey(MAIN_ASK, "k3x9.1"),
      eventKey(MAIN_ASK, "k3x9.2"),
    ]);
    expect(seqOf("k3x9.12")).toBe(12);
    expect(lastCursor(pushed(MAIN_ASK, [3, 10, 2]))).toBe("k3x9.10");
  });
});

describe("merging pushes", () => {
  test("keeps each ask once, its events in seq order without repeats", () => {
    const later = { ...pushed(MAIN_ASK, [2, 3]), state: "answered" as const };
    const result = merged([pushed(MAIN_ASK, [3, 1]), pushed(SUB_ASK, [1]), later]);
    expect(result.map((ask) => ask.askId)).toEqual([MAIN_ASK, SUB_ASK]);
    expect(result[0]?.events.map((event) => event.cursor)).toEqual(["k3x9.1", "k3x9.2", "k3x9.3"]);
  });

  test("takes the state and cursor of the ask's latest entry", () => {
    const early = { ...pushed(MAIN_ASK, [1]), state: "waiting" as const, cursor: "k3x9.1" };
    const late = { ...pushed(MAIN_ASK, [2]), state: "answered" as const, cursor: "k3x9.2" };
    for (const order of [
      [early, late],
      [late, early],
    ]) {
      const [only] = merged(order);
      expect(only?.state).toBe("answered");
      expect(only?.cursor).toBe("k3x9.2");
    }
  });
});
