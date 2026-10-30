// Ready tracking (AD-9, SM-C2, renderer rows 1 and 2): a component is ready once its asynchronous
// work has settled and its content has been laid out once, and a question counts as visible when
// all its items are ready. An item that throws fails its question, which then never counts as
// visible, so nothing is answered on a partial board (AD-10).

export type ItemStatus = "pending" | "ready" | "failed";
export type QuestionStatus = "loading" | "visible" | "failed";

/** A question and the items it is visible with. E1's question is its own one item. */
export type QuestionItems = { readonly questionId: string; readonly itemIds: readonly string[] };

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

export const createReadyTracker = (
  questions: readonly QuestionItems[],
  events: ReadyEvents,
): ReadyTracker => {
  const questionOf = new Map<string, string>();
  const itemsOf = new Map<string, readonly string[]>();
  for (const { questionId, itemIds } of questions) {
    itemsOf.set(questionId, itemIds);
    for (const itemId of itemIds) questionOf.set(itemId, questionId);
  }
  const items = new Map<string, ItemStatus>();
  const settled = new Map<string, QuestionStatus>();
  const callbacks = new Map<string, () => void>();
  const listeners = new Set<() => void>();

  const itemStatus = (itemId: string): ItemStatus => items.get(itemId) ?? "pending";
  const questionStatus = (questionId: string): QuestionStatus =>
    settled.get(questionId) ?? "loading";
  const changed = () => {
    for (const listener of listeners) listener();
  };

  const ready = (itemId: string) => {
    const questionId = questionOf.get(itemId);
    if (questionId === undefined || itemStatus(itemId) !== "pending") return;
    items.set(itemId, "ready");
    const all = itemsOf.get(questionId) ?? [];
    if (questionStatus(questionId) === "loading" && all.every((id) => itemStatus(id) === "ready")) {
      settled.set(questionId, "visible");
      events.onVisible(questionId);
    }
    changed();
  };

  return {
    readyFor: (itemId) => {
      const existing = callbacks.get(itemId);
      if (existing !== undefined) return existing;
      const callback = () => ready(itemId);
      callbacks.set(itemId, callback);
      return callback;
    },
    fail: (itemId, error) => {
      const questionId = questionOf.get(itemId);
      if (questionId === undefined || itemStatus(itemId) === "failed") return;
      items.set(itemId, "failed");
      if (questionStatus(questionId) !== "failed") {
        settled.set(questionId, "failed");
        events.onFailed(questionId, itemId, error);
      }
      changed();
    },
    itemStatus,
    questionStatus,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
