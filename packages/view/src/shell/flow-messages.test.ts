import { describe, expect, test } from "bun:test";
import type { ViewQuestion } from "../view-document.ts";
import type { ViewAct } from "../view-protocol.ts";
import {
  addedMessageOf,
  allAnsweredMessagesOf,
  allReadyMessageOf,
  areaDoneMessageOf,
  declinedMessagesOf,
  deliveredMessageOf,
  nextMessageOf,
  postponedMessagesOf,
  prefillUndoneMessageOf,
  readyLostMessageOf,
  sentMessageOf,
  sentMessagesOf,
} from "./flow-messages.ts";

// The status messages of the answering flow, as pure builders (answering-flow-fixes, design
// decisions 4 and 5; #182).
const WHEN = "2026-11-15T10:00:00Z";
const answerAct = (content: Record<string, unknown>, itemId = "db"): ViewAct =>
  ({ type: "answer", itemId, rev: 1, when: WHEN, ...content }) as ViewAct;
const questionOf = (id: string, props: Record<string, unknown>): ViewQuestion =>
  ({ type: "question", id, rev: 1, props }) as unknown as ViewQuestion;

describe("the message of a command that was sent", () => {
  test("an answer names its option", () => {
    expect(sentMessageOf("answer", [answerAct({ choice: ["PostgreSQL"] })])).toEqual({
      key: "status.answerSent",
      params: { option: "PostgreSQL" },
    });
  });

  test("two choices join with a comma, and the Other text comes last", () => {
    expect(sentMessageOf("answer", [answerAct({ choice: ["A", "B"] })])?.params).toEqual({
      option: "A, B",
    });
    expect(
      sentMessageOf("answer", [answerAct({ choice: ["A", "B"], other: "C" })])?.params,
    ).toEqual({
      option: "A, B, C",
    });
    expect(sentMessageOf("answer", [answerAct({ other: "Elsewhere" })])).toEqual({
      key: "status.answerSent",
      params: { option: "Elsewhere" },
    });
  });

  test("an answer with only values or results, or an empty choice, has the plain message", () => {
    for (const content of [{ values: { a: 1 } }, { results: { a: 1 } }, { choice: [] }, {}]) {
      expect(sentMessageOf("answer", [answerAct(content)])).toEqual({
        key: "status.answerSentPlain",
      });
    }
  });

  test("a note alone says the question is still to do", () => {
    const note: ViewAct = { type: "note", itemId: "db", rev: 1, note: "Ask ops.", when: WHEN };
    expect(sentMessageOf("answer", [note])).toEqual({ key: "status.noteSent" });
  });

  test("Submit counts its answers, whatever else it holds", () => {
    const postpone: ViewAct = { type: "postpone", itemId: "p", rev: 1 };
    expect(
      sentMessageOf("submit", [
        answerAct({ choice: ["A"] }, "one"),
        postpone,
        answerAct({ choice: ["B"] }, "two"),
      ]),
    ).toEqual({ key: "status.submitted", params: { count: 2 } });
    expect(sentMessageOf("submit", [answerAct({ choice: ["A"] })])?.params).toEqual({ count: 1 });
  });

  test("Submit without an answer says nothing", () => {
    expect(sentMessageOf("submit", [{ type: "postpone", itemId: "p", rev: 1 }])).toBeUndefined();
    const note: ViewAct = { type: "note", itemId: "db", rev: 1, note: "n", when: WHEN };
    expect(sentMessageOf("submit", [note])).toBeUndefined();
  });

  test("postpone, decline, reopen and edit choices say nothing", () => {
    const acts: ViewAct[] = [
      { type: "postpone", itemId: "p", rev: 1 },
      { type: "decline", itemId: "p", rev: 1, when: WHEN },
      { type: "reopen", itemId: "p" },
      { type: "edit-choice", itemId: "p", rev: 2, edit: "reload" },
      { type: "follow-up", itemId: "p", rev: 1, text: "Why?", when: WHEN },
    ];
    for (const act of acts) expect(sentMessageOf("answer", [act])).toBeUndefined();
  });

  test("a string over 80 characters is cut to 80 with an ellipsis", () => {
    const long = "x".repeat(100);
    const option = sentMessageOf("answer", [answerAct({ choice: [long] })])?.params?.option;
    expect(option).toBe(`${"x".repeat(79)}…`);
    expect(String(option)).toHaveLength(80);
    const exact = "y".repeat(80);
    expect(sentMessageOf("answer", [answerAct({ choice: [exact] })])?.params?.option).toBe(exact);
  });

  test("a cut never splits a character made of two code units", () => {
    const option = sentMessageOf("answer", [answerAct({ choice: ["😀".repeat(100)] })])?.params
      ?.option;
    expect(option).toBe(`${"😀".repeat(79)}…`);
  });
});

describe("the message of questions the agent added", () => {
  test("one question gives its header chip, else its text", () => {
    expect(addedMessageOf([questionOf("a", { text: "Which store?", header: "Store" })])).toEqual({
      key: "status.added",
      params: { count: 1, title: "Store" },
    });
    expect(addedMessageOf([questionOf("a", { text: "Which store?" })])).toEqual({
      key: "status.added",
      params: { count: 1, title: "Which store?" },
    });
  });

  test("several give the count alone", () => {
    expect(
      addedMessageOf([questionOf("a", { text: "A?" }), questionOf("b", { text: "B?" })]),
    ).toEqual({ key: "status.added", params: { count: 2 } });
  });

  test("none gives nothing, and a long title is cut", () => {
    expect(addedMessageOf([])).toBeUndefined();
    expect(addedMessageOf([questionOf("a", { text: "t".repeat(90) })])?.params?.title).toBe(
      `${"t".repeat(79)}…`,
    );
  });
});

// The guided flow's builders (answering-flow-guidance, design decision 7; requirement "Status
// messages for the guided flow").
const NEXT = { title: "Cache", n: 4, m: 9 };

describe("the message of a command with the next question named", () => {
  test("an answer appends the next question to its own message", () => {
    expect(
      sentMessagesOf("answer", [answerAct({ choice: ["PostgreSQL"] })], { next: NEXT }),
    ).toEqual([
      { key: "status.answerSent", params: { option: "PostgreSQL" } },
      { key: "status.next", params: { title: "Cache", n: 4, m: 9 } },
    ]);
    expect(sentMessagesOf("answer", [answerAct({ values: { a: 1 } })], { next: NEXT })[0]).toEqual({
      key: "status.answerSentPlain",
    });
  });

  test("without a recorded next the message is as before", () => {
    const acts = [answerAct({ choice: ["A"] })];
    const plain = { key: "status.answerSent", params: { option: "A" } } as const;
    expect(sentMessageOf("answer", acts)).toEqual(plain);
    expect(sentMessagesOf("answer", acts)).toEqual([plain]);
    expect(sentMessagesOf("answer", acts, {})).toEqual([plain]);
    expect(sentMessagesOf("answer", [{ type: "postpone", itemId: "p", rev: 1 }])).toEqual([]);
  });

  test("a revision says the change was sent, and names no next question", () => {
    expect(
      sentMessagesOf("answer", [answerAct({ choice: ["B"] })], { revision: true, next: NEXT }),
    ).toEqual([{ key: "status.changeSent" }]);
  });

  test("a note alone, and Submit, keep their own message and append the next", () => {
    const note: ViewAct = { type: "note", itemId: "db", rev: 1, note: "n", when: WHEN };
    expect(sentMessagesOf("answer", [note], { next: NEXT })[0]).toEqual({ key: "status.noteSent" });
    expect(sentMessagesOf("submit", [answerAct({ choice: ["A"] }, "one")], { next: NEXT })).toEqual(
      [
        { key: "status.submitted", params: { count: 1 } },
        { key: "status.next", params: { title: "Cache", n: 4, m: 9 } },
      ],
    );
  });

  test("the title is cut at 80 characters, whole code points", () => {
    expect(nextMessageOf({ title: "t".repeat(90), n: 1, m: 2 }).params?.title).toBe(
      `${"t".repeat(79)}…`,
    );
    expect(nextMessageOf({ title: "😀".repeat(100), n: 1, m: 2 }).params?.title).toBe(
      `${"😀".repeat(79)}…`,
    );
  });
});

describe("the other messages of the guided flow", () => {
  test("postponed and declined, with the next question when the board moved", () => {
    expect(postponedMessagesOf(undefined)).toEqual([{ key: "status.postponed" }]);
    expect(postponedMessagesOf(NEXT)).toEqual([
      { key: "status.postponed" },
      { key: "status.next", params: { title: "Cache", n: 4, m: 9 } },
    ]);
    expect(declinedMessagesOf(undefined)).toEqual([{ key: "status.declined" }]);
    expect(declinedMessagesOf(NEXT)[1]).toEqual({
      key: "status.next",
      params: { title: "Cache", n: 4, m: 9 },
    });
  });

  test("a ready mark lost names the field to fix, cut at 80", () => {
    expect(readyLostMessageOf("Ticket")).toEqual({
      key: "status.readyLost",
      params: { label: "Ticket" },
    });
    expect(readyLostMessageOf("l".repeat(81)).params?.label).toBe(`${"l".repeat(79)}…`);
  });

  test("an area left with nothing to do names the area, cut at 80", () => {
    expect(areaDoneMessageOf("Architecture")).toEqual({
      key: "status.areaDone",
      params: { area: "Architecture" },
    });
    expect(areaDoneMessageOf("a".repeat(81)).params?.area).toBe(`${"a".repeat(79)}…`);
  });

  test("every question answered is the two lines of the completion panel", () => {
    expect(allAnsweredMessagesOf({ sent: 9, delivered: 3 })).toEqual([
      { key: "completion.title" },
      { key: "completion.counts", params: { s: 9, d: 3 } },
    ]);
  });

  test("all ready, a prefill undone, and the delivered count", () => {
    expect(allReadyMessageOf()).toEqual({ key: "bar.allReady" });
    expect(prefillUndoneMessageOf()).toEqual({ key: "status.prefillUndone" });
    expect(deliveredMessageOf({ sent: 5, delivered: 2 })).toEqual({
      key: "status.delivered",
      params: { d: 2, s: 5 },
    });
  });
});
