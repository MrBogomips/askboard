// The draft follows the revision the card shows (document-review, task 6.15; review S-2 of 6.14,
// Issue #93; view-and-widgets spec: The draft follows the revision the card shows; design decision
// 15): after "Keep mine" the card shows the revision the work was made on, and the draft's own
// readers (what compares, mirrors and clears the work) walk that revision's items too. Every case
// holds the user's work ONLY on items revision 2 removed (`b`, a TextField, and `c`, a NumberField
// that holds an entry), so a reader that walks the current revision's items alone sees no work.
// The agent's update runs through `applyDocumentUpdate`, the step `index.tsx` runs, so the cases
// run production's order (task 6.18; design.md, Appendix: the matrix's Entry and Cell entry columns).

import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { hasUnsentWork, unsentWorkText } from "../board-page/unsent-work.ts";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewAct } from "../view-protocol.ts";
import { createRevisions, shownOfBoard } from "./agent-change.ts";
import type { Flight } from "./answer-acts.ts";
import { createAttention } from "./attention.ts";
import { connectDrafts, createBoardDraft, draftRecordOf } from "./board-draft.ts";
import { blockedBy, dropWork } from "./card-acts.ts";
import { clearCarried } from "./carried.ts";
import { entriesWithCells } from "./cell-entries.ts";
import { applyDocumentUpdate } from "./document-update.ts";
import { createDraftStore, type DraftStore } from "./draft-store.ts";
import { answerHint, fieldBlock, holdsBlock } from "./field-block.ts";
import type { HeadingRequest } from "./heading-request.ts";
import { createReadyTracker, questionItemsOf } from "./ready-tracker.ts";
import { createStore } from "./store.ts";
import { heldWithBlock } from "./submit.ts";

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

type Options = {
  // Whether the view has seen revision 1 ("Keep mine" with no reload), else only revision 2.
  readonly seen?: boolean;
  readonly delivery?: "immediate" | "submitted";
  readonly rev1?: ViewQuestion;
  readonly rev2?: ViewQuestion;
  readonly work?: (stores: {
    results: DraftStore;
    entries: DraftStore;
    cellEntries: DraftStore;
  }) => void;
};

// The stores of a board whose user worked, on revision 1 (`work`: by default only on `b` and `c`),
// and whose document the agent's update then replaced with revision 2, through the update step.
const build = ({
  seen = true,
  delivery = "immediate",
  rev1 = REV1,
  rev2 = REV2,
  work = ({ results, entries }) => {
    results.set("b", "first");
    entries.set("c", "12x");
  },
}: Options = {}) => {
  let current = rev1;
  const draft = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const cellEntries = createDraftStore();
  const board = createBoardDraft(delivery);
  const revisions = createRevisions();
  if (seen) revisions.record(documentOf(rev1));
  const shownOf = shownOfBoard(board, revisions);
  connectDrafts(() => documentOf(current), draft, board, results, entries, cellEntries, shownOf);
  work({ results, entries, cellEntries });
  // The agent's update, then "Keep mine" (which changes none of the draft): the view's own step.
  applyDocumentUpdate(documentOf(rev1), documentOf(rev2), {
    revisions,
    draft,
    results,
    entries,
    cellEntries,
    board,
    shownOf,
    tracker: createReadyTracker(questionItemsOf(documentOf(rev1)), {
      onVisible: () => {},
      onFailed: () => {},
    }),
    attention: createAttention(documentOf(rev1), {
      ask: "waiting",
      questions: [{ itemId: "plan", rev: rev1.rev, state: "open" }],
    } as unknown as LifecycleBoardState),
    focus: createStore<HeadingRequest | undefined>(undefined),
    removed: createStore(false),
    focused: () => undefined,
  });
  current = rev2;
  const record = () =>
    draftRecordOf(
      documentOf(current),
      draft.record(),
      board.get(),
      results.record(),
      entries.record(),
      cellEntries.record(),
      shownOf,
    );
  return {
    draft,
    results,
    entries,
    cellEntries,
    board,
    revisions,
    shownOf,
    record,
    document: documentOf(rev2),
  };
};

const setUp = (seen = true, delivery: "immediate" | "submitted" = "immediate") =>
  build({ seen, delivery });

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
    expect(stores.entries.valueOf("c")).toBeUndefined();
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
      stores.cellEntries,
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
      cellEntries: stores.cellEntries,
      board: stores.board,
      shownOf: stores.shownOf,
    });
    expect(stores.results.valueOf("b")).toBeUndefined();
    expect(stores.draft.valueOf("b")).toBeUndefined();
    expect(stores.entries.valueOf("c")).toBeUndefined();
    expect(stores.board.work("plan")).toBeUndefined();
  });
});

// Entries and cell entries (task 6.18; the matrix's Entry and Cell entry columns, rows R and P).
// Revision 1 holds a NumberField `c` and a Table `t`; the user's work is only the entry "12x" on
// `c` and the cell entry "abc" on the Table's number cell `r1.rate`.
const table = (columnType: string): WidgetItem =>
  ({
    type: "table",
    id: "t",
    props: {
      label: "t",
      columns: [{ field: "rate", type: columnType, label: "Rate" }],
      rows: [{ id: "r1", rate: 1 }],
    },
  }) as unknown as WidgetItem;
const ENTRY_REV1 = questionOf(
  [item("a", "text-field"), item("c", "number-field"), table("number")],
  1,
);
const typedWork = ({ entries, cellEntries }: { entries: DraftStore; cellEntries: DraftStore }) => {
  entries.set("c", "12x");
  cellEntries.set("t", new Map([["r1.rate", "abc"]]));
};
const typedStores = (rev2: ViewQuestion = REV2, seen = true, delivery?: "submitted") =>
  build({ rev1: ENTRY_REV1, rev2, work: typedWork, seen, ...(delivery ? { delivery } : {}) });
const typedOf = (stores: ReturnType<typeof build>) =>
  entriesWithCells(stores.entries.record(), stores.cellEntries.record());
const NONE = new Map<string, unknown>();

describe("an entry on an item revision 2 removed (task 6.18, rows 7, 8, 4 and 5)", () => {
  test("a field entry and a cell entry stay held across the update", () => {
    const stores = typedStores();
    expect(stores.entries.valueOf("c")).toBe("12x");
    expect(stores.cellEntries.valueOf("t")).toEqual(new Map([["r1.rate", "abc"]]));
    expect(stores.board.work("plan")).toEqual({ rev: 1 });
    expect(stores.shownOf(REV2)).toBe(ENTRY_REV1);
  });

  test("they are mirrored under revision 1, with the cell entries of the Table", () => {
    const stores = typedStores();
    expect(stores.record().questions).toEqual({
      plan: { rev: 1, entries: { c: "12x" }, cellEntries: { t: { "r1.rate": "abc" } } },
    });
  });

  test("they block Answer, the hint, the press and Submit by revision 1's items, until corrected", () => {
    const stores = typedStores(REV2, true, "submitted");
    const shown = stores.shownOf(REV2);
    const held = [
      { question: REV2, work: { rev: 1, held: { act: "answer" as const, order: 0 } } },
    ] as unknown as Parameters<typeof heldWithBlock>[1];
    expect(fieldBlock(shown, typedOf(stores), NONE)?.itemId).toBe("c");
    expect(holdsBlock(shown, typedOf(stores), NONE)).toBe(true);
    expect(answerHint(shown, typedOf(stores), NONE, "en-US")).toBe("Correct c first.");
    const context = {
      results: stores.results,
      entries: stores.entries,
      cellEntries: stores.cellEntries,
      shownOf: stores.shownOf,
    };
    expect(blockedBy(REV2, context)).toBe(true);
    expect(
      heldWithBlock(
        stores.document,
        held,
        typedOf(stores),
        NONE,
        undefined,
        undefined,
        stores.shownOf,
      ),
    ).toBe(REV2);
    // The field is corrected: the Table's cell blocks next, by its own label.
    stores.entries.set("c", undefined);
    expect(answerHint(shown, typedOf(stores), NONE, "en-US")).toBe("Correct t first.");
    expect(blockedBy(REV2, context)).toBe(true);
    stores.cellEntries.set("t", undefined);
    expect(holdsBlock(shown, typedOf(stores), NONE)).toBe(false);
    expect(blockedBy(REV2, context)).toBe(false);
    expect(
      heldWithBlock(
        stores.document,
        held,
        typedOf(stores),
        NONE,
        undefined,
        undefined,
        stores.shownOf,
      ),
    ).toBeUndefined();
  });

  test("a NumberField revision 2 turns into a TextField under the same ID keeps its entry", () => {
    const stores = typedStores(
      questionOf([item("a", "text-field"), item("c", "text-field"), table("number")], 2),
    );
    expect(stores.entries.valueOf("c")).toBe("12x");
    expect(answerHint(stores.shownOf(REV2), typedOf(stores), NONE, "en-US")).toBe(
      "Correct c first.",
    );
  });

  test("a Table whose column revision 2 changes keeps its cell entries", () => {
    const stores = typedStores(
      questionOf([item("a", "text-field"), item("c", "number-field"), table("text")], 2),
    );
    expect(stores.cellEntries.valueOf("t")).toEqual(new Map([["r1.rate", "abc"]]));
    expect(stores.record().questions.plan?.cellEntries).toEqual({ t: { "r1.rate": "abc" } });
  });

  test("'Reload' drops them", () => {
    const stores = typedStores();
    dropWork(REV2, { ...stores, shownOf: stores.shownOf });
    expect(stores.entries.valueOf("c")).toBeUndefined();
    expect(stores.cellEntries.valueOf("t")).toBeUndefined();
    expect(stores.board.work("plan")).toBeUndefined();
  });

  test("a settled answer naming revision 1 clears them (M4: the cell entries of the shown question)", () => {
    const stores = typedStores();
    clearCarried(
      {
        key: 1,
        acts: [
          { type: "answer", itemId: "plan", rev: 1, when: "2026-11-08T10:00:00Z" },
        ] as unknown as readonly ViewAct[],
      },
      stores.document,
      stores.draft,
      stores.results,
      stores.entries,
      stores.cellEntries,
      stores.board,
      createStore(new Map()),
      stores.revisions,
    );
    expect(stores.entries.valueOf("c")).toBeUndefined();
    expect(stores.cellEntries.valueOf("t")).toBeUndefined();
    expect(stores.record().questions).toEqual({});
  });

  test("with revision 1 unseen (a page reload) the update drops them and leaves no work", () => {
    const stores = typedStores(REV2, false);
    expect(stores.entries.valueOf("c")).toBeUndefined();
    expect(stores.cellEntries.valueOf("t")).toBeUndefined();
    expect(stores.board.work("plan")).toBeUndefined();
    expect(stores.record().questions).toEqual({});
  });

  test("an entry on an item both revisions hold is kept by either rule", () => {
    const stores = build({
      rev1: ENTRY_REV1,
      rev2: questionOf([item("a", "text-field"), item("c", "number-field"), table("number")], 2),
      work: typedWork,
      seen: false,
    });
    expect(stores.entries.valueOf("c")).toBe("12x");
    expect(stores.cellEntries.valueOf("t")).toEqual(new Map([["r1.rate", "abc"]]));
  });
});
