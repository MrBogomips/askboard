import { describe, expect, test } from "bun:test";
import type { DraftRecord, LifecycleBoardState } from "@askboard/contract";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import { hasUnsentWork } from "../board-page/unsent-work.ts";
import { questionsOf } from "../view-document.ts";
import { createBoardDraft, draftRecordOf, restoreDraft } from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";

// The short numbers in the draft (answering-flow-visual, design decision 6; spec: Short question
// numbers, "A reload keeps the numbers", "Numbers alone are not unsent work"): the board's state
// holds them beside the question in view, the record writes them, a restore reads them.
const ids = questionsOf(lifecycleBoardDocument).map((question) => question.id);
const [first, second] = ids as [string, string];

const openState: LifecycleBoardState = {
  ask: "waiting",
  questions: questionsOf(lifecycleBoardDocument).map(({ id, rev }) => ({
    itemId: id,
    rev,
    state: "open",
  })) as unknown as LifecycleBoardState["questions"],
};

const setUp = () => {
  const values = createDraftStore();
  const board = createBoardDraft("immediate");
  return { values, board };
};

describe("numbers in the draft record", () => {
  test("a board that holds none writes none, as before", () => {
    const { board } = setUp();
    expect(draftRecordOf(lifecycleBoardDocument, new Map(), board.get())).toEqual({
      delivery: "immediate",
      questions: {},
    });
  });

  test("writes the numbers of the questions on the board and the next number never given", () => {
    const { board } = setUp();
    board.setNumbers({
      byId: new Map([
        [first, 1],
        [second, 2],
        ["gone", 3],
      ]),
      next: 5,
    });
    expect(draftRecordOf(lifecycleBoardDocument, new Map(), board.get())).toEqual({
      delivery: "immediate",
      questions: {},
      numbers: { [first]: 1, [second]: 2 },
      nextNumber: 5,
    });
  });

  test("a restore reads them back, leaving out a question the board no longer holds, and keeps next", () => {
    const { values, board } = setUp();
    const record: DraftRecord = {
      delivery: "immediate",
      questions: {},
      numbers: { [first]: 1, [second]: 2, gone: 3 },
      nextNumber: 6,
    };
    restoreDraft(record, lifecycleBoardDocument, openState, values, board);
    expect([...(board.get().numbers ?? new Map())]).toEqual([
      [first, 1],
      [second, 2],
    ]);
    expect(board.get().nextNumber).toBe(6);
    expect(draftRecordOf(lifecycleBoardDocument, new Map(), board.get()).nextNumber).toBe(6);
  });

  test("a record of the previous minor has no numbers: the board gives them in board order", () => {
    const { values, board } = setUp();
    restoreDraft(
      { delivery: "immediate", questions: {} },
      lifecycleBoardDocument,
      openState,
      values,
      board,
    );
    expect(board.get().numbers).toBeUndefined();
    expect(board.get().nextNumber).toBeUndefined();
  });

  test("a restore does not drop the numbers when a later record holds none (the first mirror may come first)", () => {
    const { values, board } = setUp();
    board.setNumbers({ byId: new Map([[first, 1]]), next: 2 });
    board.setInView(first);
    expect(board.get().numbers?.get(first)).toBe(1);
    expect(board.get().inView).toBe(first);
  });

  test("numbers alone are no unsent work: the leave-page check and the copy ignore them", () => {
    expect(
      hasUnsentWork({
        delivery: "immediate",
        questions: {},
        numbers: { [first]: 1 },
        nextNumber: 2,
      }),
    ).toBe(false);
  });
});
