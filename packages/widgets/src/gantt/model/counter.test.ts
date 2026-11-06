import { describe, expect, test } from "bun:test";
import { counterText, type Lookup } from "./counter.ts";

const TEXT: Lookup = (key, slots) => `${key}${slots === undefined ? "" : `:${slots.count}`}`;

describe("the Gantt counter's text", () => {
  test.each([
    [0, 0, "gantt.counter.none"],
    [1, 0, "gantt.counter.yours:1"],
    [0, 1, "gantt.counter.none · gantt.counter.follows:1"],
    [1, 2, "gantt.counter.yours:1 · gantt.counter.follows:2"],
  ])("read %i changes and %i followers as %j", (count, derived, expected) => {
    expect(counterText(count, derived, TEXT)).toBe(expected);
  });
});
