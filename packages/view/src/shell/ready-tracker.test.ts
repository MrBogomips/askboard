import { describe, expect, mock, spyOn, test } from "bun:test";
import {
  ganttBoardDocument,
  lifecycleBoardDocument,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import { createRevisions, shownOfBoard } from "./agent-change.ts";
import { createAttention } from "./attention.ts";
import { createBoardDraft } from "./board-draft.ts";
import { applyDocumentUpdate, connectTracker } from "./document-update.ts";
import { createDraftStore } from "./draft-store.ts";
import { createReadyTracker, type QuestionItems, questionItemsOf } from "./ready-tracker.ts";
import { createStore } from "./store.ts";

const setUp = (questions: readonly QuestionItems[]) => {
  const onVisible = mock((_questionId: string) => {});
  const onFailed = mock((_questionId: string, _itemId: string, _error: string) => {});
  const tracker = createReadyTracker(questions, { onVisible, onFailed });
  return { tracker, onVisible, onFailed };
};

describe("ready tracking: a question is visible once all its items are ready (AD-9, SM-C2)", () => {
  test("a question loads until its item is ready, then is visible, once", () => {
    const { tracker, onVisible } = setUp([{ questionId: "q", itemIds: ["q"] }]);
    expect(tracker.questionStatus("q")).toBe("loading");
    expect(tracker.itemStatus("q")).toBe("pending");
    tracker.readyFor("q")();
    tracker.readyFor("q")();
    expect(tracker.questionStatus("q")).toBe("visible");
    expect(tracker.itemStatus("q")).toBe("ready");
    expect(onVisible.mock.calls).toEqual([["q"]]);
  });

  test("each item's ready callback is one stable function", () => {
    const { tracker } = setUp([{ questionId: "q", itemIds: ["q"] }]);
    expect(tracker.readyFor("q")).toBe(tracker.readyFor("q"));
  });

  test("a question with two items is visible only after both", () => {
    const { tracker, onVisible } = setUp([{ questionId: "q", itemIds: ["a", "b"] }]);
    tracker.readyFor("a")();
    expect(tracker.questionStatus("q")).toBe("loading");
    expect(onVisible).not.toHaveBeenCalled();
    tracker.readyFor("b")();
    expect(tracker.questionStatus("q")).toBe("visible");
  });

  test("an item that fails makes its question failed, never visible (AD-10)", () => {
    const { tracker, onVisible, onFailed } = setUp([{ questionId: "q", itemIds: ["a", "b"] }]);
    tracker.readyFor("a")();
    tracker.fail("b", "the component threw");
    tracker.readyFor("b")();
    expect(tracker.questionStatus("q")).toBe("failed");
    expect(tracker.itemStatus("b")).toBe("failed");
    expect(onVisible).not.toHaveBeenCalled();
    expect(onFailed.mock.calls).toEqual([["q", "b", "the component threw"]]);
  });

  test("an item that fails after its question was visible still fails it, and says so once", () => {
    const { tracker, onFailed } = setUp([{ questionId: "q", itemIds: ["q"] }]);
    tracker.readyFor("q")();
    tracker.fail("q", "later");
    tracker.fail("q", "again");
    expect(tracker.questionStatus("q")).toBe("failed");
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  test("questions are tracked apart", () => {
    const { tracker } = setUp([
      { questionId: "q1", itemIds: ["q1"] },
      { questionId: "q2", itemIds: ["q2"] },
    ]);
    tracker.readyFor("q1")();
    expect(tracker.questionStatus("q1")).toBe("visible");
    expect(tracker.questionStatus("q2")).toBe("loading");
  });

  test("an unknown item or question changes nothing and reads as loading", () => {
    const { tracker, onVisible, onFailed } = setUp([{ questionId: "q", itemIds: ["q"] }]);
    tracker.readyFor("nope")();
    tracker.fail("nope", "x");
    expect(tracker.questionStatus("nope")).toBe("loading");
    expect(tracker.itemStatus("constructor")).toBe("pending");
    expect(onVisible).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  test("subscribers hear each change", () => {
    const { tracker } = setUp([{ questionId: "q", itemIds: ["q"] }]);
    const listener = mock(() => {});
    const unsubscribe = tracker.subscribe(listener);
    tracker.readyFor("q")();
    tracker.readyFor("q")();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    tracker.fail("q", "x");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("a question's items, as the ready tracker counts them (design decision 7)", () => {
  // Test-only documents with a `probe` widget item (design decision 12).
  const [question] = plainChoiceBoardDocument.items;
  const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };
  const { options, ...props } = question.props;
  const holding = (withOptions: boolean): ViewDocument => ({
    ...plainChoiceBoardDocument,
    items: [
      { ...question, props: { ...props, ...(withOptions ? { options } : {}), items: [sketch] } },
    ],
  });

  test("a question with options is its own item", () => {
    expect(questionItemsOf(plainChoiceBoardDocument)).toEqual([
      { questionId: "database", itemIds: ["database"] },
    ]);
  });

  test("a question with only a widget item has that item", () => {
    expect(questionItemsOf(holding(false))).toEqual([
      { questionId: "database", itemIds: ["sketch"] },
    ]);
  });

  test("a question with both has its own ID, then its widget items'", () => {
    expect(questionItemsOf(holding(true))).toEqual([
      { questionId: "database", itemIds: ["database", "sketch"] },
    ]);
  });
});

describe("a board of several questions or of areas (ask-lifecycle, design decision 6)", () => {
  test("an ID released by a change must become ready again when another question introduces it", () => {
    const { tracker } = setUp([{ questionId: "a", itemIds: ["a", "shared"] }]);
    tracker.readyFor("a")();
    tracker.readyFor("shared")();
    tracker.include([
      { questionId: "a", itemIds: ["a"] },
      { questionId: "b", itemIds: ["shared"] },
    ]);
    expect(tracker.questionStatus("b")).toBe("loading");
    tracker.readyFor("shared")();
    expect(tracker.questionStatus("b")).toBe("visible");
  });
  test("items introduced inside a layout keep their question loading until every nested item is ready", () => {
    const initial = plainChoiceBoardDocument;
    const question = initial.items[0];
    const document = {
      ...initial,
      items: [
        {
          ...question,
          props: {
            ...question.props,
            items: [
              {
                type: "group",
                id: "group",
                props: {
                  title: "Fields",
                  items: [{ type: "text-field", id: "nested", props: { label: "New field" } }],
                },
              },
            ],
          },
        },
      ],
    } as unknown as ViewDocument;
    const { tracker } = setUp(questionItemsOf(initial));
    tracker.readyFor(question.id)();
    tracker.include(questionItemsOf(document));
    tracker.readyFor("group")();
    expect(tracker.questionStatus(question.id)).toBe("loading");
    tracker.readyFor("nested")();
    expect(tracker.itemStatus("nested")).toBe("ready");
    expect(tracker.questionStatus(question.id)).toBe("visible");
  });
  test("every question, areas' included, in board order", () => {
    expect(questionItemsOf(lifecycleBoardDocument)).toEqual(
      ["region", "payment", "analytics", "rollout", "erp-export"].map((id) => ({
        questionId: id,
        itemIds: [id],
      })),
    );
  });

  test("a question the agent adds later is tracked and new items hold an existing question loading", () => {
    const visible = mock((_: string) => {});
    const tracker = createReadyTracker([{ questionId: "a", itemIds: ["a"] }], {
      onVisible: visible,
      onFailed: () => {},
    });
    tracker.readyFor("a")();
    tracker.readyFor("b")();
    expect(tracker.questionStatus("b")).toBe("loading");
    tracker.include([
      { questionId: "a", itemIds: ["a", "late"] },
      { questionId: "b", itemIds: ["b"] },
    ]);
    expect(tracker.questionStatus("a")).toBe("loading");
    tracker.readyFor("late")();
    expect(tracker.itemStatus("late")).toBe("ready");
    expect(tracker.questionStatus("a")).toBe("visible");
    tracker.readyFor("b")();
    expect(tracker.questionStatus("b")).toBe("visible");
    expect(visible.mock.calls).toEqual([["a"], ["a"], ["b"]]);
  });

  test("a new item can fail its existing question, and removing it lets the question recover", () => {
    const { tracker, onFailed } = setUp([{ questionId: "a", itemIds: ["old"] }]);
    tracker.readyFor("old")();
    tracker.include([{ questionId: "a", itemIds: ["old", "new"] }]);
    tracker.fail("new", "broken");
    expect(tracker.questionStatus("a")).toBe("failed");
    expect(onFailed.mock.calls).toEqual([["a", "new", "broken"]]);
    tracker.include([{ questionId: "a", itemIds: ["old"] }]);
    expect(tracker.questionStatus("a")).toBe("visible");
  });
});

describe("a Gantt item, counted by its type like any widget item (gantt-widget design decision 10)", () => {
  test("the Gantt question has its Gantt item, and is visible once it is ready", () => {
    const questions = questionItemsOf(ganttBoardDocument);
    expect(questions).toEqual([{ questionId: "schedule-review", itemIds: ["release"] }]);
    const { tracker, onVisible } = setUp(questions);
    expect(tracker.questionStatus("schedule-review")).toBe("loading");
    tracker.readyFor("release")();
    expect(tracker.questionStatus("schedule-review")).toBe("visible");
    expect(onVisible.mock.calls).toEqual([["schedule-review"]]);
  });
});

// The tracker over the shown document (document-review, task 6.19; design decision 15): through
// `document-update.ts`' functions, in production's order. A question whose card shows the revision
// its work was made on waits for that revision's items, never for the current one's.
describe("the ready tracker follows the revision the card shows, through the update step", () => {
  const [plain] = plainChoiceBoardDocument.items;
  const item = (id: string): WidgetItem => ({ type: "text-field", id, props: { label: id } });
  const questionOf = (rev: number, ...ids: readonly string[]): ViewQuestion =>
    ({
      ...plain,
      id: "plan",
      rev,
      props: { ...plain?.props, options: undefined, items: ids.map(item) },
    }) as unknown as ViewQuestion;
  const documentOf = (question: ViewQuestion): ViewDocument =>
    ({ ...plainChoiceBoardDocument, items: [question] }) as unknown as ViewDocument;

  // Revision 1 loaded and its work started, then the update step for revision 2 and the board
  // connection `index.tsx` makes.
  const setUp = (withWork = true) => {
    const first = documentOf(questionOf(1, "t", "a"));
    const revisions = createRevisions();
    revisions.record(first);
    const board = createBoardDraft("immediate");
    const shownOf = shownOfBoard(board, revisions);
    const visible = mock((_questionId: string) => {});
    const failed = mock((_questionId: string, _itemId: string, _error: string) => {});
    const tracker = createReadyTracker(questionItemsOf(first), {
      onVisible: visible,
      onFailed: failed,
    });
    tracker.readyFor("t")();
    tracker.readyFor("a")();
    if (withWork) board.edit("plan", 1, (work) => work);
    let document = first;
    connectTracker(() => document, board, shownOf, tracker);
    const update = (next: ViewDocument) => {
      applyDocumentUpdate(document, next, {
        revisions,
        draft: createDraftStore(),
        results: createDraftStore(),
        entries: createDraftStore(),
        cellEntries: createDraftStore(),
        board,
        shownOf,
        tracker,
        attention: createAttention(first, {
          ask: "waiting",
          questions: [{ itemId: "plan", rev: 1, state: "open" }],
        } as never),
        focus: createStore(undefined),
        removed: createStore(false),
        focused: () => undefined,
      });
      document = next;
    };
    return { tracker, board, update, visible, failed };
  };

  test("revision 2 adds an item to a question whose work is on revision 1: it stays visible and awaits nothing", () => {
    const { tracker, update, visible } = setUp();
    expect(visible.mock.calls).toEqual([["plan"]]);
    update(documentOf(questionOf(2, "t", "a", "d")));
    expect(tracker.questionStatus("plan")).toBe("visible");
    expect(tracker.itemStatus("d")).toBe("pending");
    expect(visible).toHaveBeenCalledTimes(1);
  });

  test("after Reload drops the work, the added item is awaited until it reports ready, then the question is visible", () => {
    const { tracker, board, update, visible } = setUp();
    update(documentOf(questionOf(2, "t", "a", "d")));
    board.forget("plan");
    expect(tracker.questionStatus("plan")).toBe("loading");
    tracker.readyFor("d")();
    expect(tracker.questionStatus("plan")).toBe("visible");
    expect(visible).toHaveBeenCalledTimes(2);
  });

  test("revision 2 removes an item the card still shows: its failure fails the question and is reported", () => {
    const { tracker, update, failed } = setUp();
    update(documentOf(questionOf(2, "a")));
    expect(tracker.questionStatus("plan")).toBe("visible");
    tracker.fail("t", "the item threw");
    expect(tracker.questionStatus("plan")).toBe("failed");
    expect(failed.mock.calls).toEqual([["plan", "t", "the item threw"]]);
  });

  test("an item the card shows reports ready after the update and the question stays visible", () => {
    const { tracker, board, update, visible } = setUp();
    update(documentOf(questionOf(2, "a")));
    // The shown revision's item that remounts reports ready again: nothing moves.
    tracker.readyFor("t")();
    expect(tracker.questionStatus("plan")).toBe("visible");
    // Once the work goes, the card shows revision 2: `t` leaves the question, and a failure of it
    // fails nothing.
    board.forget("plan");
    expect(tracker.questionStatus("plan")).toBe("visible");
    tracker.fail("t", "late");
    expect(tracker.questionStatus("plan")).toBe("visible");
    expect(visible).toHaveBeenCalledTimes(1);
  });

  test("work put back on revision 1 after the update, as a restore does, gives the card revision 1 again: the question awaits that revision's items", () => {
    const { tracker, board, update } = setUp(false);
    update(documentOf(questionOf(2, "a", "d")));
    expect(tracker.questionStatus("plan")).toBe("loading");
    board.edit("plan", 1, (work) => work);
    // `t` is the item of revision 1 the card shows again: awaited until it reports ready; `d`, of
    // revision 2, is not awaited.
    expect(tracker.itemStatus("t")).toBe("pending");
    expect(tracker.questionStatus("plan")).toBe("loading");
    tracker.readyFor("t")();
    expect(tracker.questionStatus("plan")).toBe("visible");
  });

  test("a board change that gives no card another revision includes nothing: the same shown document is not included again", () => {
    const { tracker, board, update } = setUp();
    update(documentOf(questionOf(2, "t", "a", "d")));
    // The first board change after the update meets the shown document the update made.
    board.setInView("other");
    const include = spyOn(tracker, "include");
    for (let change = 0; change < 5; change += 1) board.setInView(change % 2 === 0 ? "plan" : "x");
    board.edit("plan", 1, (work) => ({ ...work, note: "n" }));
    expect(include).toHaveBeenCalledTimes(0);
  });
});
