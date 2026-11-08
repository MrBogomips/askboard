// One function for every entry reader (table-widget, task 4.3; view-and-widgets spec: Cell entries
// block "Answer", Cell entries in the draft; design decision 8; AD-10, NFR-10): a Table's cell
// entries reach every reader that decides whether an answer may go through `entriesWithCells`, so
// "Answer", "Send and switch", "Accept recommended", "Select recommended" and Submit refuse, the hint
// names the Table, the Tabs mark the tab, held work counts them, and clearing the entry releases each.
// The Table is a stub: two layouts deep, inside a Tabs and a Group.

import { describe, expect, test } from "bun:test";
import type { DraftRecord, LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { hasUnsentWork, unsentWorkText } from "../board-page/unsent-work.ts";
import type { BoardContent } from "../catalog/port.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { withEntries } from "./board-content.ts";
import { connectDrafts, createBoardDraft, hasAnswerWork } from "./board-draft.ts";
import { acceptRecommended, answer } from "./card-acts.ts";
import { entriesWithCells } from "./cell-entries.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import {
  answerHint,
  ENTRY_ITEM_TYPES,
  entryBlock,
  entryIdsOf,
  fieldEntryIdsOf,
  holdsEntry,
  isEntryType,
} from "./entries.ts";
import { cardState } from "./question-state.ts";
import { selectRecommended, submitPress, submitStateOf } from "./submit.ts";

const [asked] = plainChoiceBoardDocument.items;
const table = (label?: string) => ({
  type: "table",
  id: "costs",
  props: { ...(label === undefined ? {} : { label }), columns: [], rows: [] },
});
// A Tabs of one tab holding a Group that holds a Table: the Table sits two layouts deep.
const nested = (label?: string) => ({
  type: "tabs",
  id: "sections",
  props: {
    tabs: [
      {
        id: "money",
        title: "Money",
        items: [{ type: "group", id: "box", props: { title: "Box", items: [table(label)] } }],
      },
    ],
  },
});
const documentOf = (items: readonly unknown[]): ViewDocument =>
  ({
    ...plainChoiceBoardDocument,
    items: [
      {
        ...asked,
        props: {
          ...asked.props,
          options: [{ label: "Small", recommended: true }, { label: "Large" }],
          items,
        },
      },
    ],
  }) as unknown as ViewDocument;
const document = documentOf([nested("Roles")]);
const [question] = questionsOf(document) as [ViewQuestion];
const QUESTION = question.id;
const CELLS = new Map([["pm.rate", "12,5"]]);

const stores = (
  doc: ViewDocument = document,
  delivery: "immediate" | "submitted" = "immediate",
) => {
  const values = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const cells = createDraftStore();
  const board = createBoardDraft(delivery);
  connectDrafts(doc, values, board, results, entries, cells);
  return { values, results, entries, cells, board };
};

const stateOf = (doc: ViewDocument = document): LifecycleBoardState => ({
  ask: "waiting",
  questions: questionsOf(doc).map(({ id, rev }) => ({
    itemId: id,
    rev,
    state: "open",
  })) as unknown as LifecycleBoardState["questions"],
});

describe("which items the readers look at", () => {
  test("ENTRY_ITEM_TYPES gains the Table; only the three fields hold a plain entry", () => {
    expect([...ENTRY_ITEM_TYPES]).toEqual(["number-field", "money-field", "date-field", "table"]);
    for (const type of ["number-field", "money-field", "date-field"]) {
      expect(isEntryType(type)).toBe(true);
    }
    for (const type of ["table", "text-field", "toggle", "tabs", "constructor"]) {
      expect(isEntryType(type), type).toBe(false);
    }
  });

  test("a question's entry items include a Table at depth two; its plain entry items do not", () => {
    expect(entryIdsOf(question)).toEqual(["costs"]);
    expect(fieldEntryIdsOf(question)).toEqual([]);
  });
});

describe("entriesWithCells", () => {
  test("gives an entry under a Table's ID while any of its cells holds one; entries stay as they are", () => {
    const entries = new Map<string, unknown>([["days", "21"]]);
    const merged = entriesWithCells(entries, new Map([["costs", CELLS]]));
    expect(merged.get("days")).toBe("21");
    expect(merged.get("costs")).toBeDefined();
    expect(entriesWithCells(entries, new Map())).toBe(entries);
    expect(entriesWithCells(undefined, undefined).size).toBe(0);
    expect(entriesWithCells(undefined, new Map([["costs", CELLS]])).get("costs")).toBeDefined();
  });

  test("an item with no cells left holds no entry, and one record pair gives one merged record", () => {
    const entries = new Map<string, unknown>();
    const cells = new Map<string, unknown>([["costs", CELLS]]);
    expect(entriesWithCells(entries, cells)).toBe(entriesWithCells(entries, cells));
    expect(entriesWithCells(entries, new Map([["costs", new Map()]])).has("costs")).toBe(false);
    expect(entriesWithCells(entries, new Map([["costs", "not a map"]])).has("costs")).toBe(false);
  });

  test("the board a component reads names the Table among the items holding an entry (the Tabs' mark)", () => {
    const board: BoardContent = { items: [], draft: new Map(), shown: new Map() };
    const marked = withEntries(board, entriesWithCells(new Map(), new Map([["costs", CELLS]])));
    expect(marked.entries?.has("costs")).toBe(true);
    expect(withEntries(board, entriesWithCells(new Map(), new Map())).entries).toBeUndefined();
  });
});

describe("the hint names the Table", () => {
  const merged = entriesWithCells(new Map(), new Map([["costs", CELLS]]));

  test("by its label, or by its ID without one; in Italian too", () => {
    expect(entryBlock(question, merged)).toEqual({ itemId: "costs", label: "Roles" });
    expect(answerHint(question, merged, "en-US")).toBe("Correct Roles first.");
    expect(answerHint(question, merged, "it-IT")).toBe("Correggi prima Roles.");
    const bare = documentOf([nested()]);
    const [bareQuestion] = questionsOf(bare) as [ViewQuestion];
    expect(answerHint(bareQuestion, merged, "en-US")).toBe("Correct costs first.");
  });

  test("a held cell entry is a block; without one there is none", () => {
    expect(holdsEntry(question, merged)).toBe(true);
    expect(holdsEntry(question, entriesWithCells(new Map(), new Map()))).toBe(false);
    expect(answerHint(question, new Map(), "en-US")).toBeUndefined();
  });

  test("the card cannot answer while a cell entry is held, and can once it is cleared", () => {
    const card = (entry: boolean) =>
      cardState({
        status: { itemId: QUESTION, rev: 1, state: "open" },
        draft: { values: { [QUESTION]: ["Small"] } },
        load: "visible",
        ready: false,
        entry,
      });
    expect(card(holdsEntry(question, merged)).canAnswer).toBe(false);
    expect(card(holdsEntry(question, new Map())).canAnswer).toBe(true);
  });
});

describe("held work counts a cell entry", () => {
  test("a cell entry is answer work, and it starts the question's work", () => {
    const { values, results, cells, board } = stores();
    const held = () => entriesWithCells(new Map(), cells.record());
    expect(hasAnswerWork(question, values.record(), undefined, results.record(), held())).toBe(
      false,
    );
    cells.set("costs", CELLS);
    expect(hasAnswerWork(question, values.record(), undefined, results.record(), held())).toBe(
      true,
    );
    expect(board.work(QUESTION)?.rev).toBe(question.rev);
    cells.set("costs", undefined);
    expect(board.work(QUESTION)).toBeUndefined();
  });
});

describe("answering with a cell entry held sends nothing (NFR-10, AD-10)", () => {
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
      facts: () => ({ fits: () => true }),
    };
    return { ...set, sent, context };
  };

  test("Answer sends no message and holds no act; with the entry cleared the same press sends", () => {
    const { sent, values, cells, board, context } = setUp();
    values.set(QUESTION, ["Small"]);
    cells.set("costs", CELLS);
    expect(answer(question, context)).toBeUndefined();
    expect(sent).toEqual([]);
    expect(board.work(QUESTION)?.held).toBeUndefined();
    cells.set("costs", undefined);
    answer(question, context);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "answer" });
  });

  test("Accept recommended selects and presses Answer, which sends nothing", () => {
    const { sent, cells, context } = setUp();
    cells.set("costs", CELLS);
    expect(acceptRecommended(question, context)).toBeUndefined();
    expect(sent).toEqual([]);
    cells.set("costs", undefined);
    acceptRecommended(question, context);
    expect(sent).toHaveLength(1);
  });
});

describe("submitted delivery with a cell entry held", () => {
  const set = () => stores(document, "submitted");
  const mark = (board: ReturnType<typeof stores>["board"]) =>
    board.edit(QUESTION, 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));

  test("Select recommended selects but does not mark the question ready", () => {
    const { values, results, entries, cells, board } = set();
    cells.set("costs", CELLS);
    const count = selectRecommended(
      document,
      stateOf(),
      { draft: values, results, entries, cellEntries: cells, board },
      () => false,
    );
    expect(values.valueOf(QUESTION)).toEqual(["Small"]);
    expect(board.work(QUESTION)?.held).toBeUndefined();
    expect(count).toBe(1);
  });

  test("with the entry cleared, Select recommended marks the question ready", () => {
    const { values, results, entries, cells, board } = set();
    selectRecommended(
      document,
      stateOf(),
      { draft: values, results, entries, cellEntries: cells, board },
      () => false,
    );
    expect(board.work(QUESTION)?.held).toEqual({ act: "answer", order: 0, byRecommended: true });
  });

  test("Submit is disabled and its press names the question; clearing the entry releases both", () => {
    const { values, results, cells, board } = set();
    values.set(QUESTION, ["Small"]);
    mark(board);
    cells.set("costs", CELLS);
    // The held mark outlived the entry, as a path other than the card's could leave it.
    mark(board);
    const merged = () => entriesWithCells(new Map(), cells.record());
    const inputs = () => ({
      document,
      board: board.get(),
      delivery: "submitted" as const,
      connection: undefined,
      lock: undefined,
      pending: () => false,
      sending: () => false,
      entries: merged(),
    });
    expect(submitStateOf(inputs()).disabled).toBe(true);
    const press = () =>
      submitPress(document, board.get(), values.record(), new Date(), () => undefined, {
        results: results.record(),
        entries: merged(),
        state: stateOf(),
      });
    expect(press()).toEqual({ kind: "has-entry", questionId: QUESTION });
    cells.set("costs", undefined);
    mark(board);
    expect(submitStateOf(inputs()).disabled).toBe(false);
    expect(press().kind).toBe("send");
  });
});

describe("unsent work holds a cell entry", () => {
  const record: DraftRecord = {
    delivery: "immediate",
    questions: { [QUESTION]: { rev: 1, cellEntries: { costs: { "pm.rate": "12,5" } } } },
  };

  test("a cell entry alone arms the leave-page prompt", () => {
    expect(hasUnsentWork(record)).toBe(true);
    expect(hasUnsentWork({ delivery: "immediate", questions: { [QUESTION]: { rev: 1 } } })).toBe(
      false,
    );
    expect(
      hasUnsentWork({
        delivery: "immediate",
        questions: { [QUESTION]: { rev: 1, cellEntries: { costs: {} } } },
      }),
    ).toBe(false);
  });

  test("the copied text holds the entry with its item, row and column, as text", () => {
    const text = unsentWorkText(document, record);
    expect(text).toContain('costs · pm · rate: "12,5"');
    expect(text).toContain(question.props.text);
  });

  test("an item, row or column named like an object member, and agent markup, are copied as text", () => {
    const odd: DraftRecord = {
      delivery: "immediate",
      questions: {
        [QUESTION]: {
          rev: 1,
          cellEntries: JSON.parse(
            '{"__proto__":{"constructor.toString":"<b>x</b>\\nline"},"constructor":{"__proto__.rate":"y"}}',
          ),
        },
      },
    };
    const text = unsentWorkText(document, odd);
    expect(text).toContain('__proto__ · constructor · toString: "<b>x</b>\\nline"');
    expect(text).toContain('constructor · __proto__ · rate: "y"');
    expect(text.split("\n").filter((line) => line.startsWith("line"))).toEqual([]);
  });

  test("a key that holds no row and field is copied whole rather than lost", () => {
    const odd = {
      delivery: "immediate",
      questions: { [QUESTION]: { rev: 1, cellEntries: { costs: { weird: "z" } } } },
    } as DraftRecord;
    expect(unsentWorkText(document, odd)).toContain('costs · weird: "z"');
  });
});
