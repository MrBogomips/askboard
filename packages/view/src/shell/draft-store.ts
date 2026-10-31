// The draft record (design decision 8, AD-20): what the user has chosen on each item and not yet
// sent. Components keep no edit state of their own (AD-9): they read their item's value from here
// and put each change back, and nothing leaves the view until "Answer". Each change makes a new
// record; E1 does not mirror it to the board page (open question 5).

/** The chosen option labels, by item ID. */
export type DraftRecord = ReadonlyMap<string, readonly string[]>;

export type DraftStore = {
  /** An item's value: the same array until it changes, and one shared empty value when unset. */
  valueOf(itemId: string): readonly string[];
  set(itemId: string, value: readonly string[]): void;
  record(): DraftRecord;
  subscribe(listener: () => void): () => void;
};

const NOTHING: readonly string[] = Object.freeze([]);

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((label, index) => label === b[index]);

export const createDraftStore = (): DraftStore => {
  // A Map, so that an item ID such as `__proto__` is a key like any other.
  let current: DraftRecord = new Map();
  const listeners = new Set<() => void>();
  const read = (itemId: string) => current.get(itemId) ?? NOTHING;
  return {
    valueOf: read,
    set: (itemId, value) => {
      if (same(read(itemId), value)) return;
      current = new Map(current).set(itemId, Object.freeze([...value]));
      for (const listener of listeners) listener();
    },
    record: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
