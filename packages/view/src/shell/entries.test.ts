// Entries in the shell (atoms, task 4.3; view-and-widgets spec: An entry blocks Answer; design
// decision 3; AD-10, AD-20): text a NumberField, MoneyField or DateField cannot read or a bound
// refuses is kept in the draft record as the item's entry, apart from its value and its result. It
// is restored after a reload, dropped with its item, never part of an answer, and while any item of a
// question holds one the question's "Answer" is disabled and says which field to correct.

import { describe, expect, mock, test } from "bun:test";
import { ENTRY_MAX_CHARS, type LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import {
  connectDrafts,
  createBoardDraft,
  draftRecordOf,
  hasAnswerWork,
  restoreDraft,
} from "./board-draft.ts";
import { answer, dropWork, fillFrom } from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import {
  cutEntry,
  dropStaleEntries,
  ENTRY_ITEM_TYPES,
  entryIdsOf,
  isEntryType,
} from "./entries.ts";
import { answerHint, fieldBlock } from "./field-block.ts";
import { itemCallbacks } from "./item-callbacks.ts";
import { cardState } from "./question-state.ts";

const [asked] = plainChoiceBoardDocument.items;
const ITEMS = [
  { type: "number-field", id: "days", props: { label: "Days", max: 20 } },
  { type: "money-field", id: "price", props: { label: "Price", currency: "EUR" } },
  { type: "date-field", id: "due", props: { label: "Due" } },
  { type: "text-field", id: "name", props: { label: "Name" } },
  { type: "toggle", id: "on", props: { label: "On" } },
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
  const board = createBoardDraft("immediate");
  connectDrafts(doc, values, board, results, entries);
  return {
    values,
    results,
    entries,
    board,
    record: () =>
      draftRecordOf(doc, values.record(), board.get(), results.record(), entries.record()),
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

describe("which items hold an entry", () => {
  test("the NumberField, the MoneyField and the DateField hold an entry; the Table holds cell entries, for the readers", () => {
    // The readers look at the Table too (table-widget, task 4.3); only the three fields hold a plain entry.
    expect([...ENTRY_ITEM_TYPES]).toEqual(["number-field", "money-field", "date-field", "table"]);
    for (const type of ["number-field", "money-field", "date-field"]) {
      expect(isEntryType(type)).toBe(true);
    }
    expect(isEntryType("table")).toBe(false);
    for (const type of [
      "text-field",
      "toggle",
      "text",
      "value",
      "divider",
      "tree",
      "constructor",
    ]) {
      expect(isEntryType(type), type).toBe(false);
    }
  });

  test("a question's entry items, in its order, the question itself and the others left out", () => {
    expect(entryIdsOf(question)).toEqual(["days", "price", "due"]);
  });

  test("an entry is cut at 200 code points; empty and what is no text hold nothing", () => {
    expect(ENTRY_MAX_CHARS).toBe(200);
    expect(cutEntry("1.23")).toBe("1.23");
    expect(cutEntry("a".repeat(250))).toBe("a".repeat(200));
    const astral = cutEntry("😀".repeat(250));
    expect(Array.from(astral ?? "")).toHaveLength(200);
    expect(astral?.endsWith("😀")).toBe(true);
    for (const none of ["", undefined, null, 5, {}, ["1"]]) {
      expect(cutEntry(none), String(none)).toBeUndefined();
    }
  });
});

describe("an entry in the draft record (design decision 3; AD-20)", () => {
  test("it starts the question's work and is mirrored under entries, none under values or results", () => {
    const { entries, board, record } = stores();
    entries.set("days", "21");
    expect(board.work(QUESTION)).toEqual({ rev: 1 });
    expect(record()).toEqual({
      delivery: "immediate",
      questions: { [QUESTION]: { rev: 1, entries: { days: "21" } } },
    });
  });

  test("correcting or clearing the text takes the entry out, and the work with it", () => {
    const { entries, board, record } = stores();
    entries.set("days", "21");
    entries.set("days", undefined);
    expect(record()).toEqual({ delivery: "immediate", questions: {} });
    expect(board.work(QUESTION)).toBeUndefined();
  });

  test("an entry is answer work: a revision of an answered question is made of it", () => {
    const none = new Map();
    expect(hasAnswerWork(question, none, undefined, none, new Map([["days", "21"]]))).toBe(true);
    expect(hasAnswerWork(question, none, undefined, none, none)).toBe(false);
    expect(hasAnswerWork(question, none, undefined)).toBe(false);
  });

  test("an edit of an entry makes a ready answer not ready, as an edit of a value does", () => {
    const { entries, board } = stores();
    entries.set("days", "21");
    board.edit(QUESTION, 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    entries.set("days", "22");
    expect(board.work(QUESTION)?.held).toBeUndefined();
  });

  test("an entry for an item that holds none, or that the question no longer has, is not mirrored", () => {
    const { entries, record } = stores();
    entries.set("name", "typed");
    entries.set("on", "x");
    entries.set("gone", "x");
    entries.set(QUESTION, "x");
    entries.set("constructor", "x");
    expect(record().questions).toEqual({});
  });

  test("the mirrored text is cut at 200 code points", () => {
    const { entries, record } = stores();
    entries.set("days", "9".repeat(300));
    expect(record().questions[QUESTION]?.entries?.days).toBe("9".repeat(200));
  });
});

describe("restoring entries after a reload (FR-25)", () => {
  test("an entry comes back with its work, and the record mirrors it again whole", () => {
    const first = stores();
    first.entries.set("days", "21");
    first.entries.set("price", "12,5x");
    const mirrored = first.record();
    const second = stores();
    restoreDraft(
      mirrored,
      document,
      openState(document),
      second.values,
      second.board,
      second.results,
      undefined,
      second.entries,
    );
    expect(second.entries.valueOf("days")).toBe("21");
    expect(second.entries.valueOf("price")).toBe("12,5x");
    expect(second.record()).toEqual(mirrored);
  });

  test("an entry naming an item that holds none, a gone item, the question or an inherited key is left out", () => {
    const { values, results, entries, board } = stores();
    restoreDraft(
      {
        delivery: "immediate",
        questions: {
          [QUESTION]: {
            rev: 1,
            entries: {
              name: "a",
              on: "b",
              gone: "c",
              [QUESTION]: "d",
              constructor: "e",
              days: "21",
            },
          },
        },
      },
      document,
      openState(document),
      values,
      board,
      results,
      undefined,
      entries,
    );
    expect([...entries.record()]).toEqual([["days", "21"]]);
  });

  test("an entry that is no text, is empty or is over 200 characters is dropped or cut", () => {
    const { values, results, entries, board } = stores();
    restoreDraft(
      {
        delivery: "immediate",
        questions: {
          [QUESTION]: {
            rev: 1,
            entries: { days: 5, price: "", due: "d".repeat(300) } as unknown as Record<
              string,
              string
            >,
          },
        },
      },
      document,
      openState(document),
      values,
      board,
      results,
      undefined,
      entries,
    );
    expect([...entries.record()]).toEqual([["due", "d".repeat(200)]]);
  });

  test("a record holding an entry and a result for one item keeps the entry and never the result", () => {
    const { values, results, entries, board } = stores();
    restoreDraft(
      {
        delivery: "immediate",
        questions: { [QUESTION]: { rev: 1, entries: { days: "21" }, results: { days: 21 } } },
      },
      document,
      openState(document),
      values,
      board,
      results,
      () => ({ fits: () => true }),
      entries,
    );
    expect(entries.valueOf("days")).toBe("21");
    expect(results.valueOf("days")).toBeUndefined();
  });

  test("work that is an entry alone is work: the question's revision is kept", () => {
    const { values, results, entries, board } = stores();
    restoreDraft(
      { delivery: "immediate", questions: { [QUESTION]: { rev: 1, entries: { days: "21" } } } },
      document,
      openState(document),
      values,
      board,
      results,
      undefined,
      entries,
    );
    expect(board.get().questions.get(QUESTION)).toEqual({ rev: 1 });
  });

  test("an entry restored for an item whose type changed under the same ID is dropped, and the question stays answerable", () => {
    // `days` is a TextField now, which holds no entry.
    const changed = documentOf([{ type: "text-field", id: "days", props: { label: "Days" } }]);
    const { values, results, entries, board } = stores(changed);
    restoreDraft(
      { delivery: "immediate", questions: { [QUESTION]: { rev: 1, entries: { days: "21" } } } },
      changed,
      openState(changed),
      values,
      board,
      results,
      undefined,
      entries,
    );
    expect(entries.record().size).toBe(0);
    expect(board.get().questions.get(QUESTION)).toBeUndefined();
    const [next] = questionsOf(changed) as [ViewQuestion];
    expect(fieldBlock(next, new Map([["days", "21"]]), new Map())).toBeUndefined();
  });

  test("an entry makes the work of an answered question a revision, never a stale copy of its answer", () => {
    const { values, results, entries, board } = stores();
    const state = {
      ask: "waiting",
      questions: [
        {
          itemId: QUESTION,
          rev: 1,
          state: "answered",
          answer: { when: "2026-10-29T09:41:27Z", receipt: "sent" },
        },
      ],
    } as unknown as LifecycleBoardState;
    restoreDraft(
      { delivery: "immediate", questions: { [QUESTION]: { rev: 1, entries: { days: "21" } } } },
      document,
      state,
      values,
      board,
      results,
      undefined,
      entries,
    );
    // The answer holds no entry, so the draft differs from it: a revision, kept.
    expect(entries.valueOf("days")).toBe("21");
  });
});

describe("an entry for an item an update removed (design decision 3)", () => {
  test("dropStaleEntries removes the entries of items the document no longer holds as entry items", () => {
    const entries = createDraftStore();
    entries.set("days", "21");
    entries.set("price", "x");
    entries.set("gone", "y");
    const later = documentOf([
      { type: "number-field", id: "days", props: { label: "Days" } },
      { type: "text-field", id: "price", props: { label: "Price" } },
    ]);
    dropStaleEntries(later, entries);
    expect([...entries.record()]).toEqual([["days", "21"]]);
  });

  test("an entry for another question's item is kept for that question", () => {
    const entries = createDraftStore();
    entries.set("days", "21");
    dropStaleEntries(document, entries);
    expect(entries.valueOf("days")).toBe("21");
  });
});

describe("an entry blocks Answer (view-and-widgets spec; NFR-10)", () => {
  const draft = { values: { days: 21 } };
  const card = (fieldBlock: boolean) =>
    cardState({
      status: { itemId: QUESTION, rev: 1, state: "open" },
      draft,
      load: "visible",
      ready: false,
      fieldBlock,
    });

  test("while the question holds an entry, Answer is disabled; clearing it enables it", () => {
    expect(card(false).canAnswer).toBe(true);
    expect(card(true).canAnswer).toBe(false);
    expect(card(false).canAnswer).toBe(true);
  });

  test("an entry beside a note disables Answer too, so the note alone is not sent under it", () => {
    const withNote = cardState({
      status: { itemId: QUESTION, rev: 1, state: "open" },
      draft: { note: "Why" },
      load: "visible",
      ready: false,
      fieldBlock: true,
    });
    expect(withNote.canAnswer).toBe(false);
  });

  test("the first field in error, in the question's order, is named in the button's description", () => {
    const held = new Map([
      ["due", "tomorrow-ish"],
      ["days", "21"],
    ]);
    expect(fieldBlock(question, held, new Map())).toEqual({
      itemId: "days",
      label: "Days",
      kind: "entry",
    });
    expect(answerHint(question, held, new Map(), "en-US")).toBe("Correct Days first.");
    expect(answerHint(question, held, new Map(), "it-IT")).toBe("Correggi prima Days.");
    expect(answerHint(question, new Map(), new Map(), "en-US")).toBeUndefined();
    expect(answerHint(question, new Map([["name", "x"]]), new Map(), "en-US")).toBeUndefined();
  });

  test("a label the item lacks falls back to its ID, and the agent's text goes in as text", () => {
    const odd = documentOf([
      { type: "number-field", id: "n1", props: {} },
      { type: "number-field", id: "n2", props: { label: "{label} <b>x</b>" } },
    ]);
    const [oddQuestion] = questionsOf(odd) as [ViewQuestion];
    expect(answerHint(oddQuestion, new Map([["n1", "x"]]), new Map(), "en-US")).toBe(
      "Correct n1 first.",
    );
    expect(answerHint(oddQuestion, new Map([["n2", "x"]]), new Map(), "en-US")).toBe(
      "Correct {label} <b>x</b> first.",
    );
  });
});

describe("answering with an entry held sends nothing (NFR-10, AD-10)", () => {
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
    const { values, results, entries, board } = stores();
    const context = {
      channel,
      acts: createAnswerActs(),
      draft: values,
      results,
      entries,
      board,
      derived: createDerivedStore(),
      delivery: "immediate" as const,
      facts: () => ({ fits: () => true }),
    };
    return { sent, values, results, entries, board, context };
  };

  test("a press of Answer on a question that holds an entry sends no message and holds no act", () => {
    const { sent, values, entries, board, context } = setUp();
    values.set("due", "2026-12-09");
    entries.set("days", "21");
    expect(answer(question, context)).toBeUndefined();
    expect(sent).toEqual([]);
    expect(board.work(QUESTION)?.held).toBeUndefined();
  });

  test("with the entry cleared the same press sends the answer", () => {
    const { sent, values, entries, context } = setUp();
    values.set("due", "2026-12-09");
    entries.set("days", "21");
    entries.set("days", undefined);
    answer(question, context);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "answer", values: { due: "2026-12-09" } });
  });

  test("in submitted delivery an answer marked ready is unmarked by an entry typed after it", () => {
    const { values, entries, board } = stores();
    values.set("due", "2026-12-09");
    board.edit(QUESTION, 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    entries.set("days", "2");
    expect(board.work(QUESTION)?.held).toBeUndefined();
  });

  test("dropping a question's work drops its entries, and filling it from an answer clears them", () => {
    const { values, results, entries, board, context } = setUp();
    entries.set("days", "21");
    values.set("due", "2026-12-09");
    dropWork(question, context);
    expect(entries.record().size).toBe(0);
    expect(board.work(QUESTION)).toBeUndefined();
    entries.set("price", "x");
    fillFrom(question, { results: {} }, context);
    expect(entries.record().size).toBe(0);
    expect(results.record().size).toBe(0);
  });
});

describe("the callbacks an item gets for its entry (AD-9)", () => {
  const callbacksFor = (itemId: string, entryAllowed = true) => {
    const draft = createDraftStore();
    const results = createDraftStore();
    const entries = createDraftStore();
    const onError = mock((_error: unknown) => {});
    const onBeforeChange = mock(() => {});
    const callbacks = itemCallbacks({
      draft,
      results,
      entries,
      entryAllowed,
      itemId,
      questionId: QUESTION,
      itemIds: ["days", "price", "due"],
      onBeforeChange,
      onError,
    });
    return { draft, results, entries, onError, onBeforeChange, ...callbacks };
  };

  test("onEntryChange runs the step before a change and holds the text; undefined removes it", () => {
    const { entries, onBeforeChange, onEntryChange } = callbacksFor("days");
    onEntryChange("21");
    expect(entries.valueOf("days")).toBe("21");
    expect(onBeforeChange).toHaveBeenCalledTimes(1);
    onEntryChange(undefined);
    expect(entries.record().has("days")).toBe(false);
    expect(onBeforeChange).toHaveBeenCalledTimes(2);
  });

  test("an empty text holds nothing, and a long one is cut at 200 code points", () => {
    const { entries, onEntryChange } = callbacksFor("days");
    onEntryChange("21");
    onEntryChange("");
    expect(entries.record().size).toBe(0);
    onEntryChange("9".repeat(500));
    expect(entries.valueOf("days")).toBe("9".repeat(200));
  });

  test("an entry and a result of one item never coexist: each clears the other", () => {
    const { results, entries, onEntryChange, onResultChange } = callbacksFor("days");
    onResultChange(21);
    expect(results.valueOf("days")).toBe(21);
    onEntryChange("21x");
    expect(results.valueOf("days")).toBeUndefined();
    expect(entries.valueOf("days")).toBe("21x");
    onResultChange(5);
    expect(results.valueOf("days")).toBe(5);
    expect(entries.valueOf("days")).toBeUndefined();
  });

  test("a text that is no string holds nothing and fails the item", () => {
    const { entries, onError, onEntryChange } = callbacksFor("days");
    for (const bad of [5, {}, ["1"], true]) onEntryChange(bad as unknown as string);
    expect(entries.record().size).toBe(0);
    expect(onError).toHaveBeenCalledTimes(4);
  });

  test("an item that holds no entry fails when it reports one, and nothing is held", () => {
    const { entries, onError, onEntryChange } = callbacksFor("name", false);
    onEntryChange("typed");
    expect(entries.record().size).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0]?.[0])).toContain("name");
  });
});
