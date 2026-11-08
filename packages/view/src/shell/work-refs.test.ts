import { describe, expect, test } from "bun:test";
import type { ViewQuestion } from "../view-document.ts";
import { createBoardDraft } from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";
import { sameRefs, workRefsOf } from "./work-refs.ts";

// The references a question's work stands on (oversized-acts, design decision 2): a notice stays
// only while they are the ones it was set on.

const question = {
  id: "q",
  type: "question",
  rev: 1,
  props: {
    text: "Q",
    options: [{ label: "A" }],
    items: [
      { id: "tree", type: "probe", props: {} },
      { id: "name", type: "number-field", props: {} },
    ],
  },
} as unknown as ViewQuestion;

const stores = () => {
  const draft = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const board = createBoardDraft("immediate");
  return { draft, results, entries, board };
};

describe("the references of a question's work", () => {
  test("are the same while nothing of the question changes", () => {
    const held = stores();
    held.draft.set("q", ["A"]);
    const before = workRefsOf(question, held);
    expect(sameRefs(before, workRefsOf(question, held))).toBe(true);
  });

  test("move when its choice, an item's value, a result, an entry or its work record changes", () => {
    const held = stores();
    const edits: (() => void)[] = [
      () => held.draft.set("q", ["A"]),
      () => held.draft.set("tree", { x: 1 }),
      () => held.results.set("tree", { y: 1 }),
      () => held.entries.set("name", "12x"),
      () => held.board.edit("q", 1, () => ({ rev: 1, note: "n" })),
    ];
    for (const edit of edits) {
      const before = workRefsOf(question, held);
      edit();
      expect(sameRefs(before, workRefsOf(question, held))).toBe(false);
    }
  });

  test("do not move for another question's work", () => {
    const held = stores();
    const before = workRefsOf(question, held);
    held.draft.set("other", ["B"]);
    held.board.edit("other", 1, () => ({ rev: 1, note: "n" }));
    expect(sameRefs(before, workRefsOf(question, held))).toBe(true);
  });

  test("sameRefs compares length and each reference by identity", () => {
    expect(sameRefs([1, "a"], [1, "a"])).toBe(true);
    expect(sameRefs([1], [1, 2])).toBe(false);
    expect(sameRefs([{}], [{}])).toBe(false);
  });
});
