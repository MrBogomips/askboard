import { describe, expect, test } from "bun:test";
import type { ViewQuestion } from "../view-document.ts";
import { removedNumbersOf } from "./removed-numbers.ts";

const q = (id: string) => ({ id }) as unknown as ViewQuestion;

describe("removedNumbersOf", () => {
  const earlier = ["a", "b", "c", "d"].map(q);
  const numbers = new Map([
    ["a", 1],
    ["b", 2],
    ["c", 3],
    ["d", 4],
  ]);

  test("each removed question keeps its number and the question it stood after", () => {
    expect(removedNumbersOf(earlier, new Set(["a", "d"]), numbers)).toEqual([
      { number: 2, after: "a" },
      { number: 3, after: "a" },
    ]);
  });

  test("a removal at the start stands after nothing", () => {
    expect(removedNumbersOf(earlier, new Set(["b", "c", "d"]), numbers)).toEqual([{ number: 1 }]);
  });

  test("a question without a number leaves none, and nothing removed leaves nothing", () => {
    expect(removedNumbersOf(earlier, new Set(["a", "c", "d"]), new Map())).toEqual([]);
    expect(removedNumbersOf(earlier, new Set(["a", "b", "c", "d"]), numbers)).toEqual([]);
  });
});
