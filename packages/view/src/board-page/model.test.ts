import { describe, expect, test } from "bun:test";
import type { BoardDocument, BoardState, HostMessage } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewAnswer } from "../view-protocol.ts";
import {
  answerCommandFor,
  type BoardModel,
  bootDataOf,
  EMPTY_MODEL,
  withHostMessage,
  withViewMessage,
} from "./model.ts";

const version = "1.0";
const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
const state: HostMessage = { version, type: "state", state: waiting };

describe("what the board page knows of its board (design decision 8)", () => {
  test("a board loads once it has both the board document and the state, in either order", () => {
    expect(bootDataOf(EMPTY_MODEL)).toBeUndefined();
    expect(bootDataOf(withHostMessage(EMPTY_MODEL, board))).toBeUndefined();
    expect(bootDataOf(withHostMessage(EMPTY_MODEL, state))).toBeUndefined();
    const expected = { document: plainChoiceBoardDocument, state: waiting };
    expect(bootDataOf(withHostMessage(withHostMessage(EMPTY_MODEL, board), state))).toEqual(
      expected,
    );
    expect(bootDataOf(withHostMessage(withHostMessage(EMPTY_MODEL, state), board))).toEqual(
      expected,
    );
  });

  test("a later state replaces the earlier one in a new model", () => {
    const first = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
    const answered: BoardState = {
      ask: "answered",
      questions: [
        {
          itemId: "database",
          rev: 1,
          state: "answered",
          answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z", receipt: "sent" },
        },
      ],
    };
    const next = withHostMessage(first, { version, type: "state", state: answered });
    expect(next.state).toBe(answered);
    expect(first.state).toBe(waiting);
  });

  test("the messages task 8.6 handles leave the model as it is", () => {
    const model = withHostMessage(EMPTY_MODEL, board);
    for (const message of [
      { version, type: "moved" },
      { version, type: "discarded", reason: "session-exit" },
      { version, type: "receipt", itemId: "database", receipt: "delivered" },
      { version, type: "refused", reason: "token", detail: "no" },
    ] as const) {
      expect(withHostMessage(model, message)).toBe(model);
    }
  });

  test("the view's ready and item-error messages are recorded per item (AD-9)", () => {
    const ready = withViewMessage(EMPTY_MODEL, { type: "ready", itemId: "database" });
    expect([...ready.visible]).toEqual(["database"]);
    const failed = withViewMessage(ready, {
      type: "item-error",
      itemId: "database",
      error: "boom",
    });
    expect([...failed.failed]).toEqual([["database", "boom"]]);
    expect(EMPTY_MODEL.visible.size + EMPTY_MODEL.failed.size).toBe(0);
  });
});

describe("an answer from the view becomes a board-protocol command only if it can be (AD-10)", () => {
  const answer: ViewAnswer = {
    type: "answer",
    itemId: "database",
    rev: 1,
    choice: ["PostgreSQL"],
    when: "2026-10-30T09:41:27.123Z",
  };
  const ready = (document: BoardDocument = plainChoiceBoardDocument): BoardModel =>
    withViewMessage(withHostMessage(withHostMessage(EMPTY_MODEL, { ...board, document }), state), {
      type: "ready",
      itemId: "database",
    });
  const detailOf = (model: BoardModel, message: ViewAnswer = answer) => {
    const command = answerCommandFor(model, message);
    return command.ok ? undefined : command.detail;
  };

  test("an answer to the open, visible question goes as the transcript's command", () => {
    expect(answerCommandFor(ready(), answer)).toEqual({
      ok: true,
      value: {
        version: "1.0",
        type: "answer",
        itemId: "database",
        rev: 1,
        choice: ["PostgreSQL"],
        when: "2026-10-30T09:41:27.123Z",
      },
    });
  });

  test("not before the board has its document and state", () => {
    expect(detailOf(EMPTY_MODEL)).toContain("no board");
  });

  test("not to an item the board does not hold, or at another revision", () => {
    expect(detailOf(ready(), { ...answer, itemId: "other" })).toContain('"other"');
    expect(detailOf(ready(), { ...answer, rev: 2 })).toContain("revision");
  });

  test("not to a question that is not open", () => {
    const answered: BoardState = {
      ask: "answered",
      questions: [
        {
          itemId: "database",
          rev: 1,
          state: "answered",
          answer: { choice: ["SQLite"], when: "2026-10-29T09:41:27Z", receipt: "sent" },
        },
      ],
    };
    const model = withHostMessage(ready(), { version, type: "state", state: answered });
    expect(detailOf(model)).toContain("not open");
  });

  test("not to a question that never counted as visible, or whose item failed (AD-9)", () => {
    const loaded = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
    expect(detailOf(loaded)).toContain("visible");
    const failed = withViewMessage(ready(), {
      type: "item-error",
      itemId: "database",
      error: "boom",
    });
    expect(detailOf(failed)).toContain("failed");
  });

  test("not with a label the question does not offer", () => {
    expect(detailOf(ready(), { ...answer, choice: ["Oracle"] })).toContain('"Oracle"');
  });

  test("one label, unless the question is multiSelect", () => {
    const two = { ...answer, choice: ["PostgreSQL", "SQLite"] };
    expect(detailOf(ready(), two)).toContain("one");
    const [question] = plainChoiceBoardDocument.items;
    const multiple: BoardDocument = {
      ...plainChoiceBoardDocument,
      items: [{ ...question, props: { ...question.props, multiSelect: true } }],
    };
    expect(answerCommandFor(ready(multiple), two).ok).toBe(true);
  });
});
