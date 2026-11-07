import { describe, expect, test } from "bun:test";
import { checkedScaleProps } from "./props.ts";

// The Scale checks its props as an agent's before it shows (design decision 8): the contract's own
// checks, then the shape the view's unchecked props might lack; a problem throws, naming the item,
// and the item's error boundary fails it (AD-10).
describe("checkedScaleProps", () => {
  test("a slider, a range and a rating of valid props pass and come back as they were", () => {
    for (const props of [
      { min: 0, max: 100, step: 5, unit: "%" },
      { min: 0, max: 100, step: 5, range: true },
      { min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High" },
    ]) {
      expect(checkedScaleProps("share", props)).toBe(props as never);
    }
  });

  test("props that are no object, or whose bounds are no numbers, throw, naming the item", () => {
    for (const props of [undefined, null, [], "x", { min: "0", max: 10 }, { min: 0 }, { max: 5 }]) {
      expect(() => checkedScaleProps("share", props)).toThrow(
        'the Scale "share" refuses its props',
      );
    }
  });

  test("a bound that is not finite, a field of the wrong type and an unknown display throw", () => {
    for (const props of [
      { min: 0, max: Number.POSITIVE_INFINITY },
      { min: Number.NaN, max: 4 },
      { min: 0, max: 10, step: "1" },
      { min: 0, max: 10, range: "yes" },
      { min: 0, max: 10, unit: 3 },
      { min: 0, max: 10, minLabel: 3 },
      { min: 0, max: 10, display: "dial" },
    ]) {
      expect(() => checkedScaleProps("share", props)).toThrow('the Scale "share"');
    }
  });

  test("the contract's checks apply: max above min, whole steps, a rating's limits", () => {
    for (const props of [
      { min: 5, max: 5 },
      { min: 0, max: 10, step: 3 },
      { min: 0, max: 10, step: 0.001 },
      { min: 1, max: 5, display: "rating", range: true },
      { min: 0, max: 20, display: "rating" },
    ]) {
      expect(() => checkedScaleProps("share", props)).toThrow(
        'the Scale "share" refuses its props',
      );
    }
  });
});
