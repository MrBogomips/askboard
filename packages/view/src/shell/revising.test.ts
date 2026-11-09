import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type CatalogComponent, register } from "../catalog/port.ts";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import { createRevisions } from "./agent-change.ts";
import { createBoardContent } from "./board-content.ts";
import { createBoardDraft } from "./board-draft.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { createReadyTracker } from "./ready-tracker.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";
import * as revising from "./revising.ts";
import { createStore } from "./store.ts";

// Which questions are under revision is one snapshot over the stores, computed once per change of
// its inputs and read by every item (reopen-start-from-answer, design decision 2; re-review 2.15
// X-1 and U-1): a keystroke costs what it did before the revision rule, and an item of another
// question follows a revision that a work-only change ends.

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const [database] = plainChoiceBoardDocument.items;
const WHEN = { when: "2026-11-08T10:00:00Z", receipt: "delivered" };

const fieldOf = (index: number): WidgetItem => ({
  type: "text-field",
  id: `f${index}`,
  props: { label: `Field ${index}` },
});

const questionOf = (index: number, items: readonly WidgetItem[]): ViewQuestion =>
  ({ ...database, id: `q${index}`, props: { text: `Question ${index}?`, items } }) as ViewQuestion;

// A board of `count` questions of one text field each, all answered, or all open.
const boardOf = (count: number, answered: boolean) => {
  const questions = Array.from({ length: count }, (_, index) =>
    questionOf(index, [fieldOf(index)]),
  );
  const document = { ...plainChoiceBoardDocument, items: questions } as unknown as ViewDocument;
  const state = {
    ask: "waiting",
    questions: questions.map((question, index) =>
      answered
        ? {
            itemId: question.id,
            rev: question.rev,
            state: "answered",
            answer: { results: { [`f${index}`]: "logged" }, ...WHEN },
          }
        : { itemId: question.id, rev: question.rev, state: "open" },
    ),
  } as unknown as LifecycleBoardState;
  return { document, state };
};

const storesOf = (document: ViewDocument, state: LifecycleBoardState) => {
  const view = createStore({ document, state });
  const revisions = createRevisions();
  revisions.record(document);
  return {
    view,
    draft: createDraftStore(),
    results: createDraftStore(),
    entries: createDraftStore(),
    cellEntries: createDraftStore(),
    board: createBoardDraft("immediate"),
    revisions,
  };
};

type Stores = ReturnType<typeof storesOf>;

// The shell's board content over the stores, with a predicate counting its calls.
const contentOver = (stores: Stores, count: { calls: number }) => {
  const predicate = (question: ViewQuestion, input: revising.RevisingInput): boolean => {
    count.calls += 1;
    return revising.questionRevising(question, input);
  };
  return createBoardContent(
    () => stores.view.get(),
    revising.createRevisingSnapshot(stores, predicate).get,
  );
};

describe("the revising set is computed once per change of its inputs", () => {
  const QUESTIONS = 1000;

  test("1,000 board reads with unchanged stores call the predicate at most once per question", () => {
    const { document, state } = boardOf(QUESTIONS, true);
    const stores = storesOf(document, state);
    const count = { calls: 0 };
    const content = contentOver(stores, count);
    for (let read = 0; read < 1000; read += 1) content(stores.draft.record());
    expect(count.calls).toBeLessThanOrEqual(QUESTIONS);
  });

  const changes: readonly (readonly [string, (stores: Stores) => void])[] = [
    ["the draft", (stores) => stores.draft.set("f0", "typed")],
    ["the results", (stores) => stores.results.set("f0", "typed")],
    ["the entries", (stores) => stores.entries.set("f0", "typed")],
    ["the cell entries", (stores) => stores.cellEntries.set("f0", new Map([["r.c", "typed"]]))],
    ["the board work", (stores) => stores.board.edit("q0", 1, (work) => ({ ...work, note: "x" }))],
    [
      "the state",
      (stores) => stores.view.set({ ...stores.view.get(), state: { ...stores.view.get().state } }),
    ],
    [
      "the document",
      (stores) =>
        stores.view.set({ ...stores.view.get(), document: { ...stores.view.get().document } }),
    ],
  ];
  for (const [name, change] of changes) {
    test(`one change of ${name} recomputes the set once, however many items read it`, () => {
      const { document, state } = boardOf(QUESTIONS, true);
      const stores = storesOf(document, state);
      const count = { calls: 0 };
      const content = contentOver(stores, count);
      content(stores.draft.record());
      const before = count.calls;
      change(stores);
      for (let read = 0; read < 200; read += 1) content(stores.draft.record());
      expect(count.calls - before).toBeLessThanOrEqual(QUESTIONS);
      expect(count.calls - before).toBeGreaterThan(0);
    });
  }

  test("a board with no answered question calls the predicate for none, at any number of reads", () => {
    const { document, state } = boardOf(QUESTIONS, false);
    const stores = storesOf(document, state);
    const count = { calls: 0 };
    const content = contentOver(stores, count);
    for (let read = 0; read < 100; read += 1) {
      stores.draft.set("f0", `typed ${read}`);
      content(stores.draft.record());
    }
    expect(count.calls).toBe(0);
  });
});

describe("the per-keystroke cost of the shell at 1,000 questions of one item", () => {
  // One keystroke: the draft changes, then every mounted item reads the board once. Before the
  // revision rule this was an identity check (about 0.1 ms in all); the walk made it seconds. The
  // bound is generous (a load spike on a busy machine stays far under it) and about two orders of
  // magnitude under the walk's figure, so it fails on a regression and never on noise.
  const BOUND_MS = 100;
  const KEYSTROKES = 5;

  for (const answered of [false, true]) {
    test(`${answered ? "answered" : "open"} questions: a keystroke stays under ${BOUND_MS} ms`, () => {
      const { document, state } = boardOf(1000, answered);
      const stores = storesOf(document, state);
      const content = createBoardContent(
        () => stores.view.get(),
        revising.createRevisingSnapshot(stores).get,
      );
      content(stores.draft.record());
      const costs: number[] = [];
      for (let key = 0; key < KEYSTROKES; key += 1) {
        const started = performance.now();
        stores.draft.set("f0", `typed ${key}`);
        for (let item = 0; item < 1000; item += 1) content(stores.draft.record());
        costs.push(performance.now() - started);
      }
      const median = [...costs].sort((a, b) => a - b)[Math.floor(KEYSTROKES / 2)] ?? Infinity;
      console.log(
        `keystroke cost, ${answered ? "answered" : "open"}: median ${median.toFixed(2)} ms`,
      );
      expect(median).toBeLessThan(BOUND_MS);
    });
  }
});

// A stub item, so that a RenderItem draws; its board read is the one under test.
const Stub: CatalogComponent = () => createElement("span", null, "stub");
register("revising-set-stub", Stub);

describe("an item follows the revising set", () => {
  test("a RenderItem reads the board's revising snapshot while it renders", () => {
    let reads = 0;
    const snapshot = {
      get: () => {
        reads += 1;
        return new Set<string>();
      },
      subscribe: () => () => {},
    };
    const stores = storesOf(boardOf(1, true).document, boardOf(1, true).state);
    const context = {
      draft: stores.draft,
      results: stores.results,
      tracker: createReadyTracker([{ questionId: "q0", itemIds: ["f0"] }], {
        onVisible: () => {},
        onFailed: () => {},
      }),
      boardContent: () => ({ items: [], draft: new Map(), shown: new Map() }),
      derived: createDerivedStore(),
      revisingSnapshot: snapshot,
    } as unknown as RenderContext;
    renderToStaticMarkup(
      createElement(RenderItem, {
        item: { type: "revising-set-stub", id: "f0", props: {} },
        component: "revising-set-stub",
        questionId: "q0",
        itemIds: ["f0"],
        context,
        disabled: false,
      }),
    );
    expect(reads).toBeGreaterThan(0);
  });

  test("a work-only change that ends a question's revision notifies the subscribers, once", () => {
    const { document, state } = boardOf(2, true);
    const stores = storesOf(document, state);
    const snapshot = revising.createRevisingSnapshot(stores);
    let notified = 0;
    const stop = snapshot.subscribe(() => {
      notified += 1;
    });
    stores.board.edit("q0", 1, (work) => ({ ...work, note: "kept" }));
    expect(snapshot.get().has("q0")).toBe(true);
    expect(notified).toBe(1);
    // A change that leaves the set as it is notifies no one.
    stores.draft.set("unrelated", "typed elsewhere");
    stores.draft.set("unrelated", undefined);
    expect(notified).toBe(1);
    stores.board.clear("q0", ["note"]);
    expect(snapshot.get().has("q0")).toBe(false);
    expect(notified).toBe(2);
    stop();
    stores.board.edit("q0", 1, (work) => ({ ...work, note: "again" }));
    expect(notified).toBe(2);
  });

  test("the board shows A's logged value again once A's revision, held by a note alone, ends", () => {
    const tree: WidgetItem = { type: "tree", id: "wbs", props: { label: "As sent" } };
    const questions = [questionOf(0, [tree]), questionOf(1, [fieldOf(1)])];
    const document = { ...plainChoiceBoardDocument, items: questions } as unknown as ViewDocument;
    const state = {
      ask: "waiting",
      questions: questions.map((question) => ({
        itemId: question.id,
        rev: question.rev,
        state: "answered",
        answer: { values: { wbs: { label: "Edited" } }, ...WHEN },
      })),
    } as unknown as LifecycleBoardState;
    const stores = storesOf(document, state);
    const snapshot = revising.createRevisingSnapshot(stores);
    const content = createBoardContent(() => stores.view.get(), snapshot.get);
    expect(content(stores.draft.record()).shown.get("wbs")).toEqual({ label: "Edited" });
    stores.board.edit("q0", 1, (work) => ({ ...work, note: "kept" }));
    expect(content(stores.draft.record()).shown.has("wbs")).toBe(false);
    stores.board.clear("q0", ["note"]);
    expect(content(stores.draft.record()).shown.get("wbs")).toEqual({ label: "Edited" });
  });
});
