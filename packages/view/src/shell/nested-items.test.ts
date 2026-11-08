import { describe, expect, test } from "bun:test";
import { ganttShape } from "@askboard/contract";
import {
  ARRANGED_ITEM,
  ganttPlanBoardDocument,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { componentsOf, nestedRenderedOf, renderedOf } from "../catalog/components.ts";
import { type ComponentFacts, componentFacts, register } from "../catalog/port.ts";
import { nestedWidgetItemsOf } from "../nested-items.ts";
import type {
  ViewDocument,
  ViewQuestion,
  ViewQuestionProps,
  WidgetItem,
} from "../view-document.ts";
import {
  boardItemsOf,
  createAnsweredResults,
  createBoardContent,
  widgetItemsByQuestion,
  withEntries,
} from "./board-content.ts";
import {
  connectDrafts,
  createBoardDraft,
  draftRecordOf,
  hasAnswerWork,
  itemIdsOf,
  restoreDraft,
  resultFits,
  valueDropped,
  valueFits,
} from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";
import { entryIdsOf } from "./entries.ts";
import { answerHint, fieldBlock } from "./field-block.ts";
import { draftAnswerOf } from "./question-state.ts";
import { createReadyTracker, questionItemsOf } from "./ready-tracker.ts";
import { reasonOf } from "./reason.ts";
import { confirmsRevisionOf } from "./revision-confirm.ts";
import { widgetChanges } from "./widget-changes.ts";

// View-and-widgets spec, Items inside layouts (layouts, task 3.1; design decision 6): every reader
// of the shell that asks which items a question holds, what it answers or where an item is, finds
// the items of its layouts at any depth. The layouts are unregistered in the catalog here, so the
// tests read the documents and the readers, not a component.

const [first] = plainChoiceBoardDocument.items;
const markdown: WidgetItem = {
  type: "text",
  id: "plan-note",
  props: { format: "markdown", content: "[docs](https://example.com)" },
};
const money: WidgetItem = { type: "money-field", id: "plan-budget", props: { label: "Budget" } };

// A question `plan` of a Tabs of a Group of a Row, a Stack, and one top-level field.
const planQuestion = (items: readonly WidgetItem[] = [ARRANGED_ITEM, markdown, money]) => {
  const { options: _, ...props } = first.props;
  return {
    ...first,
    id: "plan",
    props: { ...props, text: "Plan?", items },
  } as unknown as ViewQuestion;
};
const documentOf = (question: ViewQuestion): ViewDocument => ({
  ...plainChoiceBoardDocument,
  items: [question],
});

const FIELDS = ["plan-owner", "plan-hours", "plan-notify", "plan-rule"];
const LAYOUTS = ["plan-tabs", "plan-group", "plan-row", "plan-stack"];

describe("the helper over the walker", () => {
  test("lists every item at every depth in document order, layouts included", () => {
    const ids = nestedWidgetItemsOf(planQuestion().props.items).map(({ id }) => id);
    expect(ids).toEqual([
      "plan-tabs",
      "plan-group",
      "plan-row",
      "plan-owner",
      "plan-hours",
      "plan-stack",
      "plan-notify",
      "plan-rule",
      "plan-note",
      "plan-budget",
    ]);
  });

  test("a question with no items has none", () => {
    expect(nestedWidgetItemsOf(undefined)).toEqual([]);
  });
});

describe("what a question holds at every depth", () => {
  const question = planQuestion();

  test("itemIdsOf names every nested item and no layout", () => {
    const ids = itemIdsOf(question);
    for (const id of FIELDS) expect(ids).toContain(id);
    for (const id of LAYOUTS) expect(ids).not.toContain(id);
  });

  test("the card's own list stays the top level, and the tracker and componentsOf walk", () => {
    expect(renderedOf(question).map(({ item }) => item.id)).toEqual([
      "plan-tabs",
      "plan-note",
      "plan-budget",
    ]);
    const nested = nestedRenderedOf(question).map(({ item }) => item.id);
    for (const id of [...LAYOUTS, ...FIELDS]) expect(nested).toContain(id);
    expect(componentsOf(documentOf(question))).toEqual(
      expect.arrayContaining(["tabs", "group", "row", "stack", "text-field", "number-field"]),
    );
    expect(questionItemsOf(documentOf(question))[0]?.itemIds).toEqual(
      expect.arrayContaining([...LAYOUTS, ...FIELDS]),
    );
  });

  test("the tracker waits for a nested item and fails the question on a nested throw", () => {
    const [entry] = questionItemsOf(documentOf(question));
    if (entry === undefined) throw new Error("no entry");
    const events: string[] = [];
    const tracker = createReadyTracker([entry], {
      onVisible: (id) => events.push(`visible ${id}`),
      onFailed: (id, item) => events.push(`failed ${id} ${item}`),
    });
    for (const id of entry.itemIds.filter((each) => each !== "plan-hours")) tracker.readyFor(id)();
    expect(tracker.questionStatus("plan")).toBe("loading");
    tracker.fail("plan-hours", "threw");
    expect(tracker.questionStatus("plan")).toBe("failed");
    expect(events).toEqual(["failed plan plan-hours"]);
  });

  test("board items and each question's items hold the nested ones", () => {
    const document = documentOf(question);
    expect(boardItemsOf(document).map(({ id }) => id)).toEqual(
      expect.arrayContaining([...LAYOUTS, ...FIELDS]),
    );
    expect(widgetItemsByQuestion(document).get("plan")).toEqual(
      expect.arrayContaining([...LAYOUTS, ...FIELDS]),
    );
  });

  test("the answer's values and results are read for nested items", () => {
    const document = documentOf(question);
    const state = {
      ask: "answered",
      questions: [
        {
          itemId: "plan",
          rev: 1,
          state: "answered",
          answer: {
            when: "2026-11-07T09:00:00Z",
            receipt: "sent",
            values: { "plan-hours": 3 },
            results: { "plan-hours": 3, "plan-notify": true },
          },
        },
      ],
    } as never;
    const answered = createAnsweredResults(() => ({ document, state }));
    expect(answered("plan-hours")).toBe(3);
    expect(answered("plan-notify")).toBe(true);
    const board = createBoardContent(() => ({ document, state }))(new Map());
    expect(board.shown.get("plan-hours")).toBe(3);
  });
});

describe("answers and drafts keyed by a nested item", () => {
  const question = planQuestion();

  test("draftAnswerOf holds a nested value and result, and nothing keyed by a layout", () => {
    const values = new Map<string, unknown>([
      ["plan-hours", { x: 1 }],
      ["plan-tabs", { never: true }],
    ]);
    const results = new Map<string, unknown>([
      ["plan-hours", 3],
      ["plan-group", 1],
    ]);
    expect(draftAnswerOf(question, values, results)).toEqual({
      values: { "plan-hours": { x: 1 } },
      results: { "plan-hours": 3 },
    });
  });

  test("the draft record mirrors a nested value, result and entry, and drops a layout's", () => {
    const document = documentOf(question);
    const board = createBoardDraft("immediate");
    const record = draftRecordOf(
      document,
      new Map<string, unknown>([
        ["plan-owner", "x"],
        ["plan-row", 1],
      ]),
      board.get(),
      new Map<string, unknown>([["plan-hours", 3]]),
      new Map<string, unknown>([["plan-budget", "12,5"]]),
    );
    expect(record.questions.plan).toMatchObject({
      values: { "plan-owner": "x" },
      results: { "plan-hours": 3 },
      entries: { "plan-budget": "12,5" },
    });
    expect(Object.keys(record.questions.plan?.values ?? {})).not.toContain("plan-row");
  });

  test("restoring puts a nested value, result and entry back, and a layout's value nowhere", () => {
    const document = documentOf(question);
    const values = createDraftStore();
    const results = createDraftStore();
    const entries = createDraftStore();
    const board = createBoardDraft("immediate");
    const stop = connectDrafts(document, values, board, results, entries);
    restoreDraft(
      {
        delivery: "immediate",
        questions: {
          plan: {
            rev: 1,
            values: { "plan-owner": "x", "plan-row": 1 },
            results: { "plan-hours": 3 },
            entries: { "plan-budget": "12,5" },
          },
        },
      },
      document,
      { ask: "waiting", questions: [{ itemId: "plan", rev: 1, state: "open" }] } as never,
      values,
      board,
      results,
      () => ({ fits: () => true }),
      entries,
    );
    stop();
    expect(values.valueOf("plan-owner")).toBe("x");
    expect(values.valueOf("plan-row")).toBeUndefined();
    expect(results.valueOf("plan-hours")).toBe(3);
    expect(entries.valueOf("plan-budget")).toBe("12,5");
  });

  test("work in a nested item is answer work", () => {
    const held = new Map<string, unknown>([["plan-hours", 3]]);
    expect(hasAnswerWork(question, new Map(), undefined, held)).toBe(true);
    expect(hasAnswerWork(question, new Map(), undefined, new Map(), held)).toBe(true);
    expect(hasAnswerWork(question, new Map([["plan-tabs", 1]]), undefined)).toBe(false);
  });

  test("results and values fit a nested item by its type's facts", () => {
    const facts = (type: string): ComponentFacts | undefined =>
      type === "number-field"
        ? { fits: (result) => result === 3, valueFits: (value) => value === 3 }
        : undefined;
    expect(resultFits(question, "plan-hours", 3, facts)).toBe(true);
    expect(resultFits(question, "plan-hours", 4, facts)).toBe(false);
    expect(valueFits(question, "plan-hours", 4, facts)).toBe(false);
    expect(valueDropped(question, 1, "plan-hours", 4, facts)).toBe(true);
    expect(resultFits(question, "plan-tabs", 3, facts)).toBe(false);
  });

  test("reason and revision confirmation read nested items", () => {
    const pair = { label: "a", missing: "b" } as never;
    const factsOf = (type: string): ComponentFacts | undefined =>
      type === "number-field" ? { reason: () => pair, confirmsRevision: true as const } : undefined;
    expect(reasonOf(question, new Map([["plan-hours", 1]]), undefined, factsOf)).toBe(pair);
    const answered = {
      state: "answered",
      answer: { receipt: "delivered" },
    } as never;
    expect(confirmsRevisionOf(question, answered, factsOf)).toBe(true);
  });
});

describe("entries at every depth", () => {
  const question = planQuestion();

  test("entryIdsOf finds the nested entry fields in document order", () => {
    expect(entryIdsOf(question)).toEqual(["plan-hours", "plan-budget"]);
  });

  test("the hint names the first field with an entry in document order", () => {
    const entries = new Map<string, unknown>([
      ["plan-budget", "x"],
      ["plan-hours", "12,5"],
    ]);
    expect(fieldBlock(question, entries, new Map())).toEqual({
      itemId: "plan-hours",
      label: "Hours",
      kind: "entry",
    });
    expect(answerHint(question, entries, new Map(), "en-US")).toContain("Hours");
  });

  test("the board carries the IDs of the items that hold an entry, the same object while none", () => {
    const board = createBoardContent(() => ({
      document: documentOf(question),
      state: { ask: "waiting", questions: [] } as never,
    }))(new Map());
    expect(withEntries(board, new Map())).toBe(board);
    const held = new Map<string, unknown>([["plan-hours", "12,5"]]);
    const marked = withEntries(board, held);
    expect([...(marked.entries ?? [])]).toEqual(["plan-hours"]);
    expect(withEntries(board, held)).toBe(marked);
  });
});

describe("the agent's change to a nested item", () => {
  const noComponent = () => null;
  if (componentFacts("gantt") === undefined) {
    register("gantt", noComponent, {
      shape: (props) => ganttShape(props as object),
      name: "change.widgetGantt",
    });
  }
  const [{ props: base }] = ganttPlanBoardDocument.items;
  const [tree, plan] = base.items;
  const tabbed = (tasks: unknown): ViewQuestionProps => {
    const tabs = {
      type: "tabs",
      id: "arranged",
      props: {
        tabs: [
          { id: "one", title: "One", items: [tree] },
          {
            id: "two",
            title: "Two",
            items: [
              {
                type: "stack",
                id: "inner",
                props: { items: [{ ...plan, props: { ...plan.props, tasks } }] },
              },
            ],
          },
        ],
      },
    };
    return { ...base, items: [tabs] } as unknown as ViewQuestionProps;
  };

  test("a changed Gantt plan in a Stack in a tab is named with its operations", () => {
    const before = tabbed(plan.props.tasks);
    const after = tabbed({
      ...(plan.props.tasks as object),
      prototype: { dependencies: ["ux", "architecture"] },
      billing: { dependencies: [] },
    });
    expect(widgetChanges(before, after)).toEqual([
      { itemId: plan.id, type: "gantt", operations: 2 },
    ]);
    expect(widgetChanges(before, before)).toEqual([]);
  });
});
