import { describe, expect, test } from "bun:test";
import { type Numbers, numbersOf } from "./question-numbers.ts";

// Short question numbers (answering-flow-visual, design decision 6; requirement "Short question
// numbers"): given in board order, kept while the question is on the board, never given twice.
const MAX = 9_999;
const held = (byId: Record<string, number>, next: number): Numbers => ({
  byId: new Map(Object.entries(byId)),
  next,
});
const plain = (numbers: Numbers) => ({
  byId: Object.fromEntries(numbers.byId),
  next: numbers.next,
});

describe("numbersOf", () => {
  test("a first display numbers the questions in board order", () => {
    expect(plain(numbersOf(undefined, ["a", "b", "c"], MAX))).toEqual({
      byId: { a: 1, b: 2, c: 3 },
      next: 4,
    });
  });

  test("a held map is kept, whatever the board order now is", () => {
    const result = numbersOf(held({ a: 1, b: 2, c: 3 }, 4), ["c", "a", "b"], MAX);
    expect(plain(result)).toEqual({ byId: { a: 1, b: 2, c: 3 }, next: 4 });
  });

  test("a question added after Q6 takes the next number", () => {
    const six = held({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }, 7);
    const result = numbersOf(six, ["a", "b", "c", "d", "e", "f", "g"], MAX);
    expect(result.byId.get("g")).toBe(7);
    expect(result.next).toBe(8);
  });

  test("a removed number is never given again, nor after a later addition", () => {
    const first = numbersOf(held({ a: 1, b: 2, c: 3 }, 4), ["a", "c"], MAX);
    expect(plain(first)).toEqual({ byId: { a: 1, c: 3 }, next: 4 });
    const second = numbersOf(first, ["a", "c", "d"], MAX);
    expect(plain(second)).toEqual({ byId: { a: 1, c: 3, d: 4 }, next: 5 });
    const third = numbersOf(second, ["a", "d", "e"], MAX);
    expect(plain(third)).toEqual({ byId: { a: 1, d: 4, e: 5 }, next: 6 });
  });

  test("a restore with questions added meanwhile numbers them after `next` in board order", () => {
    const restored = held({ a: 1, c: 3 }, 4);
    const result = numbersOf(restored, ["x", "a", "y", "c"], MAX);
    expect(plain(result)).toEqual({ byId: { a: 1, x: 4, y: 5, c: 3 }, next: 6 });
  });

  test("`next` never decreases, and is above every held number even when the record says less", () => {
    expect(numbersOf(held({ a: 1, b: 2 }, 10), ["a"], MAX).next).toBe(10);
    expect(numbersOf(held({ a: 5 }, 2), ["a", "b"], MAX).byId.get("b")).toBe(6);
    expect(numbersOf(held({ a: 5 }, 2), ["a", "b"], MAX).next).toBe(7);
  });

  test("a board past the maximum leaves the questions beyond unnumbered", () => {
    const result = numbersOf(undefined, ["a", "b", "c", "d"], 2);
    expect(plain(result)).toEqual({ byId: { a: 1, b: 2 }, next: 3 });
    expect(result.byId.has("c")).toBe(false);
  });

  test("a held number above the maximum is dropped, so it is never shown", () => {
    const result = numbersOf(held({ a: 3 }, 4), ["a", "b"], 2);
    expect(result.byId.has("a")).toBe(false);
    expect(result.next).toBe(3);
  });

  test("a question named like an object member is numbered like any other", () => {
    const result = numbersOf(undefined, ["__proto__", "constructor"], MAX);
    expect(result.byId.get("__proto__")).toBe(1);
    expect(result.byId.get("constructor")).toBe(2);
  });

  test("the same input gives the same output", () => {
    const input = held({ a: 1 }, 2);
    expect(plain(numbersOf(input, ["a", "b"], MAX))).toEqual(
      plain(numbersOf(input, ["a", "b"], MAX)),
    );
  });

  test("it changes nothing it was given", () => {
    const input = held({ a: 1 }, 2);
    numbersOf(input, ["a", "b"], MAX);
    expect(plain(input)).toEqual({ byId: { a: 1 }, next: 2 });
  });
});
