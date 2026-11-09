// The one bound helper of ask and update warnings (result-bound, design decision 4; Refs #98),
// over plain objects: the formula and the unresolved-pointer warnings both call it.

import { describe, expect, test } from "bun:test";
import { boundedWarnings } from "../src/warning-bound.ts";

type Plain = { readonly id: string; readonly text: string };

const warning = (id: string, text = "x".repeat(40)): Plain => ({ id, text });
const closing = (first: Plain, left: number): Plain => ({
  id: first.id,
  text: `closing, ${left} left`,
});
const json = (list: readonly Plain[]): number => JSON.stringify(list).length;
const options = (max: number, room = 100) => ({ max, room, closing });

describe("within the bound", () => {
  test("a list whose JSON text fits max comes back as the same array", () => {
    const list = [warning("a"), warning("b"), warning("c")];
    expect(boundedWarnings(list, options(json(list)))).toBe(list);
  });

  test("an empty list comes back as it is", () => {
    const list: Plain[] = [];
    expect(boundedWarnings(list, options(10))).toBe(list);
  });
});

describe("past the bound", () => {
  const list = Array.from({ length: 20 }, (_, n) => warning(`w${n}`));

  test("the kept warnings are a prefix in order, the last element is the closing warning", () => {
    const max = json(list) - 1;
    const result = boundedWarnings(list, options(max));
    const kept = result.slice(0, -1);
    expect(kept).toEqual(list.slice(0, kept.length));
    const left = list.length - kept.length - 1;
    expect(result.at(-1)).toEqual(closing(list[kept.length] as Plain, left));
    expect(kept.length + 1 + left).toBe(list.length);
    expect(left).toBeGreaterThan(0);
  });

  test("the kept text plus the room fits max, and one more warning would not", () => {
    const room = 150;
    const max = 600;
    const result = boundedWarnings(list, options(max, room));
    const kept = result.slice(0, -1);
    expect(json(kept) + room).toBeLessThanOrEqual(max);
    expect(json(list.slice(0, kept.length + 1)) + room).toBeGreaterThan(max);
    expect(kept.length).toBeGreaterThan(0);
  });

  test("the closing warning counts the warnings after the first one left out", () => {
    const result = boundedWarnings(list, options(400, 100));
    const kept = result.length - 1;
    expect(result.at(-1)?.text).toBe(`closing, ${list.length - kept - 1} left`);
    expect(result.at(-1)?.id).toBe(`w${kept}`);
  });

  test("only the last warning left out: its closing warning counts none", () => {
    const small = [warning("a"), warning("b"), warning("c")];
    // The list is one character past max, and the room leaves space for two kept warnings only.
    const max = json(small) - 1;
    const room = max - json(small.slice(0, 2));
    expect(room).toBeGreaterThan(0);
    const result = boundedWarnings(small, options(max, room));
    expect(result).toEqual([...small.slice(0, 2), closing(small[2] as Plain, 0)]);
  });

  test("a list is not changed", () => {
    const copy = structuredClone(list);
    boundedWarnings(list, options(300));
    expect(list).toEqual(copy);
  });
});

describe("escapes count", () => {
  test("a warning holding a quote, a backslash and U+0001 is measured as JSON.stringify writes it", () => {
    const escaped = warning("e", '"\\\u0001'.repeat(30));
    expect(JSON.stringify(escaped).length).toBeGreaterThan(escaped.id.length + 90 + 30);
    const list = [escaped, escaped, escaped];
    // Plain length would pass the bound; the escaped length does not.
    const plainLength = list.map((w) => w.text.length + w.id.length + 22).reduce((a, b) => a + b);
    const max = json(list) - 1;
    expect(plainLength).toBeLessThan(max);
    const result = boundedWarnings(list, options(max, 10));
    expect(result.at(-1)?.text).toMatch(/^closing/);
    const kept = result.slice(0, -1);
    expect(json(kept) + 10).toBeLessThanOrEqual(max);
  });
});

describe("a first warning larger than the budget", () => {
  test("gives the closing warning alone, with the full count", () => {
    const list = [warning("big", "y".repeat(500)), warning("b"), warning("c")];
    const result = boundedWarnings(list, options(300, 100));
    expect(result).toEqual([closing(list[0] as Plain, 2)]);
  });

  test("a single warning past the bound gives the closing warning alone, counting none", () => {
    const list = [warning("only", "y".repeat(500))];
    expect(boundedWarnings(list, options(300, 100))).toEqual([closing(list[0] as Plain, 0)]);
  });
});
