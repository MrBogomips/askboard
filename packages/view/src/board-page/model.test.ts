import { describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  type BoardDocument,
  type BoardState,
  type HostMessage,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewAnswer } from "../view-protocol.ts";
import {
  answerCommandFor,
  type BoardModel,
  bootDataOf,
  EMPTY_MODEL,
  stateProblem,
  withHostMessage,
  withViewMessage,
} from "./model.ts";

const version = BOARD_PROTOCOL_VERSION;
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

  test("moved, discarded and refused leave the model as it is: the board page's status has them", () => {
    const model = withHostMessage(EMPTY_MODEL, board);
    for (const message of [
      { version, type: "moved" },
      { version, type: "discarded", reason: "session-exit" },
      { version, type: "refused", reason: "token", detail: "no" },
    ] as const) {
      expect(withHostMessage(model, message)).toBe(model);
    }
  });

  test("a receipt marks the question's logged answer delivered to the agent (FR-22)", () => {
    const sent: BoardState = {
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
    const model = withHostMessage(withHostMessage(EMPTY_MODEL, board), {
      version,
      type: "state",
      state: sent,
    });
    const receipt = { version, type: "receipt", itemId: "database", receipt: "delivered" } as const;
    const delivered = withHostMessage(model, receipt);
    expect(delivered.state?.questions[0]).toEqual({
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z", receipt: "delivered" },
    });
    expect(delivered.state?.ask).toBe("answered");
    expect(model.state).toBe(sent);
  });

  test("a receipt for no logged answer leaves the model as it is", () => {
    const receipt = { version, type: "receipt", itemId: "database", receipt: "delivered" } as const;
    const loaded = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
    expect(withHostMessage(loaded, receipt)).toBe(loaded);
    expect(withHostMessage(EMPTY_MODEL, receipt)).toBe(EMPTY_MODEL);
    const other = { ...receipt, itemId: "cache" };
    expect(withHostMessage(loaded, other)).toBe(loaded);
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

describe("a state the board page can act on (AD-10)", () => {
  test("names each question of the board document at its revision, and nothing else", () => {
    expect(stateProblem(plainChoiceBoardDocument, waiting)).toBeUndefined();
    expect(stateProblem(undefined, waiting)).toBe("the state came before the board document");
  });

  test("a state with another question, a missing one or another revision is refused", () => {
    const at = (questions: BoardState["questions"]): BoardState => ({ ask: "waiting", questions });
    expect(
      stateProblem(plainChoiceBoardDocument, at([{ itemId: "cache", rev: 1, state: "open" }])),
    ).toBe('the state names "cache", which the board document does not hold at revision 1');
    expect(
      stateProblem(plainChoiceBoardDocument, at([{ itemId: "database", rev: 2, state: "open" }])),
    ).toBe('the state names "database", which the board document does not hold at revision 2');
    // E1's types hold one question; the check is written for more.
    const two = {
      ...plainChoiceBoardDocument,
      items: [
        ...plainChoiceBoardDocument.items,
        { ...plainChoiceBoardDocument.items[0], id: "cache" },
      ],
    } as unknown as BoardDocument;
    expect(stateProblem(two, waiting)).toBe('the state leaves out "cache"');
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
        version,
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

  test("not with widget values, nor without a choice: the board protocol carries no widget value yet", () => {
    // A test-only `probe` widget item's value (design decision 12).
    const values = { sketch: { size: 4 } };
    expect(detailOf(ready(), { ...answer, values })).toBe(
      "the board protocol carries no widget value yet",
    );
    const { choice: _, ...widgetOnly } = answer;
    expect(detailOf(ready(), { ...widgetOnly, values })).toBe(
      "the board protocol carries no widget value yet",
    );
    expect(detailOf(ready(), widgetOnly)).toBe(
      "the answer carries no choice, and the board protocol carries no widget value yet",
    );
    expect(detailOf(EMPTY_MODEL, { ...answer, values })).toBe(
      "the board protocol carries no widget value yet",
    );
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
