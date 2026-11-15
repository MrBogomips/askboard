import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import { connectDrafts, createBoardDraft } from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";

// A ready mark lost to a field (answering-flow-guidance, design decision 7; spec: Status messages for
// the guided flow, A ready mark lost): an edit that makes a ready answer fail a field's check releases
// the mark and names the field to correct; an edit that leaves it fine says nothing.
const [first] = plainChoiceBoardDocument.items;
const question = {
  ...first,
  id: "plan",
  rev: 1,
  props: {
    ...first?.props,
    text: "Plan?",
    options: [{ label: "Yes" }],
    items: [{ type: "number-field", id: "count", props: { label: "Count" } }],
  },
} as unknown as ViewQuestion;
const document = { ...plainChoiceBoardDocument, items: [question] } as unknown as ViewDocument;

const setUp = () => {
  const values = createDraftStore();
  const entries = createDraftStore();
  const board = createBoardDraft("submitted");
  const lost: string[] = [];
  connectDrafts(
    document,
    values,
    board,
    undefined,
    entries,
    undefined,
    undefined,
    undefined,
    (label) => lost.push(label),
  );
  values.set("plan", ["Yes"] as never);
  board.edit("plan", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
  return { values, entries, board, lost };
};

describe("a ready answer's field edited to fail its check", () => {
  test("is no longer ready, and the field's label is named", () => {
    const { entries, board, lost } = setUp();
    expect(board.work("plan")?.held?.act).toBe("answer");
    entries.set("count", "12x");
    expect(board.work("plan")?.held).toBeUndefined();
    expect(lost).toEqual(["Count"]);
  });

  test("an edit that leaves every field fine releases the mark and says nothing", () => {
    const { values, board, lost } = setUp();
    values.set("plan", ["Other"] as never);
    expect(board.work("plan")?.held).toBeUndefined();
    expect(lost).toEqual([]);
  });
});
