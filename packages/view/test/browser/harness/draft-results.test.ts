import { describe, expect, test } from "bun:test";
import type { DraftRecord } from "@askboard/contract";
import { draftHolds, draftResultOf, workOf } from "./draft-results.ts";

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

describe("the questions of a draft that hold work", () => {
  const only = (question: Record<string, unknown>): DraftRecord => ({
    delivery: "immediate",
    inView: "plan",
    numbers: { plan: 1 },
    nextNumber: 2,
    questions: { plan: { rev: 1, ...question } as DraftRecord["questions"][string] },
  });

  test("none for no draft, and for a record of numbers and revisions alone", () => {
    expect(workOf([])).toEqual([]);
    expect(workOf([only({})])).toEqual([]);
    expect(workOf([only({ prefilled: true, context: "inline", note: "", values: {} })])).toEqual(
      [],
    );
  });

  test("the question for each kind of work, from the latest record", () => {
    const kinds: Record<string, unknown>[] = [
      { values: { a: 1 } },
      { results: { a: {} } },
      { entries: { a: "x" } },
      { cellEntries: { a: { "r.f": "x" } } },
      { other: "x" },
      { optionNotes: { a: "x" } },
      { note: "x" },
      { composer: "x" },
      { held: { act: "answer", order: 1 } },
    ];
    for (const kind of kinds) expect(workOf([record(), only(kind)])).toEqual(["plan"]);
    // Drafting and then reverting leaves work in an earlier record: it is reported.
    expect(workOf([only({ note: "x" }), only({})])).toEqual(["plan"]);
    expect(workOf([{ type: "draft", record: only({ note: "x" }) }])).toEqual(["plan"]);
  });

  test("from a record on: work before it is not counted, work in any record since is", () => {
    const before = only({ note: "x" });
    expect(workOf([before, only({})], 1)).toEqual([]);
    expect(workOf([before, only({ other: "y" }), only({})], 1)).toEqual(["plan"]);
    expect(workOf([], 3)).toEqual([]);
    expect(workOf([{ type: "draft", record: only({ note: "x" }) }])).toEqual(["plan"]);
  });
});
