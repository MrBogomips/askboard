import { describe, expect, test } from "bun:test";
import { DRAFT_RECORD_MAX_CHARS, type DraftRecord, draftRecordChars } from "@askboard/contract";
import { fitDraftRecord } from "./draft-fit.ts";

// The draft mirror keeps whole questions that fit (oversized-acts, design decision 4; AD-20).

// A question whose work is a result of `chars` characters.
const work = (chars: number, rev = 1) => ({ rev, results: { it: "x".repeat(chars) } });
const record = (questions: DraftRecord["questions"]): DraftRecord => ({
  delivery: "immediate",
  questions,
});
const ORDER = ["a", "b", "c", "d"];

describe("a record within the draft limit", () => {
  test("comes back unchanged, the same object, with nothing left out", () => {
    const small = record({ a: work(10), b: work(20) });
    const fitted = fitDraftRecord(small, ORDER);
    expect(fitted?.record).toBe(small);
    expect(fitted?.leftOut).toEqual([]);
  });

  test("exactly at the limit is within it", () => {
    const frame = draftRecordChars(record({ a: work(0) }));
    const exact = record({ a: work(DRAFT_RECORD_MAX_CHARS - frame) });
    expect(draftRecordChars(exact)).toBe(DRAFT_RECORD_MAX_CHARS);
    expect(fitDraftRecord(exact, ORDER)?.leftOut).toEqual([]);
  });
});

describe("a record over the draft limit loses whole questions, the largest first", () => {
  const big = DRAFT_RECORD_MAX_CHARS + 1;

  test("one question over the limit is left out whole; the rest is kept", () => {
    const over = record({ a: work(big), b: work(5) });
    const fitted = fitDraftRecord(over, ORDER);
    expect(fitted?.leftOut).toEqual(["a"]);
    expect(Object.keys(fitted?.record.questions ?? {})).toEqual(["b"]);
    expect(fitted?.record.questions.b).toEqual(work(5));
    expect(fitted?.record.delivery).toBe("immediate");
  });

  test("with two large questions the largest goes first, and the next only if still needed", () => {
    const half = Math.floor(DRAFT_RECORD_MAX_CHARS * 0.6);
    const over = record({ a: work(half), b: work(half + 1000), c: work(10) });
    const fitted = fitDraftRecord(over, ORDER);
    // Removing b (the largest) is enough: a and c stay.
    expect(fitted?.leftOut).toEqual(["b"]);
    expect(Object.keys(fitted?.record.questions ?? {})).toEqual(["a", "c"]);

    const third = Math.floor(DRAFT_RECORD_MAX_CHARS * 0.5) + 1000;
    const both = record({
      a: work(third),
      b: work(third + 500),
      c: work(third + 1000),
      d: work(9),
    });
    const fitted2 = fitDraftRecord(both, ORDER);
    expect(fitted2?.leftOut).toEqual(["c", "b"]);
    expect(Object.keys(fitted2?.record.questions ?? {})).toEqual(["a", "d"]);
  });

  test("questions of equal size leave in board order", () => {
    const size = Math.floor(DRAFT_RECORD_MAX_CHARS / 2) + 100;
    const tied = record({ c: work(size), a: work(size), b: work(size) });
    const fitted = fitDraftRecord(tied, ORDER);
    // Board order a, b, c: a leaves first, which is enough room for the other two? No: two remain
    // over the limit, so b leaves as well.
    expect(fitted?.leftOut).toEqual(["a", "b"]);
    expect(Object.keys(fitted?.record.questions ?? {})).toEqual(["c"]);
  });

  test("a question missing from the board order sorts after the others of its size", () => {
    const size = Math.floor(DRAFT_RECORD_MAX_CHARS / 2) + 100;
    const fitted = fitDraftRecord(record({ z: work(size), a: work(size) }), ORDER);
    expect(fitted?.leftOut).toEqual(["a"]);
  });

  test("the fitted record measures within the limit, and no question is kept in part", () => {
    const sizes = [900_000, 800_000, 700_000, 600_000, 500_000, 400_000];
    const order = sizes.map((_, index) => `q${index}`);
    const questions = Object.fromEntries(order.map((id, index) => [id, work(sizes[index] ?? 0)]));
    const over = record(questions);
    const fitted = fitDraftRecord(over, order);
    expect(fitted).toBeDefined();
    expect(draftRecordChars(fitted?.record)).toBeLessThanOrEqual(DRAFT_RECORD_MAX_CHARS);
    for (const [id, kept] of Object.entries(fitted?.record.questions ?? {})) {
      expect<unknown>(kept).toEqual(questions[id]);
    }
    expect(
      [...(fitted?.leftOut ?? []), ...Object.keys(fitted?.record.questions ?? {})].sort(),
    ).toEqual(order);
  });

  test("the question's other parts leave with it: delivery and the question in view stay", () => {
    const over: DraftRecord = {
      delivery: "submitted",
      inView: "a",
      questions: { a: { ...work(big), note: "n", held: { act: "answer", order: 0 } }, b: work(1) },
    };
    const fitted = fitDraftRecord(over, ORDER);
    expect(fitted?.record.delivery).toBe("submitted");
    expect(fitted?.record.inView).toBe("a");
    expect(fitted?.record.questions).toEqual({ b: work(1) });
  });

  test("a record whose fields outside its questions pass the limit cannot be fitted", () => {
    const hostile = {
      delivery: "immediate",
      inView: "x".repeat(big),
      questions: {},
    } as DraftRecord;
    expect(fitDraftRecord(hostile, ORDER)).toBeUndefined();
  });
});
