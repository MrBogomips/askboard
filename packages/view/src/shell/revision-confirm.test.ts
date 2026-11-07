// Revising a received verdict asks first (approval-scale-ranking, design decisions 5 and 6): when a
// confirmation is needed, and how a press waits for it. Plain data, with a lookup of facts for a
// test type in place of the registry.

import { describe, expect, mock, test } from "bun:test";
import type { LifecycleQuestionStatus } from "@askboard/contract";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import { asksFirst, confirmsRevisionOf, press, settle } from "./revision-confirm.ts";

const FACTS: Readonly<Record<string, ComponentFacts>> = {
  verdict: { confirmsRevision: true },
  grade: { name: "change.widgetTree" },
};
const factsOf = (type: string): ComponentFacts | undefined =>
  Object.hasOwn(FACTS, type) ? FACTS[type] : undefined;

const questionOf = (...types: string[]): ViewQuestion =>
  ({
    type: "question",
    id: "plan",
    rev: 1,
    props: { text: "Plan?", items: types.map((type, i) => ({ type, id: `i${i}`, props: {} })) },
  }) as unknown as ViewQuestion;

const logged = (
  state: "answered" | "declined",
  receipt: "queued" | "sent" | "delivered",
): LifecycleQuestionStatus =>
  ({
    itemId: "plan",
    rev: 1,
    state,
    answer: { when: "2026-11-07T10:00:00Z", receipt },
  }) as unknown as LifecycleQuestionStatus;

describe("when revising asks first", () => {
  test.each(["answered", "declined"] as const)(
    "a %s question whose latest answer the agent has received, holding an item that asks",
    (state) => {
      expect(confirmsRevisionOf(questionOf("verdict"), logged(state, "delivered"), factsOf)).toBe(
        true,
      );
    },
  );

  test.each(["queued", "sent"] as const)("never while the receipt reads %s", (receipt) => {
    expect(confirmsRevisionOf(questionOf("verdict"), logged("answered", receipt), factsOf)).toBe(
      false,
    );
    expect(confirmsRevisionOf(questionOf("verdict"), logged("declined", receipt), factsOf)).toBe(
      false,
    );
  });

  test("never without an item whose facts ask: no facts, facts without it, or no items", () => {
    const delivered = logged("answered", "delivered");
    expect(confirmsRevisionOf(questionOf("grade"), delivered, factsOf)).toBe(false);
    expect(confirmsRevisionOf(questionOf("unknown", "constructor"), delivered, factsOf)).toBe(
      false,
    );
    const plain = { ...questionOf(), props: { text: "Plan?" } } as unknown as ViewQuestion;
    expect(confirmsRevisionOf(plain, delivered, factsOf)).toBe(false);
  });

  test("one item that asks, anywhere among the question's items, is enough", () => {
    expect(
      confirmsRevisionOf(questionOf("grade", "verdict"), logged("answered", "delivered"), factsOf),
    ).toBe(true);
  });

  test("never for a question the agent has no answer of: open, postponed, or unknown", () => {
    const question = questionOf("verdict");
    for (const state of ["open", "postponed"]) {
      const status = { itemId: "plan", rev: 1, state } as unknown as LifecycleQuestionStatus;
      expect(confirmsRevisionOf(question, status, factsOf)).toBe(false);
    }
    expect(confirmsRevisionOf(question, undefined, factsOf)).toBe(false);
  });
});

describe("which presses ask", () => {
  const question = questionOf("verdict");
  const delivered = logged("answered", "delivered");

  test("Answer and Decline ask when revising a delivered verdict", () => {
    expect(asksFirst("answer", question, delivered, undefined, factsOf)).toBe(true);
    expect(asksFirst("decline", question, delivered, undefined, factsOf)).toBe(true);
  });

  test("a press that only takes back what is held, in submitted delivery, asks nothing", () => {
    expect(asksFirst("answer", question, delivered, "answer", factsOf)).toBe(false);
    expect(asksFirst("decline", question, delivered, "decline", factsOf)).toBe(false);
  });

  test("the other held acts do not spare the press", () => {
    expect(asksFirst("answer", question, delivered, "decline", factsOf)).toBe(true);
    expect(asksFirst("decline", question, delivered, "note", factsOf)).toBe(true);
  });

  test("a press asks only where a confirmation is needed", () => {
    expect(asksFirst("answer", question, logged("answered", "sent"), undefined, factsOf)).toBe(
      false,
    );
    expect(asksFirst("answer", questionOf("grade"), delivered, undefined, factsOf)).toBe(false);
  });
});

describe("a press that waits for the confirmation", () => {
  test("when none is needed, the act runs at once and nothing waits", () => {
    const run = mock(() => {});
    expect(press(false, run)).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("when one is needed, the act does not run and waits", () => {
    const run = mock(() => {});
    const waiting = press(true, run);
    expect(waiting).toBeDefined();
    expect(run).not.toHaveBeenCalled();
  });

  test("Cancel runs nothing", () => {
    const run = mock(() => {});
    settle(press(true, run), false);
    expect(run).not.toHaveBeenCalled();
  });

  test("confirming runs the act once, however often it is confirmed", () => {
    const run = mock(() => {});
    const waiting = press(true, run);
    settle(waiting, true);
    settle(waiting, true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("a cancelled act cannot run afterwards", () => {
    const run = mock(() => {});
    const waiting = press(true, run);
    settle(waiting, false);
    settle(waiting, true);
    expect(run).not.toHaveBeenCalled();
  });

  test("settling nothing runs nothing", () => {
    expect(() => settle(undefined, true)).not.toThrow();
  });
});
