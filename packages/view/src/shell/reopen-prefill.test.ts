import { describe, expect, test } from "bun:test";
import type { DraftRecord, LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import { changePending, createRevisions, workingQuestion } from "./agent-change.ts";
import {
  connectDrafts,
  createBoardDraft,
  draftRecordOf,
  moveMarks,
  restoreDraft,
} from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";
import { prefillReopened, reopenPrefills } from "./reopen-prefill.ts";

// View-and-widgets: A reopened question starts from the previous answer; The prefill is remembered
// (reopen-start-from-answer, design decisions 3 and 4). The pure function says which questions to
// fill; `prefillReopened` fills them, once, and marks the work.

const timeline: WidgetItem = { type: "timeline", id: "roadmap", props: { lanes: [] } };
const kanban: WidgetItem = { type: "kanban", id: "board", props: { cards: [] } };
const [base] = plainChoiceBoardDocument.items;
const REV = 2;
const question: ViewQuestion = {
  ...(base as unknown as ViewQuestion),
  rev: REV,
  props: { ...(base as unknown as ViewQuestion).props, items: [timeline, kanban] },
};
const document = { ...plainChoiceBoardDocument, items: [question] } as unknown as ViewDocument;

const moved = { moved: "checkout" };
const cards = { cards: ["a"] };
const previous = {
  choice: ["SQLite"],
  values: { roadmap: moved, board: cards },
  unchanged: ["database", "roadmap", "board"],
  when: "2026-11-08T10:00:00Z",
  receipt: "delivered" as const,
};

const stateOf = (
  status: Record<string, unknown> = { state: "open", previous },
): LifecycleBoardState =>
  ({
    ask: "waiting",
    questions: [{ itemId: "database", rev: REV, ...status }],
  }) as unknown as LifecycleBoardState;

const facts = () => ({
  fits: () => true,
  valueFits: (value: unknown) => (value as { refuse?: boolean }).refuse !== true,
});

const setUp = () => {
  const draft = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const cellEntries = createDraftStore();
  const board = createBoardDraft("immediate");
  connectDrafts(document, draft, board, results, entries, cellEntries);
  const stores = { draft, results, entries, cellEntries, board, facts };
  const record = () =>
    draftRecordOf(
      document,
      draft.record(),
      board.get(),
      results.record(),
      entries.record(),
      cellEntries.record(),
    );
  const pure = (state: LifecycleBoardState = stateOf()) =>
    reopenPrefills(
      document,
      state,
      { values: draft.record(), results: results.record(), entries: entries.record() },
      (id) => board.work(id),
    );
  return { ...stores, record, pure };
};

describe("which questions a reopen prefills (the pure function)", () => {
  test("an open reopened question whose previous answer holds it unchanged, with no work", () => {
    expect(setUp().pure()).toEqual([question]);
  });

  test("a postponed one qualifies too", () => {
    expect(setUp().pure(stateOf({ state: "postponed", previous }))).toEqual([question]);
  });

  test("not a question the previous answer does not list as unchanged", () => {
    const { pure } = setUp();
    const others = { ...previous, unchanged: ["roadmap", "board"] };
    expect(pure(stateOf({ state: "open", previous: others }))).toEqual([]);
  });

  test("not a previous answer without the list, or with an empty one", () => {
    const { pure } = setUp();
    const { unchanged: _list, ...without } = previous;
    expect(pure(stateOf({ state: "open", previous: without }))).toEqual([]);
    expect(pure(stateOf({ state: "open", previous: { ...previous, unchanged: [] } }))).toEqual([]);
  });

  test("not a question holding work on its current revision, or on any other", () => {
    const { board, pure } = setUp();
    board.edit("database", REV, (work) => ({ ...work, note: "typed" }));
    expect(pure()).toEqual([]);
    board.forget("database");
    board.edit("database", REV - 1, (work) => ({ ...work, note: "older" }));
    expect(pure()).toEqual([]);
  });

  test("not a question holding a value or a result in the stores, whatever its work says", () => {
    const none = new Map<string, unknown>();
    const some = new Map<string, unknown>([["roadmap", moved]]);
    const read = (values: Map<string, unknown>, results: Map<string, unknown>) =>
      reopenPrefills(document, stateOf(), { values, results, entries: none }, () => undefined);
    expect(read(none, none)).toEqual([question]);
    expect(read(some, none)).toEqual([]);
    expect(read(none, some)).toEqual([]);
  });

  test("not a question whose work holds the mark", () => {
    const { board, pure } = setUp();
    board.edit("database", REV, (work) => ({ ...work, prefilled: true }));
    expect(pure()).toEqual([]);
  });

  test("not a declined previous answer", () => {
    const { pure } = setUp();
    const declined = { ...previous, declined: true };
    expect(pure(stateOf({ state: "open", previous: declined }))).toEqual([]);
  });

  test("not an answered question, nor one with no previous answer", () => {
    const { pure } = setUp();
    expect(pure(stateOf({ state: "answered", answer: previous, previous }))).toEqual([]);
    expect(pure(stateOf({ state: "open" }))).toEqual([]);
  });

  test("not on a closed ask, nor under a lock of closed, discarded or moved (X-2 of review 2.5)", () => {
    const { board, draft, results, entries, pure } = setUp();
    const closed = { ...stateOf(), ask: "closed" } as unknown as LifecycleBoardState;
    expect(pure(closed)).toEqual([]);
    expect(pure(stateOf())).toEqual([question]);
    const held = { values: draft.record(), results: results.record(), entries: entries.record() };
    for (const lock of ["closed", "discarded", "moved"] as const) {
      expect(reopenPrefills(document, stateOf(), held, (id) => board.work(id), lock)).toEqual([]);
    }
  });

  test("a previous answer is read as the previous one: the current role never applies", () => {
    const { pure } = setUp();
    const { unchanged: _list, ...without } = previous;
    expect(pure(stateOf({ state: "postponed", previous: without }))).toEqual([]);
  });
});

describe("filling a reopened question once", () => {
  test("the choice and both values enter the draft, the work is marked, and the record mirrors the mark", () => {
    const run = setUp();
    prefillReopened(document, stateOf(), run);
    expect(run.draft.valueOf("database")).toEqual(["SQLite"]);
    expect(run.draft.valueOf("roadmap")).toEqual(moved);
    expect(run.draft.valueOf("board")).toEqual(cards);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
    expect(run.record().questions.database).toEqual({
      rev: REV,
      prefilled: true,
      values: { database: ["SQLite"], roadmap: moved, board: cards },
    });
  });

  test("a second state fills nothing more, whatever the user did with the first fill", () => {
    const run = setUp();
    prefillReopened(document, stateOf(), run);
    run.draft.set("roadmap", undefined);
    run.draft.set("board", undefined);
    run.draft.set("database", undefined);
    const record = run.record();
    prefillReopened(document, stateOf(), run);
    expect(run.record()).toEqual(record);
    expect(run.draft.record().size).toBe(0);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
  });

  test("a part that does not fit fills nothing and sets no mark, the same on the next state", () => {
    const run = setUp();
    const refused = { ...previous, values: { roadmap: { refuse: true }, board: cards } };
    const state = stateOf({ state: "open", previous: refused });
    prefillReopened(document, state, run);
    expect(run.draft.record().size).toBe(0);
    expect(run.board.work("database")).toBeUndefined();
    prefillReopened(document, state, run);
    expect(run.draft.record().size).toBe(0);
    expect(run.board.work("database")).toBeUndefined();
  });

  test("a value of an item the question no longer holds fills nothing", () => {
    const run = setUp();
    const gone = { ...previous, values: { roadmap: moved, gone: cards } };
    prefillReopened(document, stateOf({ state: "open", previous: gone }), run);
    expect(run.draft.record().size).toBe(0);
    expect(run.board.work("database")).toBeUndefined();
  });

  test("a closed ask, or a lock, fills nothing and sets no mark", () => {
    const closedRun = setUp();
    const closed = { ...stateOf(), ask: "closed" } as unknown as LifecycleBoardState;
    prefillReopened(document, closed, closedRun);
    expect(closedRun.draft.record().size).toBe(0);
    expect(closedRun.board.work("database")).toBeUndefined();
    const locked = setUp();
    prefillReopened(document, stateOf(), locked, "closed");
    expect(locked.draft.record().size).toBe(0);
    expect(locked.board.work("database")).toBeUndefined();
  });

  test("a question not in the list is left as the agent sent it", () => {
    const run = setUp();
    const others = { ...previous, unchanged: ["roadmap", "board"] };
    prefillReopened(document, stateOf({ state: "open", previous: others }), run);
    expect(run.draft.record().size).toBe(0);
    expect(run.board.work("database")).toBeUndefined();
  });

  test("the dry run changes nothing when it refuses: the stores and the work stay as they were", () => {
    const run = setUp();
    run.results.set("roadmap", { kept: true });
    const refused = { ...previous, values: { roadmap: { refuse: true } } };
    prefillReopened(document, stateOf({ state: "open", previous: refused }), run);
    expect(run.results.valueOf("roadmap")).toEqual({ kept: true });
  });
});

// The order the shell runs them in: its restore, then the prefill (design decisions 3 and 9).
describe("after a restore, as the shell runs them", () => {
  const restored = (record: DraftRecord) => {
    const run = setUp();
    restoreDraft(
      record,
      document,
      stateOf(),
      run.draft,
      run.board,
      run.results,
      undefined,
      run.entries,
      run.cellEntries,
    );
    return run;
  };

  test("a restore holding work on the current revision: nothing is filled, the restored work stands", () => {
    const run = restored({
      delivery: "immediate",
      questions: { database: { rev: REV, values: { database: ["PostgreSQL"] } } },
    });
    prefillReopened(document, stateOf(), run);
    expect(run.draft.valueOf("database")).toEqual(["PostgreSQL"]);
    expect(run.draft.record().size).toBe(1);
    expect(run.board.work("database")?.prefilled).toBeUndefined();
  });

  test("a restore holding the mark alone: nothing is filled, the mark stands", () => {
    const run = restored({
      delivery: "immediate",
      questions: { database: { rev: REV, prefilled: true } },
    });
    prefillReopened(document, stateOf(), run);
    expect(run.draft.record().size).toBe(0);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
  });

  test("a restore holding a stale mark: the question is filled again", () => {
    const run = restored({
      delivery: "immediate",
      questions: { database: { rev: REV - 1, prefilled: true } },
    });
    prefillReopened(document, stateOf(), run);
    expect(run.draft.valueOf("roadmap")).toEqual(moved);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
  });

  test("a restore holding work on other questions only: the question is filled, after the restore", () => {
    const second = { ...question, id: "cache", rev: 1, props: { text: "Cache?" } };
    const both = { ...document, items: [question, second] } as unknown as ViewDocument;
    const run = setUp();
    connectDrafts(both, run.draft, run.board, run.results, run.entries, run.cellEntries);
    const state = {
      ask: "waiting",
      questions: [
        { itemId: "database", rev: REV, state: "open", previous },
        { itemId: "cache", rev: 1, state: "open" },
      ],
    } as unknown as LifecycleBoardState;
    restoreDraft(
      { delivery: "submitted", questions: { cache: { rev: 1, note: "typed" } } },
      both,
      state,
      run.draft,
      run.board,
      run.results,
      undefined,
      run.entries,
      run.cellEntries,
    );
    prefillReopened(both, state, run);
    expect(run.board.work("cache")).toEqual({ rev: 1, note: "typed" });
    expect(run.draft.valueOf("roadmap")).toEqual(moved);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
  });
});

// The mark alone is no unsent work (design decision 4): when the agent moves the question past a
// work that holds nothing but the mark, the mark moves to the new revision, so the card shows the
// agent's change at once with no notice, and the question is never filled again (S-1 of review 4.3).
describe("a prefill undone by hand, then the agent changes the question (S-1 of review 4.3)", () => {
  const NEXT = REV + 1;
  const renamed = { ...timeline, props: { lanes: [{ id: "web", label: "Website" }] } };
  const later: ViewQuestion = {
    ...question,
    rev: NEXT,
    props: { ...question.props, items: [renamed, kanban] },
  };
  const laterDocument = { ...document, items: [later] } as unknown as ViewDocument;
  const laterState = stateOf({ state: "open", previous });
  const kept = new Map();

  const undone = () => {
    const run = setUp();
    prefillReopened(document, stateOf(), run);
    run.draft.set("roadmap", undefined);
    run.draft.set("board", undefined);
    run.draft.set("database", undefined);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
    return run;
  };
  const move = (run: ReturnType<typeof setUp>) =>
    moveMarks(
      laterDocument,
      run.draft.record(),
      run.board,
      run.results.record(),
      run.entries.record(),
    );

  test("the mark moves to the new revision, so no notice is pending and the card shows the revision", () => {
    const run = undone();
    expect(changePending(later, run.board.work("database"), kept)).toBe(true);
    move(run);
    const work = run.board.work("database");
    expect(work).toEqual({ rev: NEXT, prefilled: true });
    expect(changePending(later, work, kept)).toBe(false);
    const revisions = createRevisions();
    revisions.record(document);
    revisions.record(laterDocument);
    expect(workingQuestion(later, work, revisions)).toBe(later);
  });

  test("the work is not forgotten: equal props at the new revision are not filled again", () => {
    const run = undone();
    move(run);
    prefillReopened(laterDocument, laterState, run);
    expect(run.draft.record().size).toBe(0);
    expect(run.board.work("database")).toEqual({ rev: NEXT, prefilled: true });
  });

  test("work that holds a value is real work: the mark stays on its revision and the notice is pending", () => {
    const run = undone();
    run.draft.set("roadmap", moved);
    move(run);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
    expect(changePending(later, run.board.work("database"), kept)).toBe(true);
  });

  test("work that holds more than the mark stays on its revision", () => {
    const run = undone();
    run.board.edit("database", REV, (work) => ({ ...work, note: "typed" }));
    move(run);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true, note: "typed" });
  });

  test("a question at its work's revision, or with no work, is left alone", () => {
    const run = setUp();
    moveMarks(document, run.draft.record(), run.board);
    expect(run.board.work("database")).toBeUndefined();
    prefillReopened(document, stateOf(), run);
    moveMarks(document, run.draft.record(), run.board);
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
  });

  test("the user undoing the last value on a card still showing the earlier revision moves the mark too", () => {
    let shown = document;
    const run = setUp();
    connectDrafts(() => shown, run.draft, run.board, run.results, run.entries, run.cellEntries);
    prefillReopened(document, stateOf(), run);
    shown = laterDocument;
    move(run);
    // The prefilled values are held: the work stays on its revision, and the notice counts them.
    expect(run.board.work("database")).toEqual({ rev: REV, prefilled: true });
    run.draft.set("roadmap", undefined);
    run.draft.set("board", undefined);
    run.draft.set("database", undefined);
    expect(run.board.work("database")).toEqual({ rev: NEXT, prefilled: true });
  });
});

// The shell's wiring is read from its source: `index.tsx` boots on import, so no unit test runs it.
describe("the shell's calls (design decisions 3, 4 and 9)", () => {
  const source = async (name: string): Promise<string> =>
    Bun.file(new URL(name, import.meta.url)).text();

  test("the prefill runs inside the update handler, after the restore, and nowhere else", async () => {
    const text = await source("./index.tsx");
    const handler = text.indexOf("channel.onUpdate(");
    const restore = text.indexOf("restoreDraft(", handler);
    const prefill = text.indexOf("prefillReopened(");
    expect(handler).toBeGreaterThan(0);
    expect(restore).toBeGreaterThan(handler);
    expect(prefill).toBeGreaterThan(restore);
    expect(text.indexOf("prefillReopened(", prefill + 1)).toBe(-1);
    // No call before the handler, so the boot data alone fills nothing (a Snapshot has only that).
    expect(text.slice(0, handler)).not.toContain("prefillReopened(");
    expect(text.slice(0, handler)).not.toContain("reopenPrefills(");
  });

  test("the mark moves past an agent change inside the update handler, with the update's document, before the view takes it (S-1 of review 4.3)", async () => {
    const text = await source("./index.tsx");
    const handler = text.indexOf("channel.onUpdate(");
    const move = text.indexOf("moveMarks(", handler);
    const set = text.indexOf("view.set({ document", handler);
    expect(move).toBeGreaterThan(handler);
    expect(set).toBeGreaterThan(move);
    expect(text.indexOf("moveMarks(", move + 1)).toBe(-1);
    const call = text.slice(move, text.indexOf(");", move));
    expect(call).toContain("document,");
  });

  test("the update's lock goes to the prefill, so a read-only card is never filled (X-2 of review 2.5)", async () => {
    const text = await source("./index.tsx");
    const call = text.slice(text.indexOf("prefillReopened("));
    expect(call.slice(0, call.indexOf(");"))).toContain("update.lock");
  });

  test("an answer or a decline that settles takes the mark with the rest of its work", async () => {
    const text = await source("./index.tsx");
    const carried = text.slice(text.indexOf("const CARRIED"), text.indexOf("const clearCarried"));
    for (const act of ["answer", "decline"]) {
      const line = carried.split("\n").find((each) => each.trim().startsWith(`${act}:`)) ?? "";
      expect(line).toContain('"prefilled"');
    }
  });
});
