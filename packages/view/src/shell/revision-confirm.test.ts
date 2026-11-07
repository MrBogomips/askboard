// Revising a received verdict asks first (approval-scale-ranking, design decisions 5 and 6): when a
// confirmation is needed, and how a press waits for it. Plain data, with a lookup of facts for a
// test type in place of the registry.

import { describe, expect, mock, test } from "bun:test";
import type { HeldAct, LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import {
  asksFirst,
  type Confirmation,
  confirmationOf,
  confirmsRevisionOf,
  press,
  questionsToConfirm,
  settle,
  settleConfirmation,
} from "./revision-confirm.ts";

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

describe("a confirmation keeps the control pressed (design decision 6; NFR-12)", () => {
  // Plain stand-ins for the elements: the card holds real ones.
  const answerButton = { name: "Answer" };
  const moreButton = { name: "More" };

  const waitingOn = (
    act: "answer" | "decline",
    control: object | undefined,
    run = mock(() => {}),
  ): { confirmation: Confirmation<object> | undefined; run: typeof run } => ({
    confirmation: confirmationOf(act, press(true, run), control),
    run,
  });

  test("it holds the act, what waits and the control pressed", () => {
    const { confirmation, run } = waitingOn("answer", answerButton);
    expect(confirmation?.act).toBe("answer");
    expect(confirmation?.control).toBe(answerButton);
    expect(run).not.toHaveBeenCalled();
  });

  test("nothing waiting is no confirmation", () => {
    expect(
      confirmationOf(
        "answer",
        press(false, () => {}),
        answerButton,
      ),
    ).toBeUndefined();
  });

  test("Cancel and Escape give the control pressed back as the focus target, and run nothing", () => {
    for (const [act, control] of [
      ["answer", answerButton],
      ["decline", moreButton],
    ] as const) {
      const { confirmation, run } = waitingOn(act, control);
      expect(settleConfirmation(confirmation, false)).toEqual({ to: "control", control });
      expect(run).not.toHaveBeenCalled();
    }
  });

  test("confirming an Answer runs it once and moves focus nowhere", () => {
    const { confirmation, run } = waitingOn("answer", answerButton);
    expect(settleConfirmation(confirmation, true)).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("confirming a Decline runs it once and gives the heading", () => {
    const { confirmation, run } = waitingOn("decline", moreButton);
    expect(settleConfirmation(confirmation, true)).toEqual({ to: "heading" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("a press that had no control to remember gives no target on Cancel", () => {
    const { confirmation } = waitingOn("answer", undefined);
    expect(settleConfirmation(confirmation, false)).toBeUndefined();
  });

  test("settling no confirmation gives no target", () => {
    expect(settleConfirmation(undefined, false)).toBeUndefined();
    expect(settleConfirmation(undefined, true)).toBeUndefined();
  });
});

describe("which held acts Submit asks about (design decision 6; F-63)", () => {
  const named = (id: string, ...types: string[]): ViewQuestion =>
    ({
      ...questionOf(...types),
      id,
    }) as ViewQuestion;
  // Board order: first, second, third, plain.
  const questions = [
    named("first", "verdict"),
    named("second", "verdict"),
    named("third", "verdict"),
    named("plain", "grade"),
  ];
  const document = { items: questions } as unknown as ViewDocument;
  const stateOf = (
    receipts: Readonly<Record<string, "queued" | "sent" | "delivered" | "open">>,
  ): LifecycleBoardState =>
    ({
      ask: "waiting",
      questions: questions.map(({ id }) =>
        receipts[id] === undefined || receipts[id] === "open"
          ? { itemId: id, rev: 1, state: "open" }
          : { ...logged("answered", receipts[id]), itemId: id },
      ),
    }) as unknown as LifecycleBoardState;
  const held = (...entries: readonly [string, HeldAct["act"]][]) =>
    entries.map(([id, act]) => ({
      question: questions.find((question) => question.id === id) as ViewQuestion,
      work: { held: { act } },
    }));
  const ids = (list: readonly ViewQuestion[]) => list.map((question) => question.id);

  test("a held answer or decline replacing a delivered one is listed, in board order", () => {
    const state = stateOf({ first: "delivered", second: "delivered", third: "delivered" });
    // Held in the order third, first, second: the list follows the board.
    const list = questionsToConfirm(
      document,
      held(["third", "decline"], ["first", "answer"], ["second", "answer"]),
      state,
      factsOf,
    );
    expect(ids(list)).toEqual(["first", "second", "third"]);
  });

  test("a delivered decline replaced by a held answer counts too", () => {
    const state = {
      ask: "waiting",
      questions: [{ ...logged("declined", "delivered"), itemId: "first" }],
    } as unknown as LifecycleBoardState;
    expect(ids(questionsToConfirm(document, held(["first", "answer"]), state, factsOf))).toEqual([
      "first",
    ]);
  });

  test("none for a receipt that reads queued or sent", () => {
    const state = stateOf({ first: "queued", second: "sent" });
    expect(
      questionsToConfirm(
        document,
        held(["first", "answer"], ["second", "decline"]),
        state,
        factsOf,
      ),
    ).toEqual([]);
  });

  test("none without the fact: an item that does not ask, or a question with nothing received", () => {
    const state = stateOf({ plain: "delivered", third: "open" });
    expect(
      questionsToConfirm(document, held(["plain", "answer"], ["third", "answer"]), state, factsOf),
    ).toEqual([]);
  });

  test("only answers and declines replace one: a held postpone, note or reopen does not", () => {
    const state = stateOf({ first: "delivered", second: "delivered", third: "delivered" });
    expect(
      questionsToConfirm(
        document,
        held(["first", "postpone"], ["second", "note"], ["third", "reopen"]),
        state,
        factsOf,
      ),
    ).toEqual([]);
  });

  test("nothing held, nothing listed", () => {
    expect(questionsToConfirm(document, [], stateOf({ first: "delivered" }), factsOf)).toEqual([]);
  });
});
