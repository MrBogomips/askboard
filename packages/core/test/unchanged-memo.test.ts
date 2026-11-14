import { describe, expect, test } from "bun:test";
import { TIMELINE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import type { BoardModel, QuestionRecord } from "../src/lifecycle/model.ts";
import { unchangedComparisons } from "../src/lifecycle/unchanged.ts";
import { type Item, modelOf } from "./probe-fakes.ts";

const copy = <T>(value: T): T => structuredClone(value);

const group = {
  type: "group",
  id: "side",
  props: { title: "Side", items: [TIMELINE_FIXTURE_ITEM] },
};

// Review 1.3 X-2: the memo holds only the pairs at the question's current revision.
describe("the memo of comparisons", () => {
  const revised = (n: number) => ({ text: `Version ${n}`, items: [copy(group)] }) as never;
  const kept = (): { model: BoardModel; question: QuestionRecord } => {
    const model = modelOf([copy(group) as Item]);
    const question = model.questions()[0] as QuestionRecord;
    question.previousRev = 1;
    return { model, question };
  };

  test("after revisions and a prune it holds only pairs at the current revision", () => {
    const { model, question } = kept();
    for (let n = 2; n <= 6; n += 1) {
      model.revise(question, revised(n));
      model.unchangedSince(question, 1);
      model.unchangedSince(question, n - 1 === 1 ? 1 : n - 1);
      expect(model.unchangedMemoSize(question.id)).toBeLessThanOrEqual(2);
    }
    expect(model.unchangedMemoSize(question.id)).toBe(2);
  });

  test("a pruned pair is compared again, and gives the same list", () => {
    const { model, question } = kept();
    model.revise(question, revised(2));
    const first = model.unchangedSince(question, 1);
    model.revise(question, revised(3));
    expect(model.unchangedMemoSize(question.id)).toBe(0);
    const before = unchangedComparisons();
    model.unchangedSince(question, 1);
    expect(unchangedComparisons() - before).toBe(1);
    expect(first).toEqual(model.unchangedSince(question, 1));
  });

  test("a copy holds the current pairs and no stale one", () => {
    const { model, question } = kept();
    model.revise(question, revised(2));
    model.unchangedSince(question, 1);
    model.revise(question, revised(3));
    model.unchangedSince(question, 1);
    const copied = model.clone();
    expect(copied.unchangedMemoSize(question.id)).toBe(1);
    model.revise(question, revised(4));
    expect(model.unchangedMemoSize(question.id)).toBe(0);
    expect(copied.unchangedMemoSize(question.id)).toBe(1);
  });

  test("a comparison made on a copy is not seen by the model it was copied from", () => {
    const { model, question } = kept();
    model.revise(question, revised(2));
    model.revise(question, revised(3));
    model.unchangedSince(question, 1);
    const copied = model.clone();
    const copiedQuestion = copied.questions()[0] as QuestionRecord;
    copied.unchangedSince(copiedQuestion, 2);
    expect(copied.unchangedMemoSize(question.id)).toBe(2);
    expect(model.unchangedMemoSize(question.id)).toBe(1);
  });

  test("a question's pairs go with the question", () => {
    const { model, question } = kept();
    model.revise(question, revised(2));
    model.unchangedSince(question, 1);
    model.delete(question.id);
    expect(model.unchangedMemoSize(question.id)).toBe(0);
  });

  test("what a send resolves of the current revision drops the pairs compared before it", () => {
    const { model, question } = kept();
    model.revise(question, revised(2));
    model.unchangedSince(question, 1);
    model.resolved(question.id, new Map());
    expect(model.unchangedMemoSize(question.id)).toBe(0);
  });
});
