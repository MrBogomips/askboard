// Two readers that follow the revision the card shows (document-review, task 6.18; Issue #93;
// view-and-widgets spec: The draft follows the revision the card shows; design decision 15; the
// Appendix's rows 13 and 26): "Start from my previous answer" seeds the results of the items the
// shown revision holds, each checked against that revision's props, and "Select recommended" shows
// while the shown revision recommends an option. Every case differs between the two revisions.

import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import { createRevisions, shownOfBoard } from "./agent-change.ts";
import { createBoardDraft } from "./board-draft.ts";
import { startFromPrevious } from "./card-acts.ts";
import { createDraftStore } from "./draft-store.ts";
import { hasRecommendation } from "./submit.ts";

const [first] = plainChoiceBoardDocument.items;
const field = (id: string, accepts: string): WidgetItem =>
  ({ type: "text-field", id, props: { label: id, accepts } }) as unknown as WidgetItem;
const questionOf = (
  items: readonly WidgetItem[],
  rev: number,
  options: readonly { label: string; recommended?: boolean }[] = [
    { label: "Yes" },
    { label: "No" },
  ],
): ViewQuestion =>
  ({
    ...first,
    id: "plan",
    rev,
    props: { ...first?.props, text: "Plan?", options, items },
  }) as unknown as ViewQuestion;
const documentOf = (question: ViewQuestion): ViewDocument =>
  ({ ...plainChoiceBoardDocument, items: [question] }) as unknown as ViewDocument;

// A result fits an item when it equals the item's `accepts` prop: the check follows the props.
const facts = (type: string): ComponentFacts | undefined =>
  type === "text-field"
    ? { fits: (result, props) => result === (props as { accepts?: string }).accepts }
    : undefined;

// Revision 1 holds `owner` (accepts "x") and `old`; revision 2 changes `owner`'s props (accepts "y"),
// removes `old` and adds `fresh`.
const REV1 = questionOf([field("owner", "x"), field("old", "o")], 1);
const REV2 = questionOf([field("owner", "y"), field("fresh", "f")], 2);
const PREVIOUS = { results: { owner: "x", old: "o", fresh: "f" } } as never;

const setUp = (kept: boolean) => {
  const draft = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const cellEntries = createDraftStore();
  const board = createBoardDraft("immediate");
  const revisions = createRevisions();
  revisions.record(documentOf(REV1));
  revisions.record(documentOf(REV2));
  // "Keep mine": the work stays on revision 1; without it the card shows the current revision.
  if (kept) board.edit("plan", 1, () => ({ rev: 1 }));
  return {
    draft,
    results,
    entries,
    cellEntries,
    board,
    facts,
    shownOf: shownOfBoard(board, revisions),
  };
};

describe("Start from my previous answer after Keep mine (row 13)", () => {
  test("seeds the results of revision 1's items, checked against revision 1's props, and none for an item only revision 2 holds", () => {
    const stores = setUp(true);
    startFromPrevious(REV2, PREVIOUS, stores);
    expect(stores.results.valueOf("owner")).toBe("x");
    expect(stores.results.valueOf("old")).toBe("o");
    expect(stores.results.record().has("fresh")).toBe(false);
  });

  test("with the work on the current revision it seeds that revision's items against its props", () => {
    const stores = setUp(false);
    startFromPrevious(REV2, PREVIOUS, stores);
    expect(stores.results.record().has("owner")).toBe(false);
    expect(stores.results.record().has("old")).toBe(false);
    expect(stores.results.valueOf("fresh")).toBe("f");
  });
});

describe("whether Select recommended shows, on the shown revision (row 26)", () => {
  const recommending = questionOf([], 1, [{ label: "Yes", recommended: true }, { label: "No" }]);
  const plain = questionOf([], 2);
  const recommending2 = questionOf([], 2, [{ label: "Yes", recommended: true }, { label: "No" }]);
  const shownOver = (before: ViewQuestion, after: ViewQuestion, kept: boolean) => {
    const board = createBoardDraft("immediate");
    const revisions = createRevisions();
    revisions.record(documentOf(before));
    revisions.record(documentOf(after));
    if (kept) board.edit("plan", before.rev, () => ({ rev: before.rev }));
    return { document: documentOf(after), shownOf: shownOfBoard(board, revisions) };
  };

  test("holds when only the shown revision recommends", () => {
    const { document, shownOf } = shownOver(recommending, plain, true);
    expect(hasRecommendation(document)).toBe(false);
    expect(hasRecommendation(document, shownOf)).toBe(true);
  });

  test("does not hold when only revision 2 recommends", () => {
    const { document, shownOf } = shownOver(questionOf([], 1), recommending2, true);
    expect(hasRecommendation(document)).toBe(true);
    expect(hasRecommendation(document, shownOf)).toBe(false);
  });

  test("with no work the current revision decides", () => {
    const { document, shownOf } = shownOver(recommending, plain, false);
    expect(hasRecommendation(document, shownOf)).toBe(false);
  });
});
