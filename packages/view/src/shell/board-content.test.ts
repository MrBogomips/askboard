import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanBoardDocument,
  ganttPlanEditedValue,
  plainChoiceBoardDocument,
  treeEditedValue,
} from "@askboard/contract/fixtures";
import {
  questionsOf,
  type ViewArea,
  type ViewDocument,
  type ViewQuestion,
  type WidgetItem,
} from "../view-document.ts";
import "../catalog/number-field/index.tsx";
import "../catalog/text-field/index.tsx";
import { type ShownOf, shownDocumentOf } from "./agent-change.ts";
import {
  answeredResultsOf,
  boardItemsOf,
  createAnsweredResults,
  createBoardContent,
  widgetItemsByQuestion,
} from "./board-content.ts";
import { createDraftStore } from "./draft-store.ts";

// The board state with each question open, or with the statuses given in place of some.
const stateOf = (
  document: ViewDocument,
  statuses: readonly LifecycleQuestionStatus[] = [],
): LifecycleBoardState => ({
  ask: "waiting",
  questions: questionsOf(document).map(
    ({ id, rev }) =>
      statuses.find((status) => status.itemId === id) ?? { itemId: id, rev, state: "open" },
  ) as unknown as LifecycleBoardState["questions"],
});

// A question's latest answer, holding widget values as an answer event does (E3's logged answer).
const answered = (
  itemId: string,
  values?: Readonly<Record<string, unknown>>,
  state: "answered" | "declined" = "answered",
): LifecycleQuestionStatus => {
  const answer = {
    ...(values === undefined ? {} : { values }),
    when: "2026-11-03T10:00:00Z",
    receipt: "delivered" as const,
  };
  return { itemId, rev: 1, state, answer };
};

// The board for each draft record over a document whose questions are open, or as answered.
const boardOver = (document: ViewDocument, statuses?: readonly LifecycleQuestionStatus[]) => {
  const state = stateOf(document, statuses);
  return createBoardContent(() => ({ document, state }));
};

// A test-only widget item, never a real widget's (design decision 12 of the tree-widget change).
const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };

const [plain] = plainChoiceBoardDocument.items;
// The plain question with widget items beside its options.
const holding = (items: readonly WidgetItem[]): ViewQuestion => ({
  ...plain,
  props: { ...plain.props, items },
});
const withItems = (items: readonly WidgetItem[]): ViewDocument => ({
  ...plainChoiceBoardDocument,
  items: [holding(items)],
});

// The standalone Gantt's question, and the Gantt plan's question with its Tree.
const [schedule] = ganttBoardDocument.items;
const [release] = schedule.props.items;
const [planQuestion] = ganttPlanBoardDocument.items;
const [wbs, plan] = planQuestion.props.items;

const area = (id: string, items: readonly [ViewQuestion, ...ViewQuestion[]]): ViewArea => ({
  type: "area",
  id,
  props: { title: id, items },
});

// An ask-lifecycle board of areas (ask-lifecycle, design decision 6): the Gantt's question in one
// area, the plain question with a probe item and the plan's question in the other.
const areaBoard: ViewDocument = {
  ...ganttBoardDocument,
  items: [area("timeline", [schedule]), area("scope", [holding([sketch]), planQuestion])],
};

describe("the board's widget items as sent (gantt-widget design decisions 7 and 10)", () => {
  test("a Gantt board gives its Gantt item, as the document holds it", () => {
    const items = boardItemsOf(ganttBoardDocument);
    expect(items).toEqual([release]);
    expect(items[0]).toBe(release);
  });

  test("every widget item of the question, in its order; the question itself is none", () => {
    const second = { ...sketch, id: "second" };
    expect(boardItemsOf(withItems([sketch, second]))).toEqual([sketch, second]);
    expect(boardItemsOf(plainChoiceBoardDocument)).toEqual([]);
  });

  test("a board of areas gives the widget items of each area's questions, in board order, and no question (cross-review H1)", () => {
    expect(boardItemsOf(areaBoard)).toEqual([release, sketch, wbs, plan]);
  });

  test("the list is frozen, one per board document: the same for the same document, a new one for another", () => {
    const items = boardItemsOf(areaBoard);
    expect(Object.isFrozen(items)).toBe(true);
    expect(boardItemsOf(areaBoard)).toBe(items);
    const revised: ViewDocument = { ...areaBoard };
    expect(boardItemsOf(revised)).not.toBe(items);
    expect(boardItemsOf(revised)).toEqual(items);
  });
});

describe("the board a component reads: its items as sent and the draft record (AD-9)", () => {
  test("it holds the document's items and the draft record as they are, read-only", () => {
    const draft = createDraftStore();
    draft.set("release", ganttEditedValue);
    const board = boardOver(ganttBoardDocument)(draft.record());
    expect(board.items).toBe(boardItemsOf(ganttBoardDocument));
    expect(board.draft).toBe(draft.record());
    expect(board.draft.get("release")).toBe(ganttEditedValue);
    expect(Object.isFrozen(board)).toBe(true);
  });

  test("the same object for the same draft record, a new one once the record changes, over the same items", () => {
    const draft = createDraftStore();
    const boardOf = boardOver(ganttBoardDocument);
    const before = boardOf(draft.record());
    expect(boardOf(draft.record())).toBe(before);
    draft.set("release", ganttEditedValue);
    const after = boardOf(draft.record());
    expect(after).not.toBe(before);
    expect(after.items).toBe(before.items);
    expect(before.draft.has("release")).toBe(false);
  });

  test("on a board of areas the Gantt reads the widget items, not the questions (cross-review H1)", () => {
    const board = boardOver(areaBoard)(createDraftStore().record());
    expect(board.items).toEqual([release, sketch, wbs, plan]);
  });

  test("an agent update that replaces the document gives the new document's items: the plan and its Tree it adds (cross-review H1)", () => {
    // The shell's document, which an agent `update.document` replaces (ask-lifecycle, task 6.7).
    let document: ViewDocument = ganttBoardDocument;
    const boardOf = createBoardContent(() => ({ document, state: stateOf(ganttBoardDocument) }));
    const draft = createDraftStore();
    draft.set("release", ganttEditedValue);
    const record = draft.record();
    const before = boardOf(record);
    expect(before.items).toEqual([release]);
    document = { ...ganttBoardDocument, items: [schedule, planQuestion] };
    const after = boardOf(record);
    expect(after).not.toBe(before);
    expect(after.items).toEqual([release, wbs, plan]);
    expect(after.items).toBe(boardItemsOf(document));
    expect(after.draft).toBe(record);
    expect(boardOf(record)).toBe(after);
  });

  test("a later draft change on the same document reuses its items list (cross-review H1)", () => {
    let document: ViewDocument = ganttBoardDocument;
    const boardOf = createBoardContent(() => ({ document, state: stateOf(ganttBoardDocument) }));
    const draft = createDraftStore();
    document = areaBoard;
    const first = boardOf(draft.record());
    draft.set("release", ganttEditedValue);
    const edited = boardOf(draft.record());
    expect(edited).not.toBe(first);
    expect(edited.items).toBe(first.items);
    expect(edited.draft.get("release")).toBe(ganttEditedValue);
  });
});

describe("the board as the user sees it (molecules, design decision 11, option A)", () => {
  // The plan's question answered with both items' edits, as a widget answer holds them.
  const bothAnswered = [
    answered(planQuestion.id, { wbs: treeEditedValue, schedule: ganttPlanEditedValue }),
  ];

  test("with no answer holding a widget value, what each item shows is the draft record itself", () => {
    const draft = createDraftStore();
    draft.set("wbs", treeEditedValue);
    const open = boardOver(ganttPlanBoardDocument)(draft.record());
    expect(open.shown).toBe(open.draft);
    const [database] = plainChoiceBoardDocument.items;
    const chosen = boardOver(plainChoiceBoardDocument, [answered(database.id)])(draft.record());
    expect(chosen.shown).toBe(chosen.draft);
    const declined = boardOver(ganttPlanBoardDocument, [
      answered(planQuestion.id, undefined, "declined"),
    ])(draft.record());
    expect(declined.shown).toBe(declined.draft);
  });

  test("on an answered question, an item with no draft value shows its answer's value, one with a draft value its draft value", () => {
    const draft = createDraftStore();
    const moved = { ...ganttPlanEditedValue, start: "2026-11-23" };
    draft.set("schedule", moved);
    const record = draft.record();
    const board = boardOver(ganttPlanBoardDocument, bothAnswered)(record);
    expect(board.shown.get("wbs")).toBe(treeEditedValue);
    expect(board.shown.get("schedule")).toBe(moved);
  });

  test("an item the current answer leaves out of its unchanged list shows as the agent sent it (reopen-start-from-answer)", () => {
    const [first] = bothAnswered;
    const listed = (unchanged: readonly string[]) =>
      [
        {
          ...first,
          answer: { ...(first as { answer: object }).answer, unchanged },
        },
      ] as unknown as readonly LifecycleQuestionStatus[];
    const board = boardOver(ganttPlanBoardDocument, listed(["schedule"]))(new Map());
    expect(board.shown.get("wbs")).toBeUndefined();
    expect(board.shown.get("schedule")).toBe(ganttPlanEditedValue);
    const empty = boardOver(ganttPlanBoardDocument, listed([]))(new Map());
    expect(empty.shown.size).toBe(0);
  });

  test("the draft record gains nothing the user did not change", () => {
    const draft = createDraftStore();
    const record = draft.record();
    const board = boardOver(ganttPlanBoardDocument, bothAnswered)(record);
    expect(board.shown.get("schedule")).toBe(ganttPlanEditedValue);
    expect(board.draft).toBe(record);
    expect(record.size).toBe(0);
    expect(draft.record()).toBe(record);
  });

  test("an item its question's answer holds no value for shows its props as sent: no entry", () => {
    const board = boardOver(ganttPlanBoardDocument, [
      answered(planQuestion.id, { schedule: ganttPlanEditedValue }),
    ])(createDraftStore().record());
    expect(board.shown.has("wbs")).toBe(false);
    expect(board.shown.get("schedule")).toBe(ganttPlanEditedValue);
  });

  test("an answer's value for an item its question does not hold, or under an inherited name, is shown for no item", () => {
    const named = { ...sketch, id: "constructor" };
    const document: ViewDocument = {
      ...ganttBoardDocument,
      items: [schedule, holding([named])],
    };
    const board = boardOver(document, [answered(plain.id, { release: ganttEditedValue })])(
      createDraftStore().record(),
    );
    expect(board.shown.has("release")).toBe(false);
    expect(board.shown.has("constructor")).toBe(false);
    expect(board.shown).toBe(board.draft);
  });

  test("an answered question in an area shows its answer's values (ask-lifecycle, design decision 6)", () => {
    const board = boardOver(areaBoard, bothAnswered)(createDraftStore().record());
    expect(board.shown.get("wbs")).toBe(treeEditedValue);
  });

  test("one object per items list, draft record and answers: a new state with the same answers keeps it", () => {
    const draft = createDraftStore();
    const document = ganttPlanBoardDocument;
    let state = stateOf(document, bothAnswered);
    const boardOf = createBoardContent(() => ({ document, state }));
    const first = boardOf(draft.record());
    expect(boardOf(draft.record())).toBe(first);
    state = stateOf(document, bothAnswered);
    expect(boardOf(draft.record())).toBe(first);
    state = stateOf(document, [answered(planQuestion.id, { schedule: ganttPlanEditedValue })]);
    const fewer = boardOf(draft.record());
    expect(fewer).not.toBe(first);
    expect(fewer.shown.has("wbs")).toBe(false);
    state = stateOf(document);
    const open = boardOf(draft.record());
    expect(open.shown).toBe(open.draft);
    draft.set("wbs", treeEditedValue);
    state = stateOf(document, bothAnswered);
    const edited = boardOf(draft.record());
    expect(edited).not.toBe(first);
    expect(edited.shown.get("wbs")).toBe(treeEditedValue);
  });
});

describe("the results the board's answers hold (widget-registry, design decision 9)", () => {
  const result = { pick: "a" };
  // The plain question with the test-only `sketch` item, answered with a result for it.
  const question = holding([sketch]);
  const document = { ...plainChoiceBoardDocument, items: [question] } as unknown as ViewDocument;
  const loggedWith = (results: Record<string, unknown>) =>
    ({
      itemId: question.id,
      rev: 1,
      state: "answered",
      answer: { results, when: "2026-11-06T10:00:00Z", receipt: "delivered" },
    }) as unknown as LifecycleQuestionStatus;
  // The probe type takes any result; a NumberField takes a number within its bounds.
  const facts = (type: string) =>
    type === "number-field"
      ? {
          fits: (value: unknown, props: unknown) =>
            typeof value === "number" &&
            value <= ((props as { max?: number }).max ?? Number.POSITIVE_INFINITY),
        }
      : { fits: () => true };
  const sourceOf = (statuses: readonly LifecycleQuestionStatus[]) => ({
    document,
    state: stateOf(document, statuses),
  });

  test("an item gets the result its question's latest answer holds for it, read as an own property", () => {
    const results = answeredResultsOf(sourceOf([loggedWith({ sketch: result })]), facts);
    expect(results.get("sketch")).toBe(result);
    expect(results.size).toBe(1);
  });

  test("a result for an item the question does not hold, or under a prototype key, is not shown", () => {
    const proto = JSON.parse('{"__proto__": 1, "constructor": 2, "elsewhere": 3}');
    expect(answeredResultsOf(sourceOf([loggedWith(proto)]), facts).size).toBe(0);
  });

  test("an open question and an answer with no results show none", () => {
    expect(answeredResultsOf(sourceOf([])).size).toBe(0);
    expect(answeredResultsOf(sourceOf([answered(question.id)])).size).toBe(0);
  });

  test("the board's content is unchanged by results: its shown values are the draft's and the answer's values", () => {
    const board = createBoardContent(() => sourceOf([loggedWith({ sketch: result })]))(new Map());
    expect(board.shown.size).toBe(0);
  });

  test("the lookup follows the board's latest state and document", () => {
    let source = sourceOf([]);
    const resultOf = createAnsweredResults(() => source, facts);
    expect(resultOf("sketch")).toBeUndefined();
    source = sourceOf([loggedWith({ sketch: result })]);
    expect(resultOf("sketch")).toBe(result);
    expect(resultOf("elsewhere")).toBeUndefined();
    expect(resultOf("constructor")).toBeUndefined();
  });

  test("a result its item no longer takes on the item's current props is not shown (decision 2)", () => {
    const days: WidgetItem = { type: "number-field", id: "days", props: { label: "Days", max: 5 } };
    const doc = {
      ...plainChoiceBoardDocument,
      items: [holding([sketch, days])],
    } as unknown as ViewDocument;
    const status = {
      itemId: question.id,
      rev: 2,
      state: "answered",
      answer: {
        results: { days: 7, sketch: result },
        when: "2026-11-06T10:00:00Z",
        receipt: "delivered",
      },
    } as unknown as LifecycleQuestionStatus;
    const results = answeredResultsOf({ document: doc, state: stateOf(doc, [status]) }, facts);
    expect(results.has("days")).toBe(false);
    expect(results.get("sketch")).toBe(result);
  });

  test("the lookup an item reads shows no result for it once the revision no longer takes it", () => {
    const days: WidgetItem = { type: "number-field", id: "days", props: { label: "Days", max: 5 } };
    const doc = {
      ...plainChoiceBoardDocument,
      items: [holding([days])],
    } as unknown as ViewDocument;
    const status = {
      itemId: question.id,
      rev: 2,
      state: "answered",
      answer: { results: { days: 7 }, when: "2026-11-06T10:00:00Z", receipt: "delivered" },
    } as unknown as LifecycleQuestionStatus;
    const resultOf = createAnsweredResults(
      () => ({ document: doc, state: stateOf(doc, [status]) }),
      facts,
    );
    expect(resultOf("days")).toBeUndefined();
  });

  // The shell calls `createAnsweredResults` with no facts, so the gate rests on the default
  // `componentFacts`, which the NumberField's own chunk fills (re-review 2.11 X-2): no stub here.
  test("with the default facts, the real NumberField's chunk hides 7 under max 5 and shows 3", () => {
    const days: WidgetItem = { type: "number-field", id: "days", props: { label: "Days", max: 5 } };
    const doc = {
      ...plainChoiceBoardDocument,
      items: [holding([days])],
    } as unknown as ViewDocument;
    const statusWith = (value: number) =>
      ({
        itemId: question.id,
        rev: 2,
        state: "answered",
        answer: { results: { days: value }, when: "2026-11-06T10:00:00Z", receipt: "delivered" },
      }) as unknown as LifecycleQuestionStatus;
    const source = (value: number) => ({
      document: doc,
      state: stateOf(doc, [statusWith(value)]),
    });
    expect(answeredResultsOf(source(7)).has("days")).toBe(false);
    expect(answeredResultsOf(source(3)).get("days")).toBe(3);
    expect(createAnsweredResults(() => source(7))("days")).toBeUndefined();
    expect(createAnsweredResults(() => source(3))("days")).toBe(3);
  });
});

describe("a component's question items (approval-scale-ranking, design decision 7)", () => {
  const second = { ...sketch, id: "second" };
  const other: ViewQuestion = {
    ...plain,
    id: "other",
    props: { ...plain.props, items: [{ ...sketch, id: "elsewhere" }] },
  };
  const twoQuestions: ViewDocument = {
    ...plainChoiceBoardDocument,
    items: [holding([sketch, second]), other],
  };

  test("a board of two questions maps each to its widget items, in order", () => {
    const map = widgetItemsByQuestion(twoQuestions);
    expect(map.get(plain.id)).toEqual(["sketch", "second"]);
    expect(map.get("other")).toEqual(["elsewhere"]);
    expect([...map.keys()]).toEqual([plain.id, "other"]);
  });

  test("a question with no widget items maps to an empty list", () => {
    expect(widgetItemsByQuestion(plainChoiceBoardDocument).get(plain.id)).toEqual([]);
  });

  test("a board of areas maps the questions of every area", () => {
    const map = widgetItemsByQuestion(areaBoard);
    expect(map.get(schedule.id)).toEqual(["release"]);
    expect(map.get(plain.id)).toEqual(["sketch"]);
    expect(map.get(planQuestion.id)).toEqual([wbs.id, plan.id]);
  });

  test("the same map for the same document, a new one for another, and the lists are frozen", () => {
    const map = widgetItemsByQuestion(twoQuestions);
    expect(widgetItemsByQuestion(twoQuestions)).toBe(map);
    expect(widgetItemsByQuestion({ ...twoQuestions })).not.toBe(map);
    expect(Object.isFrozen(map.get(plain.id))).toBe(true);
  });

  test("the board carries it, the same object across draft records while the document is", () => {
    const draft = createDraftStore();
    const boardOf = boardOver(twoQuestions);
    const before = boardOf(draft.record());
    draft.set("sketch", { size: 4 });
    const after = boardOf(draft.record());
    expect(after).not.toBe(before);
    expect(before.questionItems).toBe(widgetItemsByQuestion(twoQuestions));
    expect(after.questionItems).toBe(before.questionItems);
  });
});

// The board over the shown document (document-review, task 6.19; design decision 15): while a card
// shows the revision its work was made on, every item it reads of the board is that revision's.
describe("the board over the shown document: each question at the revision its card shows", () => {
  const field: WidgetItem = { type: "text-field", id: "who", props: { label: "Who" } };
  const added: WidgetItem = { type: "text-field", id: "added", props: { label: "Added" } };
  // Revision 1 holds the Tree, the plan over it and a field; revision 2 only the field and a new one.
  const first = {
    ...planQuestion,
    rev: 1,
    props: { ...planQuestion.props, items: [wbs, plan, field] },
  };
  const second = {
    ...planQuestion,
    rev: 2,
    props: { ...planQuestion.props, items: [field, added] },
  };
  const current: ViewDocument = {
    ...ganttPlanBoardDocument,
    items: [second],
  } as unknown as ViewDocument;
  const keeping: ShownOf = (question) =>
    question.id === second.id ? (first as ViewQuestion) : question;
  const shownState = stateOf(current, [
    {
      itemId: second.id,
      rev: 2,
      state: "answered",
      answer: {
        values: { [wbs.id]: treeEditedValue },
        results: { who: "Ada" },
        when: "2026-11-03T10:00:00Z",
        receipt: "delivered",
      },
    } as unknown as LifecycleQuestionStatus,
  ]);
  const sourceOver = (document: ViewDocument) => () => ({ document, state: shownState });

  test("gives revision 1's items, its question's items and the answered value of an item only revision 1 holds", () => {
    const shown = shownDocumentOf(current, keeping);
    const draft = createDraftStore();
    const board = createBoardContent(sourceOver(shown))(draft.record());
    expect(board.items.map((item) => item.id)).toEqual([wbs.id, plan.id, "who"]);
    expect(board.questionItems?.get(second.id)).toEqual([wbs.id, plan.id, "who"]);
    expect(board.shown.get(wbs.id)).toBe(treeEditedValue);
    // The board over the current document holds none of them: the readers would fail the question.
    const over = createBoardContent(sourceOver(current))(draft.record());
    expect(over.items.map((item) => item.id)).toEqual(["who", "added"]);
    expect(over.shown.get(wbs.id)).toBeUndefined();
  });

  test("gives the answered result of an item only revision 1 holds", () => {
    const onlyFirst = {
      ...first,
      props: { ...first.props, items: [{ ...field, id: "only-first" }, wbs] },
    } as ViewQuestion;
    const withResult = stateOf(current, [
      {
        itemId: second.id,
        rev: 2,
        state: "answered",
        answer: {
          results: { "only-first": "Grace" },
          when: "2026-11-03T10:00:00Z",
          receipt: "delivered",
        },
      } as unknown as LifecycleQuestionStatus,
    ]);
    const shown = shownDocumentOf(current, () => onlyFirst);
    expect(
      createAnsweredResults(() => ({ document: shown, state: withResult }))("only-first"),
    ).toBe("Grace");
    // Over the current document the item is no item of the question: no result is shown for it.
    expect(
      createAnsweredResults(() => ({ document: current, state: withResult }))("only-first"),
    ).toBeUndefined();
  });

  test("makes one board object per shown document, answers and record, as for any document", () => {
    const draft = createDraftStore();
    const boardOf = createBoardContent(sourceOver(shownDocumentOf(current, keeping)));
    const before = boardOf(draft.record());
    expect(boardOf(draft.record())).toBe(before);
    // The shown document made again for the same shown questions is the same object, so the same board.
    const again = createBoardContent(() => ({
      document: shownDocumentOf(current, keeping),
      state: shownState,
    }));
    expect(again(draft.record())).toBe(again(draft.record()));
    expect(again(draft.record()).items).toBe(before.items);
  });

  // The matrix's P row (design decision 15, Appendix): an item both revisions hold, with other props.
  // Revision 2 links the plan `schedule` to another Tree and asks other durations; the board over
  // the shown document holds revision 1's item, the whole question's, never a mix (re-review 6.20, S-3).
  test("an item both revisions hold with other props reads revision 1's: the plan's link and schedule, and the Tree it links", () => {
    const relinked = {
      ...plan,
      props: { ...plan.props, workPackages: "other-tree", start: "2027-01-04" },
    } as WidgetItem;
    const otherTree = { ...wbs, id: "other-tree" } as WidgetItem;
    const revised = {
      ...first,
      rev: 2,
      props: { ...first.props, items: [otherTree, relinked, field] },
    } as unknown as ViewQuestion;
    const document: ViewDocument = {
      ...ganttPlanBoardDocument,
      items: [revised],
    } as unknown as ViewDocument;
    const draft = createDraftStore();
    const shown = createBoardContent(() => ({
      document: shownDocumentOf(document, () => first as ViewQuestion),
      state: stateOf(document),
    }))(draft.record());
    const held = shown.items.find((item) => item.id === plan.id);
    expect(held).toBe(plan);
    expect(held?.props).toBe(plan.props);
    expect((held?.props as { workPackages?: string } | undefined)?.workPackages).toBe("wbs");
    expect(shown.items.map((item) => item.id)).toEqual([wbs.id, plan.id, "who"]);
    // The board over the current document holds revision 2's link and Tree.
    const over = createBoardContent(() => ({ document, state: stateOf(document) }))(draft.record());
    expect(over.items.find((item) => item.id === plan.id)).toBe(relinked);
    expect(over.items.map((item) => item.id)).toEqual(["other-tree", plan.id, "who"]);
    expect(shown.questionItems?.get(first.id)).toEqual([wbs.id, plan.id, "who"]);
  });

  test("every other question reads its own revision, and the answers and the record are as before", () => {
    const other = { ...schedule, id: "other-question", rev: 1 } as unknown as ViewQuestion;
    const two: ViewDocument = {
      ...ganttPlanBoardDocument,
      items: [second, other],
    } as unknown as ViewDocument;
    const shown = shownDocumentOf(two, (question) =>
      question.id === second.id ? (first as ViewQuestion) : question,
    );
    const draft = createDraftStore();
    draft.set("who", "typed");
    const board = createBoardContent(() => ({ document: shown, state: stateOf(two) }))(
      draft.record(),
    );
    expect(board.draft.get("who")).toBe("typed");
    expect(board.items.map((item) => item.id)).toEqual([wbs.id, plan.id, "who", release.id]);
    expect(board.questionItems?.get("other-question")).toEqual([release.id]);
  });
});
