import { describe, expect, test } from "bun:test";
import type { ViewQuestion } from "../view-document.ts";
import { createRevisions, shownOfBoard } from "./agent-change.ts";
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

// Work held only on items a later revision removed (document-review, task 6.18, row 9): after
// "Keep mine" the card shows revision 1, whose items hold the work, so an edit of one of them is
// a change of the work and clears the act line. Revision 2 removes `old`, a TextField.
describe("the references of work held on an earlier revision", () => {
  const withItems = (rev: number, items: readonly { id: string; type: string }[]) =>
    ({
      ...question,
      rev,
      props: { ...question.props, items: items.map((each) => ({ ...each, props: {} })) },
    }) as unknown as ViewQuestion;
  const rev1 = withItems(1, [
    { id: "keep", type: "probe" },
    { id: "old", type: "text-field" },
    { id: "typed", type: "number-field" },
  ]);
  const rev2 = withItems(2, [{ id: "keep", type: "probe" }]);
  const doc = (each: ViewQuestion) => ({ items: [each] }) as never;
  const kept = (seen: boolean) => {
    const held = stores();
    const revisions = createRevisions();
    if (seen) revisions.record(doc(rev1));
    revisions.record(doc(rev2));
    held.board.edit("q", 1, () => ({ rev: 1 }));
    return { ...held, shownOf: shownOfBoard(held.board, revisions) };
  };

  test("move when an item only revision 1 holds changes: its value, result or entry", () => {
    const held = kept(true);
    const edits: (() => void)[] = [
      () => held.draft.set("old", { x: 1 }),
      () => held.results.set("old", "text"),
      () => held.entries.set("typed", "12x"),
    ];
    for (const edit of edits) {
      const before = workRefsOf(rev2, held);
      edit();
      expect(sameRefs(before, workRefsOf(rev2, held))).toBe(false);
    }
  });

  test("with revision 1 unseen the card shows revision 2 and those items are no work", () => {
    const held = kept(false);
    const before = workRefsOf(rev2, held);
    held.results.set("old", "text");
    expect(sameRefs(before, workRefsOf(rev2, held))).toBe(true);
  });
});
