// What a question's revision shares with another (reopen-start-from-answer, design decision 1): the
// IDs of the question and of its items, at any depth, whose props are equal, so a board that holds
// only the current revision can tell what the agent changed since an answer. Pure: the revisions are
// the model's frozen props, which a molecule's expansion has already settled.

import { mapNestedItems, nestedItemsOf, type QuestionProps } from "@askboard/contract";
import { canonicalize } from "../canonical.ts";

let comparisons = 0;

/** How many pairs of revisions have been compared in this process; for the tests of the memo. */
export const unchangedComparisons = (): number => comparisons;

const itemsOf = (props: QuestionProps): readonly unknown[] => {
  const { items } = props as { readonly items?: unknown };
  return Array.isArray(items) ? items : [];
};

const idOf = (item: unknown): string | undefined => {
  const { id } = (item ?? {}) as { readonly id?: unknown };
  return typeof id === "string" ? id : undefined;
};

/** The question's own ID and the ID of each item of its props, at any depth, in document order. */
export const itemIdsOfQuestion = (questionId: string, props: QuestionProps): string[] => [
  questionId,
  ...nestedItemsOf(itemsOf(props)).flatMap(({ item }) => {
    const id = idOf(item);
    return id === undefined ? [] : [id];
  }),
];

// Each item's type and props as the item itself, a layout's with the items it holds replaced by
// their IDs, so that an item inside a Group changes the item and never the Group around it; a
// layout is changed by what it arranges, its own props, or by which items it holds and where.
const fingerprints = (props: QuestionProps): Map<string, string> => {
  const found = new Map<string, string>();
  mapNestedItems(itemsOf(props), (item) => {
    const id = idOf(item);
    const { type, props: own } = item as { readonly type?: unknown; readonly props?: unknown };
    if (id !== undefined) found.set(id, canonicalize({ type, props: own }));
    return { id };
  });
  return found;
};

/**
 * The IDs unchanged between two revisions of one question: its own when the props are equal whole,
 * and each item's whose type and props are equal in both (compared canonically). `[]` when the
 * props cannot be compared: absence reads as "all unchanged" on a current answer, so a comparison
 * that fails must say nothing is (NFR-10).
 */
export const unchangedItems = (
  questionId: string,
  before: QuestionProps,
  after: QuestionProps,
): string[] => {
  comparisons += 1;
  try {
    const was = fingerprints(before);
    const now = fingerprints(after);
    const [, ...held] = itemIdsOfQuestion(questionId, after);
    const items = held.filter((id) => now.has(id) && was.get(id) === now.get(id));
    const own = canonicalize(before) === canonicalize(after) ? [questionId] : [];
    return [...own, ...items];
  } catch {
    // Props are JSON, which `canonicalize` takes; a value it refuses is not compared.
    return [];
  }
};
