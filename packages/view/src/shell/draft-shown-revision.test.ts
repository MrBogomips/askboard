// The draft follows the revision the card shows (document-review, task 6.15; review S-2 of 6.14,
// Issue #93; view-and-widgets spec: The draft follows the revision the card shows; design decision
// 15): after "Keep mine" the card shows the revision the work was made on, and the draft's own
// readers (what compares, mirrors and clears the work) walk that revision's items too. Every case
// holds the user's work ONLY on items revision 2 removed (`b`, a TextField, and `c`, a NumberField
// that holds an entry), so a reader that walks the current revision's items alone sees no work.

import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { hasUnsentWork, unsentWorkText } from "../board-page/unsent-work.ts";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewAct } from "../view-protocol.ts";
import { createRevisions, shownOfBoard } from "./agent-change.ts";
import type { Flight } from "./answer-acts.ts";
import { connectDrafts, createBoardDraft, draftRecordOf } from "./board-draft.ts";
import { dropWork } from "./card-acts.ts";
import { clearCarried } from "./carried.ts";
import { createDraftStore } from "./draft-store.ts";
import { createStore } from "./store.ts";

const [first] = plainChoiceBoardDocument.items;
const item = (id: string, type: string): WidgetItem =>
  ({ type, id, props: { label: id } }) as unknown as WidgetItem;
const questionOf = (items: readonly WidgetItem[], rev: number): ViewQuestion =>
  ({
    ...first,
    id: "plan",
    rev,
    props: { ...first.props, text: "Plan?", options: [{ label: "Yes" }, { label: "No" }], items },
  }) as unknown as ViewQuestion;
const documentOf = (question: ViewQuestion): ViewDocument =>
  ({ ...plainChoiceBoardDocument, items: [question] }) as unknown as ViewDocument;

// Revision 1 holds `a`, `b` and `c`; revision 2, the agent's update, removes `b` and `c`.
const REV1 = questionOf(
  [item("a", "text-field"), item("b", "text-field"), item("c", "number-field")],
  1,
);
const REV2 = questionOf([item("a", "text-field")], 2);

// The stores of a board whose document is on revision 2 and whose user worked, on revision 1,
// only on `b` and `c`; the view has seen both revisions when `seen` ("Keep mine" with no reload),
// else only revision 2 (a reload).
const setUp = (seen = true, delivery: "immediate" | "submitted" = "immediate") => {
  let current = REV1;
  const draft = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const board = createBoardDraft(delivery);
  const revisions = createRevisions();
  if (seen) revisions.record(documentOf(REV1));
  const shownOf = shownOfBoard(board, revisions);
  connectDrafts(() => documentOf(current), draft, board, results, entries, undefined, shownOf);
  // The work, made on revision 1.
  results.set("b", "first");
  entries.set("c", "12x");
  // The agent's update, then "Keep mine" (which changes none of the draft).
  current = REV2;
  revisions.record(documentOf(REV2));
  const record = () =>
    draftRecordOf(
      documentOf(current),
      draft.record(),
      board.get(),
      results.record(),
      entries.record(),
      undefined,
      shownOf,
    );
  return { draft, results, entries, board, revisions, shownOf, record, document: documentOf(REV2) };
};

describe("work held only on an item a later revision removed (task 6.15, #93)", () => {
  test("the work stays on revision 1 and the card keeps showing it after an edit", () => {
    const stores = setUp();
    expect(stores.board.work("plan")).toEqual({ rev: 1 });
    stores.results.set("b", "edited");
    expect(stores.board.work("plan")).toEqual({ rev: 1 });
    expect(stores.shownOf(REV2)).toBe(REV1);
  });

  test("a change on the board (the delivery, the question in view) does not clear it", () => {
    const stores = setUp();
    stores.board.setDelivery("submitted");
    stores.board.setInView("plan");
    stores.board.edit("plan", 1, (work) => ({ ...work, composer: "Why?" }));
    stores.board.clear("plan", ["composer"]);
    expect(stores.board.work("plan")).toEqual({ rev: 1 });
    expect(stores.shownOf(REV2)).toBe(REV1);
  });

  test("an edit that empties the item takes the work back, and the card shows revision 2", () => {
    const stores = setUp();
    stores.results.set("b", undefined);
    expect(stores.board.work("plan")).toEqual({ rev: 1 });
    stores.entries.set("c", undefined);
    expect(stores.board.work("plan")).toBeUndefined();
    expect(stores.shownOf(REV2)).toBe(REV2);
  });

  test("the draft record mirrors it under revision 1: results, values and entries", () => {
    const stores = setUp();
    stores.results.set("b", "edited");
    stores.draft.set("b", { size: 3 });
    expect(stores.record().questions).toEqual({
      plan: {
        rev: 1,
        values: { b: { size: 3 } },
        results: { b: "edited" },
        entries: { c: "12x" },
      },
    });
  });

  test("the leave-page prompt and 'Copy my unsent work' count it", () => {
    const stores = setUp();
    const record = stores.record();
    expect(hasUnsentWork(record)).toBe(true);
    const text = unsentWorkText(stores.document, record);
    expect(text).toContain('b: "first"');
    expect(text).toContain('c: "12x"');
  });

  test("in submitted delivery an edit releases the ready mark, as an edit of any item does", () => {
    const stores = setUp(true, "submitted");
    stores.board.edit("plan", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    expect(stores.board.work("plan")?.held).toEqual({ act: "answer", order: 0 });
    stores.results.set("b", "edited");
    expect(stores.board.work("plan")).toEqual({ rev: 1 });
  });

  test("an entry edit releases it too", () => {
    const stores = setUp(true, "submitted");
    stores.board.edit("plan", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    stores.entries.set("c", "13x");
    expect(stores.board.work("plan")?.held).toBeUndefined();
  });

  test("an edit of an item revision 2 keeps releases the mark, as before", () => {
    const stores = setUp(true, "submitted");
    stores.board.edit("plan", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    stores.results.set("a", "A");
    expect(stores.board.work("plan")?.held).toBeUndefined();
  });

  test("with revision 1 unseen (a reload) the card shows revision 2 and the removed items are no work", () => {
    const stores = setUp(false);
    expect(stores.shownOf(REV2)).toBe(REV2);
    expect(stores.record().questions).toEqual({});
    stores.board.setDelivery("submitted");
    expect(stores.board.work("plan")).toBeUndefined();
  });
});

describe("what a settled act or a drop clears follows the revision too", () => {
  const answered = (type: "answer" | "decline", rev: number): Flight => ({
    key: 1,
    acts: [
      type === "answer"
        ? { type: "answer", itemId: "plan", rev, when: "2026-11-08T10:00:00Z" }
        : { type: "decline", itemId: "plan", rev, when: "2026-11-08T10:00:00Z" },
    ] as unknown as readonly ViewAct[],
  });
  const clear = (stores: ReturnType<typeof setUp>, flight: Flight) =>
    clearCarried(
      flight,
      stores.document,
      stores.draft,
      stores.results,
      stores.entries,
      createDraftStore(),
      stores.board,
      createStore(new Map()),
      stores.revisions,
    );

  for (const type of ["answer", "decline"] as const) {
    test(`a settled ${type} naming revision 1 takes the removed items' work with it`, () => {
      const stores = setUp();
      stores.draft.set("b", { size: 3 });
      stores.board.edit("plan", 1, (work) => ({ ...work, held: { act: type, order: 0 } }));
      clear(stores, answered(type, 1));
      expect(stores.results.valueOf("b")).toBeUndefined();
      expect(stores.draft.valueOf("b")).toBeUndefined();
      expect(stores.entries.valueOf("c")).toBeUndefined();
      expect(stores.board.work("plan")).toBeUndefined();
      expect(stores.record().questions).toEqual({});
    });
  }

  test("an item revision 2 keeps goes with them", () => {
    const stores = setUp();
    stores.results.set("a", "A");
    clear(stores, answered("answer", 1));
    expect(stores.results.valueOf("a")).toBeUndefined();
    expect(stores.results.valueOf("b")).toBeUndefined();
  });

  test("with revision 1 unseen the removed items are not walked, and nothing else is touched", () => {
    const stores = setUp(false);
    stores.results.set("a", "A");
    clear(stores, answered("answer", 2));
    expect(stores.results.valueOf("a")).toBeUndefined();
    expect(stores.results.valueOf("b")).toBe("first");
  });

  test("'Reload' and the deletion of the question drop the removed items' work too", () => {
    const stores = setUp();
    stores.draft.set("b", { size: 3 });
    dropWork(REV2, {
      draft: stores.draft,
      results: stores.results,
      entries: stores.entries,
      cellEntries: createDraftStore(),
      board: stores.board,
      shownOf: stores.shownOf,
    });
    expect(stores.results.valueOf("b")).toBeUndefined();
    expect(stores.draft.valueOf("b")).toBeUndefined();
    expect(stores.entries.valueOf("c")).toBeUndefined();
    expect(stores.board.work("plan")).toBeUndefined();
  });
});
