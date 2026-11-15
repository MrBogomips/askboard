import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import { type AnswerStateInputs, answerStateOf, ladderCountsOf } from "./answer-state.ts";
import type { QuestionWork } from "./board-draft.ts";

// The answer state ladder (answering-flow-guidance, design decision 1): one state per question,
// from the held act, the flight, the logged status and the draft work.
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
  answerStateOf({ status: open("open"), revising: false, ...inputs });

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
    expect(stateOf({ undone: true, status: open("postponed"), revising: true })).toBe("draft");
    expect(stateOf({ held: "reopen", status: sent, revising: true })).toBe("draft");
  });

  test("a held note alone decides nothing", () => {
    expect(stateOf({ held: "note", revising: true })).toBe("draft");
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

  test("a sent answer reads Sent until it settles, whatever the board state still holds", () => {
    const answer = { outcome: "sent", act: "answer" } as const;
    expect(stateOf({ flight: answer })).toBe("sent");
    // The work it carries is not a revision while it is on its way.
    expect(stateOf({ flight: answer, revising: true })).toBe("sent");
    // A revision on its way never claims the old answer's receipt.
    expect(
      stateOf({ flight: answer, revising: true, status: logged("answered", "delivered") }),
    ).toBe("sent");
  });

  test("a sent decline or postpone reads as the act it is; a sent reopen falls through", () => {
    expect(stateOf({ flight: { outcome: "sent", act: "decline" } })).toBe("declined");
    expect(stateOf({ flight: { outcome: "sent", act: "postpone" } })).toBe("postponed");
    expect(stateOf({ flight: { outcome: "sent", act: "reopen" } })).toBe("todo");
  });

  test("a command without a reply is no state, and a held act still decides first", () => {
    expect(stateOf({ flight: { act: "answer" } })).toBe("todo");
    expect(stateOf({ held: "decline", flight: { outcome: "sent", act: "answer" } })).toBe(
      "declined",
    );
  });
});

describe("the logged status", () => {
  test("an answer is sent or delivered by its receipt", () => {
    expect(stateOf({ status: logged("answered", "sent") })).toBe("sent");
    expect(stateOf({ status: logged("answered", "delivered") })).toBe("delivered");
  });

  test("a revision (the caller's revising) on an answered question is a draft", () => {
    expect(stateOf({ status: logged("answered", "delivered"), revising: true })).toBe("draft");
    expect(stateOf({ status: logged("answered", "sent"), revising: true })).toBe("draft");
  });

  test("the ladder reads no content: no revising, no draft", () => {
    expect(stateOf({ status: logged("answered", "sent"), revising: false })).toBe("sent");
    expect(stateOf({ status: logged("answered", "delivered"), revising: false })).toBe("delivered");
  });

  test("a decline without work stays declined, a postponed question postponed, whatever the work", () => {
    expect(stateOf({ status: logged("declined", "sent") })).toBe("declined");
    expect(stateOf({ status: open("postponed") })).toBe("postponed");
    expect(stateOf({ status: open("postponed"), revising: true })).toBe("postponed");
  });
});

describe("a declined question", () => {
  test("with answer work is a draft (a revision)", () => {
    expect(stateOf({ status: logged("declined", "delivered"), revising: true })).toBe("draft");
  });
});

describe("an open question", () => {
  test("is a draft when the caller says it has work, to do when not", () => {
    expect(stateOf({ revising: true })).toBe("draft");
    expect(stateOf({})).toBe("todo");
  });

  test("a question the state does not hold is to do", () => {
    expect(answerStateOf({ status: undefined, revising: false })).toBe("todo");
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
      (each) => each.id === "draft",
    );
    expect(counts).toEqual({
      revisions: 0,
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
      () => false,
    );
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  test("revisions are the drafts whose status is answered or declined", () => {
    const counts = ladderCountsOf(
      document,
      state,
      work,
      () => undefined,
      (each) => ["todo", "draft", "sent", "delivered", "later", "no"].includes(each.id),
    );
    expect(counts.revisions).toBe(3);
    expect(counts.draft).toBe(5);
    expect(counts.postponed).toBe(1);
    expect(counts.declined).toBe(0);
    expect(counts.sent).toBe(0);
    expect(counts.delivered).toBe(0);
  });
});
