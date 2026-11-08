// What a question's revision shares with another (reopen-start-from-answer, design decision 1): the
// IDs of the question and of its items, at any depth, whose props are equal, so a board that holds
// only the current revision can tell what the agent changed since an answer. Pure: the revisions are
// the model's frozen props, which a molecule's expansion has already settled, each read with the
// context its own send resolved, as the board document shows them (review 1.3 X-1).

import { mapNestedItems, nestedItemsOf, type QuestionProps } from "@askboard/contract";
import { canonicalize } from "../canonical.ts";
import { boardPropsOf } from "../context/board-props.ts";
import type { QuestionContext } from "../context/resolve.ts";

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

/** One revision of a question: its props as the agent sent them, and what its send resolved. */
export type Revision = {
  readonly props: QuestionProps;
  readonly context: QuestionContext | undefined;
};

/**
 * The IDs unchanged between two revisions of one question: its own when the props are equal whole,
 * and each item's whose type and props are equal in both, compared canonically as the board shows
 * them, each revision's pointers resolved as its own send read them (an unresolved pointer
 * compares as itself). `[]` when the props cannot be compared: absence reads as "all unchanged" on
 * a current answer, so a comparison that fails must say nothing is (NFR-10).
 */
export const unchangedItems = (questionId: string, before: Revision, after: Revision): string[] => {
  comparisons += 1;
  try {
    const shownBefore = boardPropsOf(before.props, before.context) as QuestionProps;
    const shownAfter = boardPropsOf(after.props, after.context) as QuestionProps;
    const was = fingerprints(shownBefore);
    const now = fingerprints(shownAfter);
    const [, ...held] = itemIdsOfQuestion(questionId, after.props);
    const items = held.filter((id) => now.has(id) && was.get(id) === now.get(id));
    const own = canonicalize(shownBefore) === canonicalize(shownAfter) ? [questionId] : [];
    return [...own, ...items];
  } catch {
    // Props are JSON, which `canonicalize` takes, and a molecule reference never reaches a stored
    // revision; what either refuses is not compared.
    return [];
  }
};
