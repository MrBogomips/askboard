import { describe, expect, mock, test } from "bun:test";
import {
  ganttBoardDocument,
  lifecycleBoardDocument,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewDocument, WidgetItem } from "../view-document.ts";
import { createReadyTracker, type QuestionItems, questionItemsOf } from "./ready-tracker.ts";

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
