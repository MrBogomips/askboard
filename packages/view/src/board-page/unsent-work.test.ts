import { describe, expect, test } from "bun:test";
import type { DraftRecord } from "@askboard/contract";
import { hasUnsentWork } from "./unsent-work.ts";

// View-and-widgets: The prefill is remembered (reopen-start-from-answer, design decision 4): a
// question whose work holds only the prefill mark is no unsent work, so no leave-page prompt shows.
describe("the unsent work of a draft record holding the prefill mark", () => {
  const record = (questions: DraftRecord["questions"]): DraftRecord => ({
    delivery: "immediate",
    questions,
  });

  test("a mark alone is no unsent work", () => {
    expect(hasUnsentWork(record({ plan: { rev: 2, prefilled: true } }))).toBe(false);
  });

  test("a mark beside a value, a note or another question's work still is", () => {
    expect(
      hasUnsentWork(record({ plan: { rev: 2, prefilled: true, values: { roadmap: { a: 1 } } } })),
    ).toBe(true);
    expect(hasUnsentWork(record({ plan: { rev: 2, prefilled: true, note: "n" } }))).toBe(true);
    expect(
      hasUnsentWork(record({ plan: { rev: 2, prefilled: true }, other: { rev: 1, note: "n" } })),
    ).toBe(true);
  });

  test("a record with no question holds none", () => {
    expect(hasUnsentWork(record({}))).toBe(false);
    expect(hasUnsentWork(undefined)).toBe(false);
  });
});
