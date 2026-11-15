import { describe, expect, test } from "bun:test";
import { BOARD_KEYS, type KeyEntry } from "@askboard/contract";
import {
  type AnswerKeyInputs,
  answerableOf,
  answerKeyHandling,
  answerKeyOf,
} from "./answer-key.ts";

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

describe("answerableOf", () => {
  const open = {
    card: { phase: "open", readOnly: false },
    answered: false,
    pending: false,
  } as const;

  test("an open, visible card is answerable", () => {
    expect(answerableOf(open)).toBe(true);
  });

  test("a loading or locked card (read-only) is not", () => {
    expect(answerableOf({ ...open, card: { phase: "open", readOnly: true } })).toBe(false);
  });

  test("a command in flight is not", () => {
    expect(answerableOf({ ...open, card: { phase: "sending", readOnly: true } })).toBe(false);
    expect(answerableOf({ ...open, card: { phase: "sending", readOnly: false } })).toBe(false);
  });

  test("an answered card not being revised is not", () => {
    expect(
      answerableOf({ ...open, card: { phase: "answered", readOnly: false }, answered: true }),
    ).toBe(false);
    expect(answerableOf({ ...open, card: { phase: "declined", readOnly: false } })).toBe(false);
  });

  test("a pending agent change on an answered card is not; on an open one it is", () => {
    expect(answerableOf({ ...open, answered: true, pending: true })).toBe(false);
    expect(answerableOf({ ...open, pending: true })).toBe(true);
  });
});

describe("answerKeyHandling", () => {
  const table = BOARD_KEYS as readonly KeyEntry[];
  const card = {
    getAttribute: (name: string) => (name === "data-askboard-question" ? "q1" : null),
    closest: () => card,
  };
  const target = (selectors: Record<string, unknown>, tagName = "BUTTON") => ({
    tagName,
    getAttribute: () => null,
    closest: (selector: string) => {
      for (const [part, found] of Object.entries(selectors)) {
        if (selector.includes(part)) return found;
      }
      return null;
    },
  });
  const inCard = target({ "data-askboard-question": card });
  const press = (over: Record<string, unknown> = {}, at: unknown = inCard) =>
    answerKeyHandling(
      table,
      {
        key: "Enter",
        keyCode: 13,
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        repeat: false,
        target: at as never,
        ...over,
      },
      "q1",
      ready,
    );

  test("Mod+Enter on the card's control prevents the default and presses", () => {
    expect(press()).toEqual({ prevent: true, verdict: { verdict: "press" } });
    expect(press({ ctrlKey: false, metaKey: true }).verdict).toEqual({ verdict: "press" });
  });

  test("a repeat prevents the default and does nothing", () => {
    expect(press({ repeat: true })).toEqual({ prevent: true, verdict: { verdict: "none" } });
  });

  test("other keys and holds are left alone", () => {
    expect(press({ ctrlKey: false })).toEqual({ prevent: false, verdict: { verdict: "none" } });
    expect(press({ shiftKey: true }).prevent).toBe(false);
    expect(press({ key: "a" }).prevent).toBe(false);
    expect(press({ isComposing: true }).prevent).toBe(false);
  });

  test("a link, a text field and another question's card are left alone", () => {
    const link = target({ "a[href]": {}, "data-askboard-question": card }, "A");
    expect(press({}, link).prevent).toBe(false);
    expect(press({}, target({ "data-askboard-question": card }, "TEXTAREA")).prevent).toBe(false);
    const other = { ...card, getAttribute: () => "q2" };
    expect(press({}, target({ "data-askboard-question": other })).prevent).toBe(false);
  });
});
