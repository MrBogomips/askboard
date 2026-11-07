import { describe, expect, test } from "bun:test";
import type { DraftRecord } from "@askboard/contract";
import { draftHolds, draftResultOf } from "./draft-results.ts";

const record = (results?: Record<string, unknown>): DraftRecord => ({
  delivery: "immediate",
  questions: results === undefined ? {} : { plan: { rev: 1, results } },
});

describe("the result a draft record holds for a widget item", () => {
  test("none when nothing was mirrored, or the question holds no unsent work", () => {
    expect(draftResultOf([], "plan", "share")).toBeUndefined();
    expect(draftResultOf([record()], "plan", "share")).toBeUndefined();
    expect(draftHolds([], "plan", "share", undefined)).toBe(true);
    expect(draftHolds([], "plan", "share", { value: 1 })).toBe(false);
  });

  test("the latest record decides, as a record or as a message holding one", () => {
    const first = record({ share: { value: 35 } });
    const second = record({ share: { value: 40 } });
    expect(draftResultOf([first, second], "plan", "share")).toEqual({ value: 40 });
    expect(
      draftResultOf(
        [
          { type: "draft", record: first },
          { type: "draft", record: second },
        ],
        "plan",
        "share",
      ),
    ).toEqual({
      value: 40,
    });
    expect(draftHolds([first, record()], "plan", "share", undefined)).toBe(true);
  });

  test("an item with no result is none, and a name from the prototype is no result", () => {
    const held = record({ share: { value: 35 } });
    expect(draftResultOf([held], "plan", "other")).toBeUndefined();
    expect(draftResultOf([held], "plan", "constructor")).toBeUndefined();
    expect(draftResultOf([held], "constructor", "share")).toBeUndefined();
  });

  test("compares deeply, so key order does not matter and a different value does", () => {
    const held = record({ range: { low: 40, high: 70 } });
    expect(draftHolds([held], "plan", "range", { high: 70, low: 40 })).toBe(true);
    expect(draftHolds([held], "plan", "range", { low: 40, high: 71 })).toBe(false);
  });
});
