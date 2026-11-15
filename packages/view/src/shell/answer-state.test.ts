import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import type { AnswerContent } from "../view-protocol.ts";
import { type AnswerStateInputs, answerStateOf, ladderCountsOf } from "./answer-state.ts";
import type { QuestionWork } from "./board-draft.ts";

// The answer state ladder (answering-flow-guidance, design decision 1): one state per question,
// from the held act, the flight, the logged status and the draft work.
const NOTHING: AnswerContent = {};
const logged = (
  state: "answered" | "declined",
  receipt: "sent" | "delivered",
  itemId = "q",
): LifecycleQuestionStatus =>
  ({
    itemId,
    rev: 1,
    state,
    answer: {
      when: "2026-11-15T10:00:00Z",
      receipt,
      ...(state === "declined" ? { declined: true } : {}),
    },
  }) as LifecycleQuestionStatus;
const open = (state: "open" | "postponed", itemId = "q"): LifecycleQuestionStatus => ({
  itemId,
  rev: 1,
  state,
});
const stateOf = (inputs: Partial<AnswerStateInputs> & { status?: LifecycleQuestionStatus }) =>
  answerStateOf({ status: open("open"), content: NOTHING, ...inputs });

describe("a held act decides first", () => {
  test("an answer is ready, a decline declined, a postpone postponed", () => {
    expect(stateOf({ held: "answer" })).toBe("ready");
    expect(stateOf({ held: "decline" })).toBe("declined");
    expect(stateOf({ held: "postpone" })).toBe("postponed");
  });

  test("over a logged answer, a held answer is ready too (a revision)", () => {
    expect(stateOf({ held: "answer", status: logged("answered", "delivered") })).toBe("ready");
  });

  test("a held act beats a queued flight", () => {
    expect(stateOf({ held: "answer", flight: { outcome: "queued" } })).toBe("ready");
  });

  test("a held reopen, or an undo, falls through to the content rule", () => {
    const sent = logged("declined", "sent");
    expect(stateOf({ held: "reopen", status: sent })).toBe("todo");
    expect(stateOf({ undone: true, status: sent })).toBe("todo");
    expect(stateOf({ undone: true, status: open("postponed"), content: { choice: ["A"] } })).toBe(
      "draft",
    );
    expect(stateOf({ held: "reopen", status: sent, content: { note: "why" } })).toBe("draft");
  });

  test("a held note alone decides nothing", () => {
    expect(stateOf({ held: "note", content: { note: "x" } })).toBe("draft");
    expect(stateOf({ held: "note", status: open("postponed") })).toBe("postponed");
  });
});

describe("a flight", () => {
  test("a queued one is not sent yet, a sent one or one without a reply falls through", () => {
    expect(stateOf({ flight: { outcome: "queued" } })).toBe("not-sent-yet");
    expect(stateOf({ flight: { outcome: "sent" } })).toBe("todo");
    expect(stateOf({ flight: {} })).toBe("todo");
    expect(stateOf({ flight: {}, status: logged("answered", "sent") })).toBe("sent");
  });
});

describe("the logged status", () => {
  test("an answer is sent or delivered by its receipt", () => {
    expect(stateOf({ status: logged("answered", "sent") })).toBe("sent");
    expect(stateOf({ status: logged("answered", "delivered") })).toBe("delivered");
  });

  test("a revision (draft work on an answered question) is a draft", () => {
    for (const content of [
      { choice: ["B"] },
      { other: "x" },
      { values: { a: 1 } },
      { results: { a: 1 } },
      { optionNotes: { B: "n" } },
    ] satisfies AnswerContent[]) {
      expect(stateOf({ status: logged("answered", "delivered"), content })).toBe("draft");
    }
  });

  test("a note alone is no revision", () => {
    expect(stateOf({ status: logged("answered", "sent"), content: { note: "n" } })).toBe("sent");
  });

  test("a decline stays declined, a postponed question postponed, whatever the work", () => {
    expect(stateOf({ status: logged("declined", "sent") })).toBe("declined");
    expect(stateOf({ status: logged("declined", "delivered"), content: { choice: ["A"] } })).toBe(
      "declined",
    );
    expect(stateOf({ status: open("postponed") })).toBe("postponed");
    expect(stateOf({ status: open("postponed"), content: { choice: ["A"] } })).toBe("postponed");
  });
});

describe("an open question", () => {
  test("is a draft with a choice, Other text, an option note, a note or a widget value", () => {
    for (const content of [
      { choice: ["A"] },
      { other: "x" },
      { optionNotes: { A: "n" } },
      { note: "n" },
      { values: { a: 1 } },
      { results: { a: 1 } },
    ] satisfies AnswerContent[]) {
      expect(stateOf({ content })).toBe("draft");
    }
  });

  test("is to do when its work is empty, in any of the ways a field is empty", () => {
    expect(stateOf({})).toBe("todo");
    expect(
      stateOf({
        content: { choice: [], other: "", note: "", optionNotes: {}, values: {}, results: {} },
      }),
    ).toBe("todo");
  });

  test("a question the state does not hold is to do", () => {
    expect(answerStateOf({ status: undefined, content: NOTHING })).toBe("todo");
  });
});

describe("the ladder's counts over a board", () => {
  const question = (id: string): ViewQuestion =>
    ({ type: "question", id, rev: 1, props: { text: id } }) as unknown as ViewQuestion;
  const ids = ["todo", "draft", "ready", "queued", "sent", "delivered", "later", "no"];
  const document = { items: ids.map(question) } as unknown as ViewDocument;
  const state = {
    ask: "partly-answered",
    questions: [
      open("open", "todo"),
      open("open", "draft"),
      open("open", "ready"),
      open("open", "queued"),
      logged("answered", "sent", "sent"),
      logged("answered", "delivered", "delivered"),
      open("postponed", "later"),
      logged("declined", "sent", "no"),
    ],
  } as unknown as LifecycleBoardState;
  const work = new Map<string, QuestionWork>([
    ["ready", { rev: 1, held: { act: "answer", order: 1 } }],
  ]);

  test("counts each state once", () => {
    const counts = ladderCountsOf(
      document,
      state,
      work,
      (id) => (id === "queued" ? { key: 1, acts: [], outcome: "queued" } : undefined),
      (each) => (each.id === "draft" ? { choice: ["A"] } : NOTHING),
    );
    expect(counts).toEqual({
      todo: 1,
      draft: 1,
      ready: 1,
      "not-sent-yet": 1,
      sent: 1,
      delivered: 1,
      postponed: 1,
      declined: 1,
    });
  });

  test("a board of no question counts zeros", () => {
    const empty = { items: [] } as unknown as ViewDocument;
    const counts = ladderCountsOf(
      empty,
      state,
      new Map(),
      () => undefined,
      () => NOTHING,
    );
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });
});
