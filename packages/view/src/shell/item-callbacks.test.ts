import { describe, expect, mock, test } from "bun:test";
import type { BoardContent } from "../catalog/port.ts";
import { createDraftStore } from "./draft-store.ts";
import { itemCallbacks, itemValueOf } from "./item-callbacks.ts";

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
