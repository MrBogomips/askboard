import { describe, expect, mock, test } from "bun:test";
import { JSON_MAX_DEPTH } from "@askboard/contract";
import type { BoardContent } from "../catalog/port.ts";
import { createDraftStore } from "./draft-store.ts";
import { itemCallbacks, itemResultOf, itemValueOf } from "./item-callbacks.ts";

// Test-only `probe` widget values, as a widget's model returns them: a new frozen object per edit
// (tree-widget design decision 12).
type ProbeValue = { readonly size: number };
const probe = (size: number): ProbeValue => Object.freeze({ size });

// The `probe` item `sketch` and its sibling `second` in the question `plan`, whose own ID names
// its options; `other` is an item of another question.
const ITEM_IDS = ["plan", "sketch", "second"] as const;

const setUp = () => {
  const draft = createDraftStore();
  const steps: string[] = [];
  const onBeforeChange = mock(() => {
    steps.push(`before:${draft.record().size}`);
  });
  const onError = mock((_error: unknown) => {});
  const listener = mock(() => {
    steps.push(`heard:${draft.record().size}`);
  });
  draft.subscribe(listener);
  const callbacks = itemCallbacks({
    draft,
    itemId: "sketch",
    questionId: "plan",
    itemIds: ITEM_IDS,
    onBeforeChange,
    onError,
  });
  return { draft, steps, onBeforeChange, onError, listener, ...callbacks };
};

describe("an item's own value (AD-9; ask-lifecycle, task 6.7)", () => {
  test("runs the step before a change, then puts the value in the draft record", () => {
    const { draft, steps, onValueChange } = setUp();
    const value = probe(4);
    onValueChange(value);
    expect(draft.valueOf("sketch")).toBe(value);
    expect(steps).toEqual(["before:0", "heard:1"]);
    onValueChange(undefined);
    expect(draft.record().has("sketch")).toBe(false);
  });

  test("with no step before a change, it only puts the value in", () => {
    const draft = createDraftStore();
    const { onValueChange } = itemCallbacks({
      draft,
      itemId: "sketch",
      questionId: "plan",
      itemIds: ITEM_IDS,
      onError: () => {},
    });
    onValueChange(probe(4));
    expect(draft.valueOf("sketch")).toEqual({ size: 4 });
  });
});

describe("linked edits in one draft update (molecules, design decision 11)", () => {
  test("a probe's own value and its sibling's make one new draft record holding both, after the step before a change, once", () => {
    const { draft, steps, onBeforeChange, listener, onError, onValuesChange } = setUp();
    const before = draft.record();
    const own = probe(4);
    const sibling = probe(5);
    onValuesChange({ sketch: own, second: sibling });
    expect(draft.record()).not.toBe(before);
    expect(draft.valueOf("sketch")).toBe(own);
    expect(draft.valueOf("second")).toBe(sibling);
    expect(onBeforeChange).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(steps).toEqual(["before:0", "heard:2"]);
    expect(onError).not.toHaveBeenCalled();
  });

  test("undefined removes a value in the same update", () => {
    const { draft, listener, onValuesChange } = setUp();
    onValuesChange({ sketch: probe(4), second: probe(5) });
    onValuesChange({ sketch: undefined, second: probe(6) });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(draft.record().has("sketch")).toBe(false);
    expect(draft.valueOf("second")).toEqual({ size: 6 });
  });

  test("an unchanged value keeps its identity", () => {
    const { draft, onValuesChange } = setUp();
    const own = probe(4);
    onValuesChange({ sketch: own, second: probe(5) });
    onValuesChange({ sketch: own, second: probe(6) });
    expect(draft.valueOf("sketch")).toBe(own);
  });

  test("the question's own options are among its items", () => {
    const { draft, onValuesChange } = setUp();
    onValuesChange({ plan: ["Yes"], sketch: probe(4) });
    expect(draft.valueOf("plan")).toEqual(["Yes"]);
  });

  test("an update naming an item of another question leaves the draft record as it was and reports the error through the item's error path", () => {
    const { draft, onBeforeChange, listener, onError, onValuesChange } = setUp();
    onValuesChange({ sketch: probe(3) });
    const before = draft.record();
    onValuesChange({ sketch: probe(4), other: probe(5) });
    expect(draft.record()).toBe(before);
    expect(draft.valueOf("sketch")).toEqual({ size: 3 });
    expect(onBeforeChange).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    const [[error]] = onError.mock.calls as unknown as [[Error]];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'the item "sketch" may not change "other", an item its question "plan" does not hold',
    );
  });

  test("the error names every item outside the question, and an inherited name is one", () => {
    const { draft, onError, onValuesChange } = setUp();
    onValuesChange(
      Object.fromEntries([
        ["other", probe(5)],
        ["__proto__", probe(6)],
      ]),
    );
    expect(draft.record().size).toBe(0);
    const [[error]] = onError.mock.calls as unknown as [[Error]];
    expect(error.message).toBe(
      'the item "sketch" may not change "other" and "__proto__", items its question "plan" does not hold',
    );
  });
});

describe("the value an item shows (molecules, design decision 11)", () => {
  const answered = probe(7);
  const board = (shown: ReadonlyMap<string, unknown>): BoardContent => ({
    items: [],
    draft: new Map(),
    shown,
  });

  test("what the card shows in place of the draft comes first, such as an answer being sent", () => {
    const sent = probe(2);
    expect(itemValueOf(sent, board(new Map([["sketch", answered]])), "sketch")).toBe(sent);
  });

  test("else the board's shown value: on a question being revised, the answer's until the user changes it", () => {
    expect(itemValueOf(undefined, board(new Map([["sketch", answered]])), "sketch")).toBe(answered);
    expect(itemValueOf(undefined, board(new Map()), "sketch")).toBeUndefined();
  });
});

describe("an item's result (widget-registry, design decision 9)", () => {
  const withResults = () => {
    const draft = createDraftStore();
    const results = createDraftStore();
    const steps: string[] = [];
    const sent = mock(() => {});
    const callbacks = itemCallbacks({
      draft,
      results,
      itemId: "sketch",
      questionId: "plan",
      itemIds: ITEM_IDS,
      onBeforeChange: () => steps.push("before"),
      onError: sent,
    });
    return { draft, results, steps, sent, ...callbacks };
  };

  test("a reported result goes into the results store, beside the draft record and apart from it", () => {
    const { draft, results, onResultChange } = withResults();
    const result = { pick: "a" };
    onResultChange(result);
    expect(results.valueOf("sketch")).toBe(result);
    expect(draft.record().size).toBe(0);
  });

  test("none removes the entry, so an item with no result holds none", () => {
    const { results, onResultChange } = withResults();
    onResultChange({ pick: "a" });
    onResultChange(undefined);
    expect(results.record().has("sketch")).toBe(false);
    expect(results.record().size).toBe(0);
  });

  test.each([
    ["{}", {}],
    ["[]", []],
    ["null", null],
    ['""', ""],
    ["{annotations: []}", { annotations: [] }],
  ])(
    "a result that holds nothing (%s) clears the item's result instead of storing it",
    (_, empty) => {
      const { results, onResultChange } = withResults();
      onResultChange({ pick: "a" });
      onResultChange(empty);
      expect(results.record().has("sketch")).toBe(false);
      expect(results.record().size).toBe(0);
    },
  );

  test("false and 0 are content and are stored", () => {
    const { results, onResultChange } = withResults();
    onResultChange({ pick: false });
    expect(results.valueOf("sketch")).toEqual({ pick: false });
  });

  test("the step before a change runs first, as it does for a value, and nothing else is called", () => {
    const { steps, sent, onResultChange } = withResults();
    onResultChange({ pick: "a" });
    expect(steps).toEqual(["before"]);
    expect(sent).not.toHaveBeenCalled();
  });

  describe("a result that is not JSON (approval-scale-ranking, design decision 4)", () => {
    const holdsItself = () => {
      const result: Record<string, unknown> = { pick: "a" };
      result.again = result;
      return result;
    };
    const tooDeep = () => {
      let result: unknown = { pick: "a" };
      for (let level = 0; level < JSON_MAX_DEPTH + 2; level++) result = [result];
      return result;
    };

    test.each([
      ["holds itself", holdsItself],
      ["is nested past the bound", tooDeep],
      ["holds a number that is not finite", () => ({ pick: Number.NaN })],
      ["holds a function", () => ({ pick: () => 1 })],
    ])("a result that %s returns, calls onError once and leaves no held result", (_, make) => {
      const { results, steps, sent, onResultChange } = withResults();
      expect(() => onResultChange(make())).not.toThrow();
      expect(sent).toHaveBeenCalledTimes(1);
      expect((sent.mock.calls as unknown[][])[0]?.[0]).toBeInstanceOf(Error);
      expect(results.record().has("sketch")).toBe(false);
      // A refused result starts no revision.
      expect(steps).toEqual([]);
    });

    test("a refused result clears the result the item held", () => {
      const { results, sent, onResultChange } = withResults();
      onResultChange({ pick: "a" });
      expect(results.valueOf("sketch")).toEqual({ pick: "a" });
      onResultChange(holdsItself());
      expect(results.record().has("sketch")).toBe(false);
      expect(sent).toHaveBeenCalledTimes(1);
    });

    test("a valid result after a refused one is held", () => {
      const { results, sent, onResultChange } = withResults();
      onResultChange(holdsItself());
      onResultChange({ pick: "b" });
      expect(results.valueOf("sketch")).toEqual({ pick: "b" });
      expect(sent).toHaveBeenCalledTimes(1);
    });

    test("a result nested exactly to the bound is held", () => {
      const { results, sent, onResultChange } = withResults();
      let result: unknown = "leaf";
      for (let level = 0; level < JSON_MAX_DEPTH; level++) result = [result];
      onResultChange(result);
      expect(results.valueOf("sketch")).toEqual(result);
      expect(sent).not.toHaveBeenCalled();
    });
  });

  test("an item ID such as __proto__ is a key like any other", () => {
    const results = createDraftStore();
    const { onResultChange } = itemCallbacks({
      draft: createDraftStore(),
      results,
      itemId: "__proto__",
      questionId: "plan",
      itemIds: ["plan", "__proto__"],
      onError: () => {},
    });
    onResultChange(1);
    expect(results.valueOf("__proto__")).toBe(1);
    expect(Object.getPrototypeOf(results.record())).toBe(Map.prototype);
  });

  test("with no results store, a reported result is not held", () => {
    const { onResultChange } = itemCallbacks({
      draft: createDraftStore(),
      itemId: "sketch",
      questionId: "plan",
      itemIds: ITEM_IDS,
      onError: () => {},
    });
    expect(() => onResultChange({ pick: "a" })).not.toThrow();
  });

  test("the result an item shows: what the card shows, else the held one, else its latest answer's", () => {
    expect(itemResultOf("card", "held", "answered")).toBe("card");
    expect(itemResultOf(undefined, "held", "answered")).toBe("held");
    expect(itemResultOf(undefined, undefined, "answered")).toBe("answered");
    expect(itemResultOf(undefined, undefined, undefined)).toBeUndefined();
  });
});
