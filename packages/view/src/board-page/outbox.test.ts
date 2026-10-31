import { describe, expect, mock, test } from "bun:test";
import { type AnswerCommand, BOARD_PROTOCOL_VERSION, type BoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewAnswer } from "../view-protocol.ts";
import { type BoardModel, EMPTY_MODEL } from "./model.ts";
import { EMPTY_OUTBOX, flush, hasUnsent, hold, settled, withoutItem } from "./outbox.ts";

const answer: ViewAnswer = {
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: "2026-10-30T10:00:00.250Z",
};
const other: ViewAnswer = { ...answer, itemId: "cache", choice: ["Redis"] };
const open: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const answered: BoardState = {
  ask: "answered",
  questions: [
    {
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: { choice: ["SQLite"], when: "2026-10-30T09:00:00Z", receipt: "sent" },
    },
  ],
};
const model = (state: BoardState): BoardModel => ({
  ...EMPTY_MODEL,
  document: plainChoiceBoardDocument,
  state,
  visible: new Set(["database"]),
});
const command: AnswerCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: answer.when,
};

describe("the answers the board page holds (design decision 8, FR-22)", () => {
  test("holds answers in the order given, one per question, each a new outbox", () => {
    const first = hold(EMPTY_OUTBOX, answer, false);
    const second = hold(first, other, true);
    expect(first).toEqual([{ answer, sent: false }]);
    expect(second).toEqual([
      { answer, sent: false },
      { answer: other, sent: true },
    ]);
    const again = { ...answer, choice: ["SQLite"] };
    expect(hold(second, again, true)).toEqual([
      { answer: other, sent: true },
      { answer: again, sent: true },
    ]);
  });

  test("an answer leaves once a state shows its question no longer open, or not at all", () => {
    const outbox = hold(hold(EMPTY_OUTBOX, answer, true), other, false);
    // E1's types hold one question; the outbox is written for more.
    const both = {
      ask: "waiting",
      questions: [...open.questions, { itemId: "cache", rev: 1, state: "open" }],
    } as unknown as BoardState;
    expect(settled(outbox, both)).toEqual(outbox);
    expect(settled(outbox, open)).toEqual([{ answer, sent: true }]);
    expect(settled(outbox, answered)).toEqual([]);
  });

  test("a refused answer leaves, and only its question's", () => {
    const outbox = hold(hold(EMPTY_OUTBOX, answer, true), other, false);
    expect(withoutItem(outbox, "database")).toEqual([{ answer: other, sent: false }]);
  });

  test("says whether an answer was never sent", () => {
    expect(hasUnsent(EMPTY_OUTBOX)).toBe(false);
    expect(hasUnsent(hold(EMPTY_OUTBOX, answer, true))).toBe(false);
    expect(hasUnsent(hold(EMPTY_OUTBOX, answer, false))).toBe(true);
  });

  test("a flush sends each answer whose question is open, in order, as the command", () => {
    const send = mock((_command: AnswerCommand) => true);
    const result = flush(hold(EMPTY_OUTBOX, answer, false), model(open), send);
    expect(send.mock.calls).toEqual([[command]]);
    expect(result).toEqual({ outbox: [{ answer, sent: true }], dropped: [] });
  });

  test("a flush drops an answer the board page would refuse now, saying why (AD-10)", () => {
    const send = mock((_command: AnswerCommand) => true);
    const result = flush(hold(EMPTY_OUTBOX, answer, false), model(answered), send);
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({
      outbox: [],
      dropped: [{ itemId: "database", detail: "the question is not open" }],
    });
  });

  test("an answer the socket did not take stays unsent", () => {
    const result = flush(hold(EMPTY_OUTBOX, answer, false), model(open), () => false);
    expect(result).toEqual({ outbox: [{ answer, sent: false }], dropped: [] });
  });
});
