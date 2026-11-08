// The field block (form-widget, task 3.1; view-and-widgets spec: A field check blocks Answer, Answer
// names the field to fix, A tab holding a field that fails a check; design decision 5; NFR-10,
// AD-10, AD-20): the first field of a question, at any depth, that holds an entry, fails its check
// or is required and empty stops "Answer", "Accept recommended", "Select recommended", Submit and
// the ready mark. The checks are the facts a test gives (the contract's own functions, as a field
// chunk registers them), so no component is rendered.

import { describe, expect, test } from "bun:test";
import {
  type LifecycleBoardState,
  numberFieldFieldCheck,
  patternRunCount,
  textFieldFieldCheck,
  textFieldPatternFailure,
  textFieldResultProblems,
  textFieldResultShape,
  toggleFieldCheck,
} from "@askboard/contract";
import { ARRANGED_ITEM, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createBoardContent, withEntries } from "./board-content.ts";
import { connectDrafts, createBoardDraft, draftRecordOf, resultFits } from "./board-draft.ts";
import { acceptRecommended, answer, keepMine } from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { answerHint, fieldBlock, holdsBlock } from "./field-block.ts";
import { cardState } from "./question-state.ts";
import {
  confirmedPress,
  heldWithBlock,
  heldWorkOf,
  selectRecommended,
  submitPress,
  submitStateOf,
} from "./submit.ts";

// The facts a field chunk registers for its type, over the contract's functions.
const FACTS: Readonly<Record<string, ComponentFacts>> = {
  "text-field": {
    fits: (result, props) =>
      textFieldResultShape(result) &&
      textFieldResultProblems(result, props as Record<string, unknown>).length === 0,
    check: (result, props) =>
      textFieldFieldCheck(result, props) ?? textFieldPatternFailure(result, props),
  },
  "number-field": { fits: (result) => typeof result === "number", check: numberFieldFieldCheck },
  toggle: { fits: (result) => typeof result === "boolean", check: toggleFieldCheck },
};
const factsOf = (type: string): ComponentFacts | undefined => FACTS[type];
// The same types with no check registered: the shell must never block on them.
const NO_CHECKS = (type: string): ComponentFacts | undefined => {
  const facts = FACTS[type];
  return facts === undefined ? undefined : { ...facts, check: undefined as never };
};

const [first] = plainChoiceBoardDocument.items;
const OPTIONS = [{ label: "Yes", recommended: true }, { label: "No" }];

// The same item with the props of the item `id` replaced, wherever it nests.
const patched = (node: unknown, id: string, props: Record<string, unknown>): unknown => {
  if (Array.isArray(node)) return node.map((each) => patched(each, id, props));
  if (typeof node !== "object" || node === null) return node;
  const record = node as Record<string, unknown>;
  const next = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, patched(value, id, props)]),
  );
  return record.id === id ? { ...next, props } : next;
};

// The arranged item with the Owner TextField's and the notify Toggle's props replaced.
const arranged = (
  owner: Record<string, unknown>,
  notify: Record<string, unknown> = {},
): WidgetItem =>
  patched(patched(ARRANGED_ITEM, "plan-owner", { label: "Owner", ...owner }), "plan-notify", {
    label: "Notify the team",
    ...notify,
  }) as WidgetItem;

const questionOf = (item: WidgetItem, rev = 1): ViewQuestion =>
  ({
    ...first,
    id: "plan",
    rev,
    props: { ...first.props, text: "Plan?", options: OPTIONS, items: [item] },
  }) as unknown as ViewQuestion;
const documentOf = (question: ViewQuestion): ViewDocument =>
  ({ ...plainChoiceBoardDocument, items: [question] }) as unknown as ViewDocument;

const NONE = new Map<string, unknown>();
const held = (...pairs: [string, unknown][]) => new Map<string, unknown>(pairs);

describe("the first blocking field", () => {
  const question = questionOf(arranged({ pattern: "^[A-Z]+$", required: true }));

  test("a value that fails its check blocks as a check, naming the field", () => {
    expect(fieldBlock(question, NONE, held(["plan-owner", "abc"]), factsOf)).toEqual({
      itemId: "plan-owner",
      label: "Owner",
      kind: "check",
    });
  });

  test("an empty required field blocks as required, and a value that passes does not", () => {
    expect(fieldBlock(question, NONE, NONE, factsOf)).toEqual({
      itemId: "plan-owner",
      label: "Owner",
      kind: "required",
    });
    expect(fieldBlock(question, NONE, held(["plan-owner", "ABC"]), factsOf)?.itemId).not.toBe(
      "plan-owner",
    );
  });

  test("an entry blocks as an entry", () => {
    const entryQuestion = questionOf(arranged({}));
    expect(fieldBlock(entryQuestion, held(["plan-hours", "12,5"]), NONE, factsOf)).toEqual({
      itemId: "plan-hours",
      label: "Hours",
      kind: "entry",
    });
  });

  test("the first in document order wins, at any depth: the Tabs' first panel before the second", () => {
    const both = questionOf(arranged({ pattern: "^[A-Z]+$" }, { required: true }));
    expect(fieldBlock(both, NONE, held(["plan-owner", "abc"]), factsOf)?.itemId).toBe("plan-owner");
    expect(fieldBlock(both, NONE, held(["plan-owner", "ABC"]), factsOf)).toEqual({
      itemId: "plan-notify",
      label: "Notify the team",
      kind: "required",
    });
  });

  test("false and 0 hold a value for a required field", () => {
    const toggle = questionOf(arranged({}, { required: true }));
    expect(fieldBlock(toggle, NONE, held(["plan-notify", false]), factsOf)).toBeUndefined();
    expect(fieldBlock(toggle, NONE, NONE, factsOf)?.kind).toBe("required");
  });

  test("a type that registers no check never blocks, whatever its props say", () => {
    expect(fieldBlock(question, NONE, NONE, NO_CHECKS)).toBeUndefined();
    expect(fieldBlock(question, NONE, held(["plan-owner", "abc"]), NO_CHECKS)).toBeUndefined();
    expect(holdsBlock(question, NONE, NONE, () => undefined)).toBe(false);
  });

  test("a layout is no field, and a result for an item the question lacks blocks nothing", () => {
    expect(fieldBlock(question, NONE, held(["plan-tabs", "x"], ["elsewhere", 1]), factsOf)).toEqual(
      {
        itemId: "plan-owner",
        label: "Owner",
        kind: "required",
      },
    );
  });
});

describe("what the disabled Answer is described by (view-and-widgets spec)", () => {
  const question = questionOf(arranged({ pattern: "^[A-Z]+$", required: true }));

  test("a value that fails a check or an entry reads Correct, an empty required field Complete", () => {
    expect(answerHint(question, NONE, held(["plan-owner", "abc"]), "en-US", factsOf)).toBe(
      "Correct Owner first.",
    );
    expect(answerHint(question, NONE, NONE, "en-US", factsOf)).toBe("Complete Owner first.");
    expect(
      answerHint(question, held(["plan-hours", "x"]), held(["plan-owner", "AB"]), "en-US", factsOf),
    ).toBe("Correct Hours first.");
  });

  test("both languages, the label as text, and none while nothing blocks", () => {
    expect(answerHint(question, NONE, NONE, "it-IT", factsOf)).toBe("Completa prima Owner.");
    expect(answerHint(question, NONE, held(["plan-owner", "abc"]), "it-IT", factsOf)).toBe(
      "Correggi prima Owner.",
    );
    const odd = questionOf(arranged({ label: "{label} <b>x</b>", required: true }));
    expect(answerHint(odd, NONE, NONE, "en-US", factsOf)).toBe("Complete {label} <b>x</b> first.");
    expect(
      answerHint(question, NONE, held(["plan-owner", "ABC"]), "en-US", factsOf),
    ).toBeUndefined();
  });
});

describe("the card's state while a field blocks", () => {
  const open = { itemId: "plan", rev: 1, state: "open" } as const;
  const card = (fieldBlock: boolean, ready = false) =>
    cardState({
      status: open,
      draft: { values: { a: 1 } },
      load: "visible",
      ready,
      fieldBlock,
    });

  test("Answer is disabled and a held answer is no longer ready; once every field passes each works again", () => {
    expect(card(false, true)).toMatchObject({ canAnswer: true, ready: true });
    expect(card(true, true)).toMatchObject({ canAnswer: false, ready: false });
    expect(card(false, true)).toMatchObject({ canAnswer: true, ready: true });
  });
});

const openState = (question: ViewQuestion): LifecycleBoardState => ({
  ask: "waiting",
  questions: [{ itemId: question.id, rev: question.rev, state: "open" }],
});

const setUp = (question: ViewQuestion, delivery: "immediate" | "submitted" = "immediate") => {
  const sent: ViewMessage[] = [];
  const channel: ViewChannel = {
    send: async (message) => {
      sent.push(message);
      return { outcome: "sent", actionId: "AAAAAAAAAAAAAAAAAAAAAA" };
    },
    onUpdate: () => () => {},
    onTheme: () => () => {},
  };
  const values = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const board = createBoardDraft(delivery);
  connectDrafts(documentOf(question), values, board, results, entries);
  const context = {
    channel,
    acts: createAnswerActs(),
    draft: values,
    results,
    entries,
    board,
    derived: createDerivedStore(),
    delivery,
    facts: factsOf,
  };
  return { sent, values, results, entries, board, context };
};

describe("a failing check, an empty required field and an entry stop Answer and Accept recommended (NFR-10, AD-10)", () => {
  const question = questionOf(arranged({ pattern: "^[A-Z]+$", required: true }));

  test("a pattern not met: nothing is sent, marked or held; the corrected text sends", () => {
    const { sent, values, results, board, context } = setUp(question);
    values.set("plan", ["Yes"]);
    results.set("plan-owner", "ab-1234");
    expect(answer(question, context)).toBeUndefined();
    expect(sent).toEqual([]);
    expect(board.work("plan")?.held).toBeUndefined();
    results.set("plan-owner", "AB");
    answer(question, context);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "answer", results: { "plan-owner": "AB" } });
  });

  test("an empty required field stops an answer that holds only the question's choice", () => {
    const { sent, values, context } = setUp(question);
    values.set("plan", ["Yes"]);
    answer(question, context);
    expect(sent).toEqual([]);
  });

  test("an entry stops it too", () => {
    const { sent, values, results, entries, context } = setUp(question);
    values.set("plan", ["Yes"]);
    results.set("plan-owner", "AB");
    entries.set("plan-hours", "12,5");
    answer(question, context);
    expect(sent).toEqual([]);
  });

  test("Accept recommended selects nothing and sends nothing while a field blocks", () => {
    const { sent, values, context } = setUp(question);
    expect(acceptRecommended(question, context)).toBeUndefined();
    expect(values.valueOf("plan")).toBeUndefined();
    expect(sent).toEqual([]);
  });

  test("Accept recommended goes through once every field passes", () => {
    const { sent, results, context } = setUp(question);
    results.set("plan-owner", "AB");
    acceptRecommended(question, context);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "answer", choice: ["Yes"] });
  });

  test("in submitted delivery Answer holds nothing while a field blocks", () => {
    const { values, board, context } = setUp(question, "submitted");
    values.set("plan", ["Yes"]);
    answer(question, context);
    expect(board.work("plan")?.held).toBeUndefined();
  });
});

describe("Select recommended leaves a blocked question unmarked (design decision 5)", () => {
  const question = questionOf(arranged({ pattern: "^[A-Z]+$", required: true }));
  const select = (question: ViewQuestion) => {
    const stores = setUp(question, "submitted");
    const count = selectRecommended(
      documentOf(question),
      openState(question),
      { ...stores.context, board: stores.board },
      () => false,
    );
    return { ...stores, count };
  };

  test("the selection stays, nothing is marked ready, while a field blocks", () => {
    const { count, values, board } = select(question);
    expect(count).toBe(1);
    expect(values.valueOf("plan")).toEqual(["Yes"]);
    expect(board.work("plan")?.held).toBeUndefined();
  });

  test("with every field passing the selection is marked ready for Submit", () => {
    const open = questionOf(arranged({}));
    const { board } = select(open);
    expect(board.work("plan")?.held).toMatchObject({ act: "answer", byRecommended: true });
  });
});

describe("a held answer whose field blocks (design decision 5)", () => {
  const question = questionOf(arranged({ pattern: "^[A-Z]+$", required: true }));
  const document = documentOf(question);
  const state = openState(question);
  const base = {
    document,
    delivery: "submitted" as const,
    connection: undefined,
    lock: undefined,
    pending: () => false,
    sending: () => false,
    facts: factsOf,
  };

  const marked = () => {
    const stores = setUp(question, "submitted");
    stores.results.set("plan-owner", "AB");
    stores.values.set("plan", ["Yes"]);
    stores.board.edit("plan", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    return stores;
  };

  test("an edit that makes a field fail takes the ready mark off", () => {
    const { results, board } = marked();
    expect(board.work("plan")?.held).toBeDefined();
    results.set("plan-owner", "ab");
    expect(board.work("plan")?.held).toBeUndefined();
    const { results: cleared, board: other } = marked();
    cleared.set("plan-owner", undefined);
    expect(other.work("plan")?.held).toBeUndefined();
  });

  test("a held answer that outlived its block (an agent's update) sends nothing and names the question", () => {
    const { values, results, entries, board } = marked();
    // The held mark stays as a path other than the card's could leave it.
    const failing = new Map<string, unknown>([["plan-owner", "ab"]]);
    const pressed = submitPress(
      document,
      board.get(),
      values.record(),
      new Date(),
      () => undefined,
      {
        results: failing,
        entries: entries.record(),
        state,
        facts: factsOf,
      },
    );
    expect(pressed).toEqual({ kind: "field-block", questionId: "plan" });
    expect(confirmedPress([], false, pressed)).toEqual({ kind: "field-block", questionId: "plan" });
    const sentOk = submitPress(
      document,
      board.get(),
      values.record(),
      new Date(),
      () => undefined,
      {
        results: results.record(),
        state,
        facts: factsOf,
      },
    );
    expect(sentOk.kind).toBe("send");
  });

  test("Submit is disabled while a held answer's field fails its check or is empty and required", () => {
    const { board, results, entries } = marked();
    const submit = (resultRecord: ReadonlyMap<string, unknown>) =>
      submitStateOf({
        ...base,
        board: board.get(),
        entries: entries.record(),
        results: resultRecord,
      });
    expect(submit(results.record()).disabled).toBe(false);
    expect(submit(new Map([["plan-owner", "ab"]])).disabled).toBe(true);
    expect(submit(new Map()).disabled).toBe(true);
    expect(submit(new Map([["plan-owner", "ab"]])).held).toBe(1);
  });

  test("a block on a question with no held answer, or a held postpone, stops nothing", () => {
    const { board } = setUp(question, "submitted");
    board.edit("plan", 1, () => ({ rev: 1, held: { act: "postpone", order: 0 } }));
    const held = heldWorkOf(document, board.get());
    expect(heldWithBlock(document, held, NONE, NONE, factsOf)).toBeUndefined();
    expect(heldWithBlock(document, held, undefined, undefined, factsOf)).toBeUndefined();
  });
});

describe("the board carries the IDs of fields that fail a check (layouts: the Tabs' mark)", () => {
  const question = questionOf(arranged({ pattern: "^[A-Z]+$", required: true }));
  const boardOf = () =>
    createBoardContent(() => ({
      document: documentOf(question),
      state: { ask: "waiting", questions: [] } as never,
    }))(new Map());

  test("a check failing on a value adds the field's ID; an empty required field adds none", () => {
    const board = boardOf();
    expect(withEntries(board, new Map(), new Map(), factsOf)).toBe(board);
    expect(withEntries(board, new Map(), undefined, factsOf)).toBe(board);
    const marked = withEntries(board, new Map(), held(["plan-owner", "abc"]), factsOf);
    expect([...(marked.entries ?? [])]).toEqual(["plan-owner"]);
    expect(withEntries(board, new Map(), held(["plan-owner", "ABC"]), factsOf)).toBe(board);
  });

  test("an entry and a failing check both mark, and the same set gives the same board", () => {
    const board = boardOf();
    const results = held(["plan-owner", "abc"]);
    const marked = withEntries(board, held(["plan-hours", "x"]), results, factsOf);
    expect([...(marked.entries ?? [])].sort()).toEqual(["plan-hours", "plan-owner"]);
    expect(withEntries(board, held(["plan-hours", "x"]), results, factsOf)).toBe(
      withEntries(board, held(["plan-hours", "x"]), results, factsOf),
    );
  });

  test("a result for no item of the board marks nothing, and a type with no check never marks", () => {
    const board = boardOf();
    expect(withEntries(board, new Map(), held(["elsewhere", "abc"]), factsOf)).toBe(board);
    expect(withEntries(board, new Map(), held(["plan-owner", "abc"]), NO_CHECKS)).toBe(board);
  });
});

describe("an agent's update to a field with a draft value (design decision 5; review note on task 1.3)", () => {
  const before = questionOf(arranged({}), 1);
  const stores = (item: WidgetItem, rev: number) => {
    const question = questionOf(item, rev);
    return { question, ...setUp(question) };
  };

  test("an update adding required to another field keeps the value and blocks Answer", () => {
    const { question, results, entries, board, context } = stores(
      arranged({}, { required: true }),
      2,
    );
    results.set("plan-owner", "abc");
    board.edit("plan", 1, () => ({ rev: 1 }));
    keepMine(question, context, question);
    expect(results.valueOf("plan-owner")).toBe("abc");
    expect(fieldBlock(question, entries.record(), results.record(), factsOf)).toEqual({
      itemId: "plan-notify",
      label: "Notify the team",
      kind: "required",
    });
    expect(before.rev).toBe(1);
  });

  test("an update adding a pattern the text fails keeps a text of at most 100 characters and blocks Answer", () => {
    const text = "x".repeat(100);
    const { question, results, entries, board, context } = stores(
      arranged({ pattern: "^[A-Z]+$" }),
      2,
    );
    results.set("plan-owner", text);
    board.edit("plan", 1, () => ({ rev: 1 }));
    expect(resultFits(question, "plan-owner", text, factsOf)).toBe(true);
    keepMine(question, context, question);
    expect(results.valueOf("plan-owner")).toBe(text);
    expect(fieldBlock(question, entries.record(), results.record(), factsOf)?.kind).toBe("check");
  });

  test("an update adding a pattern to a field whose draft text is over 100 characters drops that text", () => {
    const text = "x".repeat(101);
    const { question, results, board, context } = stores(arranged({ pattern: "^[A-Z]+$" }), 2);
    results.set("plan-owner", text);
    board.edit("plan", 1, () => ({ rev: 1 }));
    expect(resultFits(question, "plan-owner", text, factsOf)).toBe(false);
    keepMine(question, context, question);
    expect(results.valueOf("plan-owner")).toBeUndefined();
    // The same text on the earlier props, with no pattern, fits.
    expect(resultFits(before, "plan-owner", text, factsOf)).toBe(true);
  });

  test("a reloaded draft record keeps the failing text and drops the one that no longer fits", () => {
    const question = questionOf(arranged({ pattern: "^[A-Z]+$" }), 1);
    const document = documentOf(question);
    const { values, results, entries, board } = setUp(question);
    results.set("plan-owner", "abc");
    board.edit("plan", 1, (work) => work);
    const record = draftRecordOf(
      document,
      values.record(),
      board.get(),
      results.record(),
      entries.record(),
    );
    expect(record.questions.plan?.results?.["plan-owner"]).toBe("abc");
  });
});

describe("a keystroke runs a field's pattern once (form-widget, task 3.5; design decision 3)", () => {
  // Every reader of one results record: the board's failing IDs, the card's block and hint, the
  // TextField's own render, and Submit's state (the pattern is the contract's memoized one).
  const question = questionOf(arranged({ pattern: "^C*C*C*C{50}$", required: true }));
  const boardOf = () =>
    createBoardContent(() => ({
      document: documentOf(question),
      state: { ask: "waiting", questions: [] } as never,
    }))(new Map());
  const readers = (text: string) => {
    const results = held(["plan-owner", text]);
    const board = boardOf();
    withEntries(board, new Map(), results, factsOf);
    holdsBlock(question, NONE, results, factsOf);
    answerHint(question, NONE, results, "en-US", factsOf);
    fieldBlock(question, NONE, results, factsOf);
    factsOf("text-field")?.check?.(text, {
      label: "Owner",
      pattern: "^C*C*C*C{50}$",
      required: true,
    });
  };

  test("four readers of one record and text run it once; a changed text, once more", () => {
    const before = patternRunCount();
    readers("C".repeat(99));
    readers("C".repeat(99));
    expect(patternRunCount() - before).toBe(1);
    readers(`${"C".repeat(99)}!`);
    expect(patternRunCount() - before).toBe(2);
  });

  test("a keystroke in another field runs no pattern again", () => {
    readers("C".repeat(98));
    const before = patternRunCount();
    const results = held(["plan-owner", "C".repeat(98)], ["plan-hours", 3]);
    withEntries(boardOf(), new Map(), results, factsOf);
    holdsBlock(question, NONE, results, factsOf);
    expect(patternRunCount() - before).toBe(0);
  });
});

describe("a keystroke in a form of 200 patterned fields runs one pattern (review X-1)", () => {
  // The agent chooses the count: 200 filled TextFields, each with a pattern of its own, past the
  // capacity of any bounded memo of (pattern, text), read by every reader of the shell.
  const FIELDS = 200;
  const ids = Array.from({ length: FIELDS }, (_, at) => `f${at}`);
  const textOf = (at: number) => `f${at}-1`;
  const items = ids.map(
    (id, at) =>
      ({
        type: "text-field",
        id,
        props: { label: `Field ${at}`, pattern: `^f${at}-\\d+$`, required: true },
      }) as unknown as WidgetItem,
  );
  const question = {
    ...first,
    id: "plan",
    rev: 1,
    props: { ...first.props, text: "Plan?", options: OPTIONS, items },
  } as unknown as ViewQuestion;
  const board = createBoardContent(() => ({
    document: documentOf(question),
    state: { ask: "waiting", questions: [] } as never,
  }))(new Map());
  const readers = (results: Map<string, unknown>) => {
    withEntries(board, new Map(), results, factsOf);
    holdsBlock(question, NONE, results, factsOf);
    answerHint(question, NONE, results, "en-US", factsOf);
    fieldBlock(question, NONE, results, factsOf);
    for (const item of items) factsOf(item.type)?.check?.(results.get(item.id), item.props);
  };
  const filled = (changed?: [string, string]) =>
    new Map<string, unknown>(
      ids.map((id, at) => [id, changed?.[0] === id ? changed[1] : textOf(at)]),
    );

  test("the first read runs each pattern once; four readers and a second read run none", () => {
    const before = patternRunCount();
    readers(filled());
    expect(patternRunCount() - before).toBe(FIELDS);
    readers(filled());
    readers(filled());
    expect(patternRunCount() - before).toBe(FIELDS);
  });

  test("one keystroke in one field runs that field's pattern once, whatever else the shell reads", () => {
    readers(filled());
    const before = patternRunCount();
    readers(filled(["f150", "f150-12"]));
    readers(filled(["f150", "f150-12"]));
    expect(patternRunCount() - before).toBe(1);
    readers(filled(["f150", "f150-x"]));
    expect(patternRunCount() - before).toBe(2);
  });
});
