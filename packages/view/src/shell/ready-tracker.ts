// Ready tracking (AD-9, SM-C2, renderer rows 1 and 2): a component is ready once its asynchronous
// work has settled and its content has been laid out once, and a question counts as visible when
// all its items are ready. An item that throws fails its question, which then never counts as
// visible, so nothing is answered on a partial board (AD-10).

import { renderedOf } from "../catalog/components.ts";
import type { ViewDocument } from "../view-document.ts";

export type ItemStatus = "pending" | "ready" | "failed";
export type QuestionStatus = "loading" | "visible" | "failed";

/** A question and the items it is visible with. */
export type QuestionItems = { readonly questionId: string; readonly itemIds: readonly string[] };

/**
 * Each question's items, as it renders them: its own ID when it has options, then its widget
 * items' IDs (design decision 7).
 */
export const questionItemsOf = (document: ViewDocument): QuestionItems[] =>
  document.items.map((question) => ({
    questionId: question.id,
    itemIds: renderedOf(question).map(({ item }) => item.id),
  }));

export type ReadyEvents = {
  /** Once per question, when all its items are ready. */
  readonly onVisible: (questionId: string) => void;
  /** Once per question, for the first item of it that fails. */
  readonly onFailed: (questionId: string, itemId: string, error: string) => void;
};

export type ReadyTracker = {
  /** The item's ready callback: one stable function per item, safe to call more than once. */
  readyFor(itemId: string): () => void;
  fail(itemId: string, error: string): void;
  itemStatus(itemId: string): ItemStatus;
  questionStatus(questionId: string): QuestionStatus;
  subscribe(listener: () => void): () => void;
};

// Which question each item belongs to, and each question's items.
const indexItems = (questions: readonly QuestionItems[]) => {
  const questionOf = new Map<string, string>();
  const itemsOf = new Map<string, readonly string[]>();
  for (const { questionId, itemIds } of questions) {
    itemsOf.set(questionId, itemIds);
    for (const itemId of itemIds) questionOf.set(itemId, questionId);
  }
  return { questionOf, itemsOf };
};

type Statuses = Pick<ReadyTracker, "itemStatus" | "questionStatus"> & {
  /** Marks a pending item ready; false when that changes nothing. */
  ready(itemId: string): boolean;
  /** Marks an item failed; false when that changes nothing. */
  fail(itemId: string, error: string): boolean;
};

// The items' and the questions' statuses, each question's outcome reported once.
const createStatuses = (questions: readonly QuestionItems[], events: ReadyEvents): Statuses => {
  const { questionOf, itemsOf } = indexItems(questions);
  const items = new Map<string, ItemStatus>();
  const settled = new Map<string, QuestionStatus>();
  const itemStatus = (itemId: string): ItemStatus => items.get(itemId) ?? "pending";
  const questionStatus = (questionId: string): QuestionStatus =>
    settled.get(questionId) ?? "loading";
  return {
    itemStatus,
    questionStatus,
    ready: (itemId) => {
      const questionId = questionOf.get(itemId);
      if (questionId === undefined || itemStatus(itemId) !== "pending") return false;
      items.set(itemId, "ready");
      const all = itemsOf.get(questionId) ?? [];
      if (
        questionStatus(questionId) === "loading" &&
        all.every((id) => itemStatus(id) === "ready")
      ) {
        settled.set(questionId, "visible");
        events.onVisible(questionId);
      }
      return true;
    },
    fail: (itemId, error) => {
      const questionId = questionOf.get(itemId);
      if (questionId === undefined || itemStatus(itemId) === "failed") return false;
      items.set(itemId, "failed");
      if (questionStatus(questionId) !== "failed") {
        settled.set(questionId, "failed");
        events.onFailed(questionId, itemId, error);
      }
      return true;
    },
  };
};

export const createReadyTracker = (
  questions: readonly QuestionItems[],
  events: ReadyEvents,
): ReadyTracker => {
  const statuses = createStatuses(questions, events);
  const callbacks = new Map<string, () => void>();
  const listeners = new Set<() => void>();
  const notify = (changed: boolean) => {
    if (changed) for (const listener of listeners) listener();
  };
  return {
    readyFor: (itemId) => {
      const existing = callbacks.get(itemId);
      if (existing !== undefined) return existing;
      const callback = () => notify(statuses.ready(itemId));
      callbacks.set(itemId, callback);
      return callback;
    },
    fail: (itemId, error) => notify(statuses.fail(itemId, error)),
    itemStatus: statuses.itemStatus,
    questionStatus: statuses.questionStatus,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
