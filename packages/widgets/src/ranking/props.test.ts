import { describe, expect, test } from "bun:test";
import { checkedRankingProps } from "./props.ts";

// The Ranking checks its props as an agent's before it shows (design decision 8): the shape the
// view's unchecked props might lack, then the contract's own checks; a problem throws, naming the
// item, and the item's error boundary fails it (AD-10).
const items = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta", description: "The second" },
];

describe("checkedRankingProps", () => {
  test("props of two or more elements pass and come back as they were", () => {
    const props = { items };
    expect(checkedRankingProps("priorities", props)).toBe(props as never);
  });

  test("props that are no object, or hold no list of elements, throw, naming the item", () => {
    for (const props of [undefined, null, [], "x", {}, { items: "a" }, { items: null }]) {
      expect(() => checkedRankingProps("priorities", props)).toThrow(
        'the Ranking "priorities" refuses its props',
      );
    }
  });

  test("an element with no string ID or label, or a description of the wrong type, throws", () => {
    for (const bad of [
      { label: "x" },
      { id: 3, label: "x" },
      { id: "a" },
      { id: "a", label: 3 },
      { id: "a", label: "x", description: 3 },
      "a",
      null,
    ]) {
      expect(() => checkedRankingProps("priorities", { items: [bad, items[1]] })).toThrow(
        'the Ranking "priorities"',
      );
    }
  });

  test("fewer than two elements, and more than fifty, throw", () => {
    expect(() => checkedRankingProps("priorities", { items: [items[0]] })).toThrow("2");
    const many = Array.from({ length: 51 }, (_, at) => ({ id: `i${at}`, label: `Item ${at}` }));
    expect(() => checkedRankingProps("priorities", { items: many })).toThrow("50");
  });

  test("the contract's check applies: an ID held twice throws", () => {
    expect(() =>
      checkedRankingProps("priorities", { items: [items[0], { id: "a", label: "Again" }] }),
    ).toThrow("held twice");
  });
});
