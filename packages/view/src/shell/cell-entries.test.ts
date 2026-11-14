// Cell entries through the port and in the shell (table-widget, task 4.2; view-and-widgets spec:
// Cell entries in the draft, An agent's change to a Table; design decision 8; review U-1; AD-10,
// AD-20): the text a Table's cell holds that gives no value is kept in its own store beside the
// draft record, apart from the item's value, mirrored under `cellEntries`, restored after a reload,
// dropped with the item's value, and never part of an answer. A restored or kept entry whose key
// names no input cell of the value held is dropped, so no entry blocks "Answer" with no cell to
// clear.

import { describe, expect, mock, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  CELL_ENTRIES_MAX,
  DRAFT_RECORD_MAX_CHARS,
  ENTRY_MAX_CHARS,
  type LifecycleBoardState,
} from "@askboard/contract";
import {
  plainChoiceBoardDocument,
  TABLE_EDITED_PROPS,
  TABLE_FIXTURE_ITEM,
  tableWorstForm,
} from "@askboard/contract/fixtures";
import { draftRecordProblems, validateBoardMessage } from "@askboard/contract/validate";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { connectDrafts, createBoardDraft, draftRecordOf, restoreDraft } from "./board-draft.ts";
import { dropWork, fillFrom, keepMine } from "./card-acts.ts";
import {
  cellEntriesShown,
  cellEntryIdsOf,
  clearCellEntries,
  cutCellEntries,
  dropStaleCellEntries,
  fitCellEntries,
  inputCellsOf,
  NO_CELL_ENTRIES,
  sameCellEntries,
} from "./cell-entries.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { itemCallbacks } from "./item-callbacks.ts";

const [asked] = plainChoiceBoardDocument.items;
type TableProps = { columns: { field: string }[]; rows: Record<string, unknown>[] };
const COSTS = structuredClone(TABLE_FIXTURE_ITEM) as unknown as {
  type: string;
  id: string;
  props: TableProps;
};
// A Table whose rows and fields are named like object members.
const ODD = {
  type: "table",
  id: "odd",
  props: {
    label: "Odd",
    columns: [
      { field: "constructor", label: "C", type: "number" },
      { field: "toString", label: "T", type: "text" },
    ],
    rows: [
      { id: "__proto__", constructor: 1, toString: "a" },
      { id: "constructor", constructor: 2, toString: "b" },
    ],
  },
};
const ITEMS = [
  COSTS,
  ODD,
  { type: "number-field", id: "days", props: { label: "Days", max: 20 } },
  { type: "text", id: "intro", props: { text: "Hello" } },
];
const documentOf = (items: readonly unknown[]): ViewDocument =>
  ({
    ...plainChoiceBoardDocument,
    items: [{ ...asked, props: { ...asked.props, options: undefined, items } }],
  }) as unknown as ViewDocument;
const document = documentOf(ITEMS);
const [question] = questionsOf(document) as [ViewQuestion];
const QUESTION = question.id;

const stores = (doc: ViewDocument = document) => {
  const values = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const cells = createDraftStore();
  const board = createBoardDraft("immediate");
  connectDrafts(doc, values, board, results, entries, cells);
  return {
    values,
    results,
    entries,
    cells,
    board,
    record: () =>
      draftRecordOf(
        doc,
        values.record(),
        board.get(),
        results.record(),
        entries.record(),
        cells.record(),
      ),
  };
};

const openState = (doc: ViewDocument): LifecycleBoardState => ({
  ask: "waiting",
  questions: questionsOf(doc).map(({ id, rev }) => ({
    itemId: id,
    rev,
    state: "open",
  })) as unknown as LifecycleBoardState["questions"],
});

const restoreInto = (
  set: ReturnType<typeof stores>,
  record: unknown,
  doc: ViewDocument = document,
) =>
  restoreDraft(
    record as never,
    doc,
    openState(doc),
    set.values,
    set.board,
    set.results,
    undefined,
    set.entries,
    set.cells,
  );

const cells = (entries: Record<string, string>): ReadonlyMap<string, string> =>
  new Map(Object.entries(entries));

describe("which items hold cell entries", () => {
  test("a question's Tables, in its order, at any depth of its layouts; no other item", () => {
    expect(cellEntryIdsOf(question)).toEqual(["costs", "odd"]);
    const nested = documentOf([
      {
        type: "group",
        id: "box",
        props: { title: "Box", items: [{ type: "stack", id: "s", props: { items: [COSTS] } }] },
      },
      { type: "number-field", id: "days", props: { label: "Days" } },
    ]);
    expect(cellEntryIdsOf(questionsOf(nested)[0] as ViewQuestion)).toEqual(["costs"]);
  });

  test("the input cells of a Table: each row with each input column, never a formula column or id", () => {
    expect([...inputCellsOf(COSTS.props)].sort()).toEqual([
      "dev.days",
      "dev.rate",
      "dev.role",
      "pm.days",
      "pm.rate",
      "pm.role",
    ]);
    expect([...inputCellsOf(ODD.props)].sort()).toEqual([
      "__proto__.constructor",
      "__proto__.toString",
      "constructor.constructor",
      "constructor.toString",
    ]);
    expect(inputCellsOf(null).size).toBe(0);
    expect(inputCellsOf({ columns: 5, rows: "x" }).size).toBe(0);
  });
});

describe("the text a cell entry holds", () => {
  test("is cut at 200 code points; empty and what is no text hold nothing", () => {
    const cut = cutCellEntries(
      new Map<string, unknown>([
        ["pm.rate", "😀".repeat(300)],
        ["pm.days", ""],
        ["dev.days", 5],
        ["dev.rate", "12,5"],
      ]),
    );
    expect(cut?.get("pm.rate")).toBe("😀".repeat(ENTRY_MAX_CHARS));
    expect([...(cut?.keys() ?? [])]).toEqual(["pm.rate", "dev.rate"]);
    expect(cutCellEntries(new Map())).toBeUndefined();
    expect(cutCellEntries(undefined)).toBeUndefined();
    expect(cutCellEntries(new Map([["pm.rate", ""]]))).toBeUndefined();
  });

  test("keys __proto__.rate and constructor.toString are own keys; a key of no row.field shape is dropped", () => {
    const cut = cutCellEntries(
      new Map([
        ["__proto__.rate", "x"],
        ["constructor.toString", "y"],
        ["pm", "z"],
        ["pm.Rate", "z"],
        ["pm.rate.x", "z"],
        [".rate", "z"],
      ]),
    );
    expect([...(cut?.keys() ?? [])]).toEqual(["__proto__.rate", "constructor.toString"]);
  });

  test("at most 2,000 cells per item are kept", () => {
    const many = new Map(
      Array.from({ length: CELL_ENTRIES_MAX + 5 }, (_, at) => [`r${at}.a`, "x"] as const),
    );
    expect(cutCellEntries(many)?.size).toBe(CELL_ENTRIES_MAX);
  });

  test("two maps with the same cells are the same entries, in any order", () => {
    expect(
      sameCellEntries(cells({ "a.b": "1", "c.d": "2" }), cells({ "c.d": "2", "a.b": "1" })),
    ).toBe(true);
    expect(sameCellEntries(cells({ "a.b": "1" }), cells({ "a.b": "2" }))).toBe(false);
    expect(sameCellEntries(cells({ "a.b": "1" }), cells({ "a.c": "1" }))).toBe(false);
    expect(sameCellEntries(undefined, cells({ "a.b": "1" }))).toBe(false);
    expect(sameCellEntries(undefined, undefined)).toBe(true);
  });

  test("an item shows its held cell entries only while the card shows no answer in their place", () => {
    const held = cells({ "pm.rate": "x" });
    expect(cellEntriesShown(undefined, undefined, held)).toBe(held);
    expect(cellEntriesShown({ rows: [] }, undefined, held)).toBe(NO_CELL_ENTRIES);
    expect(cellEntriesShown(undefined, { points: [] }, held)).toBe(NO_CELL_ENTRIES);
    expect(cellEntriesShown(undefined, undefined, undefined)).toBe(NO_CELL_ENTRIES);
    expect(cellEntriesShown(undefined, undefined, "not a map")).toBe(NO_CELL_ENTRIES);
  });
});

describe("a cell entry in the draft record (design decision 8; AD-20)", () => {
  test("is mirrored under cellEntries by item and cell, none under values, results or entries", () => {
    const set = stores();
    set.cells.set("costs", cells({ "pm.rate": "12,5", "dev.days": "abc" }));
    const mirrored = set.record().questions[QUESTION];
    expect(mirrored).toEqual({
      rev: question.rev,
      cellEntries: { costs: { "pm.rate": "12,5", "dev.days": "abc" } },
    });
    expect(mirrored).not.toHaveProperty("values");
    expect(mirrored).not.toHaveProperty("entries");
    expect(mirrored).not.toHaveProperty("results");
  });

  test("the record validates in both directions and against the document", () => {
    const set = stores();
    set.cells.set("costs", cells({ "pm.rate": "12,5" }));
    set.cells.set("odd", cells({ "__proto__.constructor": "x", "constructor.toString": "y" }));
    const record = set.record();
    for (const direction of ["toHost", "toPage"] as const) {
      const checked = validateBoardMessage(direction, {
        version: BOARD_PROTOCOL_VERSION,
        type: "draft",
        record,
      });
      expect([direction, checked.ok]).toEqual([direction, true]);
    }
    expect(draftRecordProblems(record, document as never)).toEqual([]);
    const mirrored = record.questions[QUESTION]?.cellEntries ?? {};
    const odd = Object.getOwnPropertyDescriptor(mirrored, "odd")?.value ?? {};
    expect(Object.keys(odd)).toEqual(["__proto__.constructor", "constructor.toString"]);
  });

  test("it starts the question's work and clearing it ends the work, as an entry does", () => {
    const set = stores();
    set.cells.set("costs", cells({ "pm.rate": "x" }));
    expect(set.board.work(QUESTION)?.rev).toBe(question.rev);
    set.cells.set("costs", undefined);
    expect(set.board.work(QUESTION)).toBeUndefined();
  });

  test("an edit of a cell entry makes a ready answer not ready", () => {
    const set = stores();
    set.values.set("days", 3);
    set.board.edit(QUESTION, 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    set.cells.set("costs", cells({ "pm.rate": "x" }));
    expect(set.board.work(QUESTION)?.held).toBeUndefined();
  });

  test("an entry for an item that is no Table, or that the question no longer has, is not mirrored", () => {
    const set = stores();
    set.cells.set("days", cells({ "pm.rate": "x" }));
    set.cells.set("gone", cells({ "pm.rate": "x" }));
    expect(set.record().questions).toEqual({});
  });

  test("the mirrored text is cut at 200 code points and a malformed key never reaches the record", () => {
    const set = stores();
    set.cells.set(
      "costs",
      new Map([
        ["pm.rate", "9".repeat(500)],
        ["bad key", "x"],
      ]),
    );
    expect(set.record().questions[QUESTION]?.cellEntries).toEqual({
      costs: { "pm.rate": "9".repeat(200) },
    });
  });

  test("2,000 entries of 200 characters stay within the record's size", () => {
    const worst = tableWorstForm(200);
    const big = documentOf([{ type: "table", id: "big", props: worst }]);
    const set = stores(big);
    const text = "9".repeat(ENTRY_MAX_CHARS);
    const entries = new Map(
      Array.from({ length: CELL_ENTRIES_MAX }, (_, at) => [
        `r${Math.floor(at / 10) + 1}.${at % 10 === 0 ? "a" : `f${at % 10}`}`,
        text,
      ]),
    );
    set.cells.set("big", entries);
    const record = set.record();
    const mirrored = record.questions[QUESTION]?.cellEntries?.big ?? {};
    expect(Object.keys(mirrored)).toHaveLength(CELL_ENTRIES_MAX);
    expect(JSON.stringify(record).length).toBeLessThan(DRAFT_RECORD_MAX_CHARS);
  });
});

describe("restoring cell entries after a reload (FR-25)", () => {
  test("they come back with the work, and the record mirrors them again whole", () => {
    const first = stores();
    first.cells.set("costs", cells({ "pm.rate": "12,5", "dev.days": "abc" }));
    first.cells.set("odd", cells({ "__proto__.constructor": "x", "constructor.toString": "y" }));
    const mirrored = first.record();
    const second = stores();
    restoreInto(second, mirrored);
    expect([...(second.cells.valueOf("costs") as Map<string, string>)]).toEqual([
      ["pm.rate", "12,5"],
      ["dev.days", "abc"],
    ]);
    const odd = second.cells.valueOf("odd") as Map<string, string>;
    expect([...odd.keys()]).toEqual(["__proto__.constructor", "constructor.toString"]);
    expect(second.record()).toEqual(mirrored);
    expect(second.board.work(QUESTION)?.rev).toBe(question.rev);
  });

  test("an entry for an item that is no Table, a gone item, the question or an inherited key is left out", () => {
    const set = stores();
    restoreInto(set, {
      delivery: "immediate",
      questions: {
        [QUESTION]: {
          rev: 1,
          cellEntries: {
            days: { "pm.rate": "a" },
            gone: { "pm.rate": "b" },
            [QUESTION]: { "pm.rate": "c" },
            constructor: { "pm.rate": "d" },
            costs: { "pm.rate": "e" },
          },
        },
      },
    });
    expect([...set.cells.record().keys()]).toEqual(["costs"]);
  });

  test("a text that is no string, is empty or is over 200 characters is dropped or cut", () => {
    const set = stores();
    restoreInto(set, {
      delivery: "immediate",
      questions: {
        [QUESTION]: {
          rev: 1,
          cellEntries: {
            costs: { "pm.rate": "9".repeat(500), "dev.rate": "", "pm.days": 5, "dev.days": "x" },
          },
        },
      },
    });
    expect([...(set.cells.valueOf("costs") as Map<string, string>)]).toEqual([
      ["pm.rate", "9".repeat(200)],
      ["dev.days", "x"],
    ]);
  });

  test("work that is a cell entry alone is work: the question's revision is kept", () => {
    const set = stores();
    restoreInto(set, {
      delivery: "immediate",
      questions: { [QUESTION]: { rev: 1, cellEntries: { costs: { "pm.rate": "x" } } } },
    });
    expect(set.board.work(QUESTION)?.rev).toBe(1);
  });

  test("a key naming no input cell of the item is dropped: a gone row, a formula column's field, id, an unknown field", () => {
    const set = stores();
    restoreInto(set, {
      delivery: "immediate",
      questions: {
        [QUESTION]: {
          rev: 1,
          cellEntries: {
            costs: {
              "pm.rate": "keep",
              "ghost.rate": "no row",
              "pm.amount": "a formula column's field",
              "pm.id": "the row's id",
              "pm.nothing": "no column",
              "u-1.days": "a row only a value could hold",
            },
          },
        },
      },
    });
    expect([...(set.cells.valueOf("costs") as Map<string, string>)]).toEqual([["pm.rate", "keep"]]);
  });

  test("a key naming a toggle cell is dropped on restore, as one naming no input cell (review S-3 of review-table-g5)", () => {
    const toggled = documentOf([
      {
        type: "table",
        id: "costs",
        props: {
          label: "Roles",
          columns: [
            { field: "role", label: "Role", type: "text" },
            { field: "billable", label: "Billable", type: "toggle" },
          ],
          rows: [{ id: "pm", role: "PM" }],
        },
      },
    ]);
    const set = stores(toggled);
    restoreInto(
      set,
      {
        delivery: "immediate",
        questions: {
          [QUESTION]: {
            rev: 1,
            cellEntries: { costs: { "pm.role": "keep", "pm.billable": "yes" } },
          },
        },
      },
      toggled,
    );
    expect([...(set.cells.valueOf("costs") as Map<string, string>)]).toEqual([["pm.role", "keep"]]);
  });

  test("a row the held value adds counts: its cells are input cells of the value, not of the props", () => {
    const set = stores();
    restoreInto(set, {
      delivery: "immediate",
      questions: {
        [QUESTION]: {
          rev: 1,
          values: { costs: structuredClone(TABLE_EDITED_PROPS) },
          cellEntries: { costs: { "u-1.days": "x", "pm.amount": "no", "u-2.days": "no row" } },
        },
      },
    });
    expect([...(set.cells.valueOf("costs") as Map<string, string>)]).toEqual([["u-1.days", "x"]]);
  });

  test("a value the shown props do not fit is dropped on restore with every cell entry of its item (review S-1)", () => {
    const set = stores();
    const changed = structuredClone(COSTS);
    changed.props.columns = changed.props.columns.filter(
      (c: { field: string }) => c.field !== "rate",
    );
    changed.props.rows = changed.props.rows.map(
      ({ rate: _r, ...row }: Record<string, unknown>) => row,
    );
    const doc = documentOf([changed, ODD]);
    const facts = (type: string) =>
      type === "table"
        ? {
            valueFits: (value: unknown, props: unknown) =>
              JSON.stringify((value as { columns: unknown }).columns) ===
              JSON.stringify((props as { columns: unknown }).columns),
          }
        : undefined;
    restoreDraft(
      {
        delivery: "immediate",
        questions: {
          [QUESTION]: {
            rev: 1,
            values: { costs: structuredClone(TABLE_EDITED_PROPS) },
            cellEntries: { costs: { "pm.days": "x" }, odd: { "constructor.toString": "z" } },
          },
        },
      },
      doc,
      openState(doc),
      set.values,
      set.board,
      set.results,
      facts,
      set.entries,
      set.cells,
    );
    expect(set.values.valueOf("costs")).toBeUndefined();
    expect(set.cells.valueOf("costs")).toBeUndefined();
    expect([...(set.cells.valueOf("odd") as Map<string, string>)]).toEqual([
      ["constructor.toString", "z"],
    ]);
  });

  test("with every entry dropped and nothing else held, there is no work to restore", () => {
    const set = stores();
    restoreInto(set, {
      delivery: "immediate",
      questions: { [QUESTION]: { rev: 1, cellEntries: { costs: { "ghost.rate": "x" } } } },
    });
    expect(set.cells.record().size).toBe(0);
    expect(set.board.work(QUESTION)).toBeUndefined();
  });

  test("an entry makes the work of an answered question a revision, never a stale copy of its answer", () => {
    const answered = {
      ask: "waiting",
      questions: [
        {
          itemId: QUESTION,
          rev: 1,
          state: "answered",
          answer: { results: {} },
        },
      ],
    } as unknown as LifecycleBoardState;
    const set = stores();
    restoreDraft(
      {
        delivery: "immediate",
        questions: { [QUESTION]: { rev: 1, cellEntries: { costs: { "pm.rate": "x" } } } },
      },
      document,
      answered,
      set.values,
      set.board,
      set.results,
      undefined,
      set.entries,
      set.cells,
    );
    expect(set.cells.valueOf("costs")).toBeDefined();
  });
});

describe("a cell entry goes with the item's value (design decision 8)", () => {
  const setUp = () => {
    const sent: ViewMessage[] = [];
    const channel: ViewChannel = {
      send: async (message) => {
        sent.push(message);
        return { outcome: "sent", actionId: "AAAAAAAAAAAAAAAAAAAAAA" };
      },
      onUpdate: () => () => {},
      onTheme: () => () => {},
    };
    const set = stores();
    // A Table's chunk registers `valueFits`: a value fits while its columns are the props' own.
    const facts = (type: string) =>
      type === "table"
        ? {
            valueFits: (value: unknown, props: unknown) =>
              JSON.stringify((value as { columns: unknown }).columns) ===
              JSON.stringify((props as { columns: unknown }).columns),
          }
        : undefined;
    const context = {
      channel,
      acts: createAnswerActs(),
      draft: set.values,
      results: set.results,
      entries: set.entries,
      cellEntries: set.cells,
      board: set.board,
      derived: createDerivedStore(),
      delivery: "immediate" as const,
      facts,
    };
    return { ...set, sent, context };
  };

  test("dropping a question's work drops its cell entries; filling it from an answer clears them", () => {
    const { values, cells: held, board, context } = setUp();
    held.set("costs", cells({ "pm.rate": "x" }));
    values.set("costs", structuredClone(TABLE_EDITED_PROPS));
    dropWork(question, context);
    expect(held.record().size).toBe(0);
    expect(board.work(QUESTION)).toBeUndefined();
    held.set("odd", cells({ "constructor.toString": "x" }));
    fillFrom(question, { results: {} }, "current", context);
    expect(held.record().size).toBe(0);
  });

  test("clearCellEntries clears every Table of the question and tolerates no store", () => {
    const { cells: held } = setUp();
    held.set("costs", cells({ "pm.rate": "x" }));
    held.set("odd", cells({ "constructor.toString": "x" }));
    clearCellEntries(question, undefined);
    expect(held.record().size).toBe(2);
    clearCellEntries(question, held);
    expect(held.record().size).toBe(0);
  });

  test("an update that removes the Table, or changes its type under the same ID, drops its entries", () => {
    const { cells: held } = setUp();
    held.set("costs", cells({ "pm.rate": "x" }));
    held.set("odd", cells({ "constructor.toString": "x" }));
    dropStaleCellEntries(documentOf([ODD]), held);
    expect([...held.record().keys()]).toEqual(["odd"]);
    dropStaleCellEntries(
      documentOf([{ type: "number-field", id: "odd", props: { label: "Odd" } }]),
      held,
    );
    expect(held.record().size).toBe(0);
  });

  test("Keep mine, on the revision the work was made on, keeps the entries of cells the held value has", () => {
    const { values, cells: held, board, context } = setUp();
    const earlier = question;
    const current = { ...question, rev: 2 };
    board.edit(QUESTION, 1, () => ({ rev: 1 }));
    values.set("costs", structuredClone(TABLE_EDITED_PROPS));
    held.set("costs", cells({ "u-1.days": "x", "pm.rate": "y" }));
    keepMine(current, context, earlier);
    expect([...(held.valueOf("costs") as Map<string, string>)]).toEqual([
      ["u-1.days", "x"],
      ["pm.rate", "y"],
    ]);
  });

  test("Keep mine drops the entries of a value the card does not fit, and then of cells no input cell holds", () => {
    const { values, cells: held, board, context } = setUp();
    const changed = structuredClone(COSTS);
    changed.props.columns = changed.props.columns.filter(
      (c: { field: string }) => c.field !== "rate",
    );
    changed.props.rows = changed.props.rows.map(
      ({ rate: _r, ...row }: Record<string, unknown>) => row,
    );
    const shown = { ...question, props: { ...question.props, items: [changed, ODD] } };
    const current = { ...shown, rev: 2 };
    board.edit(QUESTION, 1, () => ({ rev: 1 }));
    values.set("costs", structuredClone(TABLE_EDITED_PROPS));
    held.set("costs", cells({ "pm.rate": "x", "pm.days": "y" }));
    held.set("odd", cells({ "constructor.toString": "z", "ghost.toString": "no row" }));
    keepMine(current, context, shown);
    // The value had the rate column the shown revision lacks: it is dropped, and with it every
    // cell entry of the item (review S-1 of table-widget), so "Answer" is released; the Table
    // stays untouched. A Table with no value keeps the entries its shown props still fit (U-1).
    expect(values.record().has("costs")).toBe(false);
    expect(held.valueOf("costs")).toBeUndefined();
    expect([...(held.valueOf("odd") as Map<string, string>)]).toEqual([
      ["constructor.toString", "z"],
    ]);
  });

  test("a held value kept by Keep mine keeps the entries of its own input cells", () => {
    const { values, cells: held, board, context } = setUp();
    const current = { ...question, rev: 2 };
    board.edit(QUESTION, 1, () => ({ rev: 1 }));
    values.set("costs", structuredClone(TABLE_EDITED_PROPS));
    held.set("costs", cells({ "u-1.days": "x" }));
    keepMine(current, context, question);
    expect([...(held.valueOf("costs") as Map<string, string>)]).toEqual([["u-1.days", "x"]]);
  });

  test("Keep mine on the revision the work was made on has nothing to settle and leaves the entries", () => {
    const { cells: held, context } = setUp();
    held.set("costs", cells({ "ghost.rate": "x" }));
    keepMine(question, context);
    expect(held.valueOf("costs")).toBeDefined();
  });
});

describe("the callbacks an item gets for its cell entries (AD-9)", () => {
  const callbacksFor = (itemId: string, cellEntriesAllowed = true) => {
    const draft = createDraftStore();
    const results = createDraftStore();
    const held = createDraftStore();
    const onError = mock((_error: unknown) => {});
    const onBeforeChange = mock(() => {});
    const callbacks = itemCallbacks({
      draft,
      results,
      cellEntries: held,
      cellEntriesAllowed,
      itemId,
      questionId: QUESTION,
      itemIds: ["costs", "odd"],
      onBeforeChange,
      onError,
    });
    return { draft, results, held, onError, onBeforeChange, ...callbacks };
  };

  test("onCellEntriesChange runs the step before a change and holds the whole map; an empty map removes it", () => {
    const { held, onBeforeChange, onCellEntriesChange } = callbacksFor("costs");
    onCellEntriesChange(cells({ "pm.rate": "12,5" }));
    expect([...(held.valueOf("costs") as Map<string, string>)]).toEqual([["pm.rate", "12,5"]]);
    expect(onBeforeChange).toHaveBeenCalledTimes(1);
    onCellEntriesChange(cells({ "dev.days": "x" }));
    expect([...(held.valueOf("costs") as Map<string, string>)]).toEqual([["dev.days", "x"]]);
    onCellEntriesChange(new Map());
    expect(held.record().has("costs")).toBe(false);
    expect(onBeforeChange).toHaveBeenCalledTimes(3);
  });

  test("the same cells again change nothing and run no step", () => {
    const { held, onBeforeChange, onCellEntriesChange } = callbacksFor("costs");
    onCellEntriesChange(cells({ "pm.rate": "x" }));
    const first = held.valueOf("costs");
    onCellEntriesChange(cells({ "pm.rate": "x" }));
    expect(held.valueOf("costs")).toBe(first);
    expect(onBeforeChange).toHaveBeenCalledTimes(1);
    const none = callbacksFor("costs");
    none.onCellEntriesChange(new Map());
    expect(none.onBeforeChange).not.toHaveBeenCalled();
  });

  test("texts are cut at 200 code points and empty ones dropped", () => {
    const { held, onCellEntriesChange } = callbacksFor("odd");
    onCellEntriesChange(
      new Map([
        ["__proto__.constructor", "9".repeat(500)],
        ["constructor.toString", ""],
      ]),
    );
    expect([...(held.valueOf("odd") as Map<string, string>)]).toEqual([
      ["__proto__.constructor", "9".repeat(200)],
    ]);
  });

  test("a value that is no map holds nothing and fails the item", () => {
    const { held, onError, onCellEntriesChange } = callbacksFor("costs");
    for (const bad of [5, "x", { "pm.rate": "x" }, ["pm.rate"], null]) {
      onCellEntriesChange(bad as never);
    }
    expect(held.record().size).toBe(0);
    expect(onError).toHaveBeenCalledTimes(5);
  });

  test("an item that holds no cell entries fails when it reports some, and nothing is held", () => {
    const { held, onError, onCellEntriesChange } = callbacksFor("days", false);
    onCellEntriesChange(cells({ "pm.rate": "x" }));
    expect(held.record().size).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0]?.[0])).toContain("days");
  });

  test("without a store a reported cell entry is not held and no error is raised", () => {
    const onError = mock((_error: unknown) => {});
    const { onCellEntriesChange } = itemCallbacks({
      draft: createDraftStore(),
      cellEntriesAllowed: true,
      itemId: "costs",
      questionId: QUESTION,
      itemIds: ["costs"],
      onError,
    });
    onCellEntriesChange(cells({ "pm.rate": "x" }));
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("fitting entries to a value", () => {
  test("a toggle cell is no input cell for an entry", () => {
    const props = {
      columns: [
        { field: "role", label: "Role", type: "text" },
        { field: "billable", label: "Billable", type: "toggle" },
      ],
      rows: [{ id: "pm" }],
    };
    expect([...inputCellsOf(props)]).toEqual(["pm.role"]);
    expect(fitCellEntries(cells({ "pm.billable": "yes" }), props)).toBeUndefined();
  });

  test("keeps the cells the props hold and returns none when none is left", () => {
    expect([
      ...(fitCellEntries(cells({ "pm.rate": "x", "ghost.rate": "y" }), COSTS.props) ?? []),
    ]).toEqual([["pm.rate", "x"]]);
    expect(fitCellEntries(cells({ "ghost.rate": "y" }), COSTS.props)).toBeUndefined();
    expect(fitCellEntries(cells({ "pm.rate": "x" }), null)).toBeUndefined();
  });
});
