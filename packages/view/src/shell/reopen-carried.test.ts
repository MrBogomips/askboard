import { describe, expect, test } from "bun:test";
import type { ViewQuestion } from "../view-document.ts";
import type { QuestionWork } from "./board-draft.ts";
import { carriedOf } from "./reopen-prefill.ts";

// View-and-widgets: A reopened question the agent changed starts from the agent's version
// (reopen-start-from-answer, design decision 5; S-1 of re-review 4.5): the reopened notice says the
// previous answer is filled in only while the work on the current revision holds the prefill's
// mark and the board state lists the question itself as unchanged.

const question = { id: "plan", rev: 2 } as unknown as ViewQuestion;
const previous = { unchanged: ["plan", "roadmap"] };
const marked: QuestionWork = { rev: 2, prefilled: true };

describe("carriedOf", () => {
  test("the mark on the current revision and the question listed unchanged: carried", () => {
    expect(carriedOf(question, marked, previous)).toBe(true);
  });

  test("the question not listed unchanged (the agent changed it): not carried, mark or not", () => {
    expect(carriedOf(question, marked, { unchanged: ["roadmap"] })).toBe(false);
    expect(carriedOf(question, marked, { unchanged: [] })).toBe(false);
  });

  test("a previous answer without the list carries nothing", () => {
    expect(carriedOf(question, marked, {})).toBe(false);
  });

  test("no mark, or the mark on another revision, or no work: not carried", () => {
    expect(carriedOf(question, undefined, previous)).toBe(false);
    expect(carriedOf(question, { rev: 2 }, previous)).toBe(false);
    expect(carriedOf(question, { rev: 1, prefilled: true }, previous)).toBe(false);
  });
});
