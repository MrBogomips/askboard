import { describe, expect, test } from "bun:test";
import { type AnswerKeyInputs, answerKeyOf } from "./answer-key.ts";

// What the answer key does on a card (board-keys, design decisions 3 and 4): press the primary
// button's path, say why nothing was sent, or leave it.

const ready: AnswerKeyInputs = {
  opened: false,
  locked: false,
  answerable: true,
  canAnswer: true,
  pending: false,
  fieldToFix: undefined,
  empty: false,
};
const verdict = (over: Partial<AnswerKeyInputs>) => answerKeyOf({ ...ready, ...over });

describe("press", () => {
  test("when the primary button is enabled", () => {
    expect(verdict({})).toEqual({ verdict: "press" });
  });
});

describe("announce", () => {
  const blocked = { text: "Correct Code first.", itemId: "code" };

  test("an agent change waiting, even with a field to fix", () => {
    expect(verdict({ canAnswer: false, pending: true })).toEqual({
      verdict: "announce",
      message: "status.answerChangePending",
    });
    expect(verdict({ canAnswer: false, pending: true, fieldToFix: blocked, empty: true })).toEqual({
      verdict: "announce",
      message: "status.answerChangePending",
    });
  });

  test("a field to fix, with its reason", () => {
    expect(verdict({ canAnswer: false, fieldToFix: blocked, empty: true })).toEqual({
      verdict: "announce",
      message: "status.answerBlocked",
      reason: "Correct Code first.",
    });
  });

  test("nothing chosen on an answerable open question", () => {
    expect(verdict({ canAnswer: false, empty: true })).toEqual({
      verdict: "announce",
      message: "status.answerEmpty",
    });
  });
});

describe("none", () => {
  test("an opened Snapshot", () => {
    expect(verdict({ opened: true })).toEqual({ verdict: "none" });
  });

  test("a locked board", () => {
    expect(verdict({ locked: true, canAnswer: false, empty: true })).toEqual({ verdict: "none" });
  });

  test("a loading item, a command in flight and an answered card not being revised", () => {
    expect(verdict({ answerable: false, canAnswer: false, empty: true })).toEqual({
      verdict: "none",
    });
  });

  test("disabled with no reason to give", () => {
    expect(verdict({ canAnswer: false })).toEqual({ verdict: "none" });
  });
});
