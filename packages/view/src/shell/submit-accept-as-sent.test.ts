import { describe, expect, test } from "bun:test";
import type { DraftRecord, LifecycleBoardState } from "@askboard/contract";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import { connectDrafts, createBoardDraft, draftRecordOf, restoreDraft } from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";
import { heldWorkOf, submitActsOf } from "./submit.ts";

// Submit sends a held "Accept as is" as an answer accepted as sent, with no values, in the order
// the user made it ready; a reload keeps the hold, and "Edit" unmarks it (accept-as-sent, design
// decision 5; view-and-widgets spec: Accept as is in All together).

const WHEN = "2026-11-16T09:00:00.000Z";
const AT = new Date(WHEN);
const TREE = { nodes: [{ id: "ux", label: "UX" }] };
const question = (id: string): ViewQuestion =>
  ({
    type: "question",
    id,
    rev: 1,
    props: {
      text: `Is ${id} right?`,
      items: [{ type: "tree", id: `${id}-tree`, props: structuredClone(TREE) }],
    },
  }) as unknown as ViewQuestion;
const document = {
  version: "1.0",
  askId: "plan-review-t2v6",
  delivery: "submitted",
  items: [question("plan"), question("roadmap"), question("budget")],
} as unknown as ViewDocument;
const NONE_REPORTED = () => undefined;

const setUp = () => {
  const values = createDraftStore();
  const board = createBoardDraft("submitted");
  connectDrafts(document, values, board);
  return { values, board };
};

describe("Submit with a held answer accepted as sent", () => {
  test("sends an answer with asSent and no values, in the order the user made it ready", () => {
    const { values, board } = setUp();
    board.edit("roadmap", 1, () => ({
      rev: 1,
      note: "Fine.",
      held: { act: "answer", order: 1, asSent: true },
    }));
    board.edit("plan", 1, () => ({ rev: 1, held: { act: "answer", order: 0, asSent: true } }));
    const held = heldWorkOf(document, board.get());
    expect(submitActsOf(held, values.record(), AT, NONE_REPORTED)).toEqual([
      { type: "answer", itemId: "plan", rev: 1, asSent: true, when: WHEN },
      { type: "answer", itemId: "roadmap", rev: 1, asSent: true, note: "Fine.", when: WHEN },
    ]);
  });

  test("beside an ordinary held answer, each as it was made ready; the derived values go with it", () => {
    const { values, board } = setUp();
    values.set("budget-tree", { nodes: [{ id: "ux", label: "Edited" }] });
    board.edit("budget", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    board.edit("plan", 1, () => ({ rev: 1, held: { act: "answer", order: 1, asSent: true } }));
    const reported = (itemId: string) =>
      itemId === "plan-tree" ? { "plan-tree.count": 1 } : undefined;
    const acts = submitActsOf(heldWorkOf(document, board.get()), values.record(), AT, reported);
    expect(acts[0]).toMatchObject({ itemId: "budget", values: expect.any(Object) });
    expect(acts[0]).not.toHaveProperty("asSent");
    expect(acts[1]).toEqual({
      type: "answer",
      itemId: "plan",
      rev: 1,
      asSent: true,
      derived: { "plan-tree.count": 1 },
      when: WHEN,
    });
  });
});

describe("the draft record of a held answer accepted as sent", () => {
  const state = {
    ask: "waiting",
    questions: ["plan", "roadmap", "budget"].map((itemId) => ({ itemId, rev: 1, state: "open" })),
  } as unknown as LifecycleBoardState;

  test("mirrors the hold with asSent, and a reload restores it", () => {
    const { values, board } = setUp();
    board.edit("plan", 1, () => ({ rev: 1, held: { act: "answer", order: 0, asSent: true } }));
    const record = draftRecordOf(document, values.record(), board.get()) as DraftRecord;
    expect(record.questions.plan).toMatchObject({
      held: { act: "answer", order: 0, asSent: true },
    });

    const reloaded = setUp();
    restoreDraft(record, document, state, reloaded.values, reloaded.board);
    expect(reloaded.board.work("plan")?.held).toEqual({ act: "answer", order: 0, asSent: true });
  });

  test("Edit unmarks it: the held answer is released, and with it asSent", () => {
    const { board } = setUp();
    board.edit("plan", 1, () => ({ rev: 1, held: { act: "answer", order: 0, asSent: true } }));
    board.edit("plan", 1, (work) => {
      const { held: _, ...rest } = work;
      return rest;
    });
    expect(board.work("plan")?.held).toBeUndefined();
  });
});
