// The document part of the view's update step (document-review, task 6.18; design decision 15):
// the order `index.tsx` runs, which the draft's unit tests also run. A question the agent deleted
// leaves with its draft, the question in view and the focus move on, and the revisions, the ready
// tracker and the attention hear of the new document.

import { describe, expect, mock, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import { createRevisions, shownOfBoard } from "./agent-change.ts";
import { createAttention } from "./attention.ts";
import { connectDrafts, createBoardDraft, moveMarks } from "./board-draft.ts";
import { applyDocumentUpdate } from "./document-update.ts";
import { createDraftStore } from "./draft-store.ts";
import type { HeadingRequest } from "./heading-request.ts";
import { createStore } from "./store.ts";

const [first] = plainChoiceBoardDocument.items;
const questionOf = (id: string, rev = 1): ViewQuestion =>
  ({
    ...first,
    id,
    rev,
    props: { ...first?.props, text: id, options: [{ label: "Yes" }], items: [] },
  }) as unknown as ViewQuestion;
const documentOf = (...questions: readonly ViewQuestion[]): ViewDocument =>
  ({ ...plainChoiceBoardDocument, items: questions }) as unknown as ViewDocument;
const stateOf = (document: ViewDocument): LifecycleBoardState =>
  ({
    ask: "waiting",
    questions: (document.items as readonly ViewQuestion[]).map((question) => ({
      itemId: question.id,
      rev: question.rev,
      state: "open",
    })),
  }) as unknown as LifecycleBoardState;

const setUp = (before: ViewDocument, focused?: string) => {
  const draft = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const cellEntries = createDraftStore();
  const board = createBoardDraft("submitted");
  const revisions = createRevisions();
  revisions.record(before);
  const include = mock(() => {});
  const focus = createStore<HeadingRequest | undefined>(undefined);
  const removed = createStore(false);
  const stores = {
    revisions,
    draft,
    results,
    entries,
    cellEntries,
    board,
    shownOf: shownOfBoard(board, revisions),
    tracker: { include },
    attention: createAttention(before, stateOf(before)),
    focus,
    removed,
    focused: () => focused,
  };
  return { ...stores, include };
};

describe("the update step for a new document", () => {
  const plan = questionOf("plan");
  const other = questionOf("other");
  const third = questionOf("third");

  test("records the new revision, reconciles the tracker and tells the attention", () => {
    const before = documentOf(plan, other);
    const stores = setUp(before);
    const revised = questionOf("other", 2);
    const after = documentOf(plan, revised, third);
    applyDocumentUpdate(before, after, stores);
    expect(stores.revisions.question("other", 2)).toBe(revised);
    expect(stores.include).toHaveBeenCalledTimes(1);
    expect(stores.attention.get().unseen.has("third")).toBe(true);
    expect(stores.removed.get()).toBe(false);
  });

  test("a deleted question leaves with its draft; the question in view and the focus move on", () => {
    const before = documentOf(plan, other, third);
    const stores = setUp(before, "other");
    stores.draft.set("other", ["Yes"]);
    stores.board.setInView("other");
    stores.board.edit("other", 1, (work) => ({ ...work, note: "n" }));
    applyDocumentUpdate(before, documentOf(plan, third), stores);
    expect(stores.draft.valueOf("other")).toBeUndefined();
    expect(stores.board.work("other")).toBeUndefined();
    expect(stores.board.get().inView).toBe("third");
    expect(stores.removed.get()).toBe(true);
    expect(stores.focus.get()).toEqual({ id: "third", n: 1 });
  });

  test("a deleted question out of view and out of focus leaves the view and the focus alone", () => {
    const before = documentOf(plan, other, third);
    const stores = setUp(before, "plan");
    stores.board.setInView("plan");
    applyDocumentUpdate(before, documentOf(plan, third), stores);
    expect(stores.board.get().inView).toBe("plan");
    expect(stores.removed.get()).toBe(false);
    expect(stores.focus.get()).toBeUndefined();
  });

  test("the last question gone leaves no question to focus", () => {
    const before = documentOf(plan);
    const stores = setUp(before, "plan");
    stores.board.setInView("plan");
    applyDocumentUpdate(before, documentOf(questionOf("fresh")), stores);
    expect(stores.board.get().inView).toBeUndefined();
    expect(stores.focus.get()).toBeUndefined();
  });
});

describe("a reopened draft whose only work is an entry on a removed item", () => {
  for (const prefilled of [false, true]) {
    test(`keeps the entry and its notice across the update and later pruning (prefilled ${prefilled})`, () => {
      const question = {
        ...questionOf("plan"),
        props: {
          ...questionOf("plan").props,
          items: [{ type: "number-field", id: "amount", props: { label: "Amount" } }],
        },
      } as ViewQuestion;
      const before = documentOf(question);
      const stores = setUp(before);
      let document = before;
      connectDrafts(
        () => document,
        stores.draft,
        stores.board,
        stores.results,
        stores.entries,
        stores.cellEntries,
        stores.revisions,
        stores.shownOf,
      );
      stores.entries.set("amount", "12x");
      if (prefilled) stores.board.edit("plan", 1, (work) => ({ ...work, prefilled: true }));
      const revised = questionOf("plan", 2);
      const after = documentOf(revised);
      applyDocumentUpdate(before, after, stores);
      moveMarks(
        after,
        stores.draft.record(),
        stores.board,
        stores.results.record(),
        stores.entries.record(),
        stores.revisions,
        stores.shownOf,
      );
      document = after;
      stores.board.setDelivery("immediate");
      expect(stores.entries.valueOf("amount")).toBe("12x");
      expect(stores.board.work("plan")?.rev).toBe(1);
      expect(stores.shownOf(revised)).toBe(question);
      stores.entries.set("amount", undefined);
      expect(stores.board.work("plan")).toEqual(
        prefilled ? { rev: 2, prefilled: true } : undefined,
      );
    });
  }
});
