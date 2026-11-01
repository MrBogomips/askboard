// The draft record (design decisions 7 and 8, AD-20): what the user has changed on each item and
// not yet sent. Components keep no edit state of their own (AD-9): they read their item's value
// from here and put each change back, and nothing leaves the view until "Answer". An item holds
// one value of its component's own type, or none while it is untouched: a widget puts `undefined`
// back when its edits return to the agent's content. Each change makes a new record; E1 does not
// mirror it to the board page (open question 5).

/** Each item's value, by item ID; an untouched item has no entry. */
export type DraftRecord = ReadonlyMap<string, unknown>;

export type DraftStore = {
  /** An item's value: the same value until it changes, and undefined while unset. */
  valueOf(itemId: string): unknown;
  /** Puts in an item's value; `undefined` removes it. */
  set(itemId: string, value: unknown): void;
  record(): DraftRecord;
  subscribe(listener: () => void): () => void;
};

// Choice's option labels compare by element, as it makes a new array for each change; a widget's
// value by identity, since its model returns the same value for an edit that changes nothing.
const same = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((element, index) => Object.is(element, b[index]))
    : Object.is(a, b);

// An array goes in as a frozen copy, as E1's labels did; any other value as it is.
const held = (value: unknown): unknown =>
  Array.isArray(value) ? Object.freeze([...value]) : value;

export const createDraftStore = (): DraftStore => {
  // A Map, so that an item ID such as `__proto__` is a key like any other.
  let current: DraftRecord = new Map();
  const listeners = new Set<() => void>();
  const read = (itemId: string) => current.get(itemId);
  return {
    valueOf: read,
    set: (itemId, value) => {
      if (same(read(itemId), value)) return;
      const next = new Map(current);
      if (value === undefined) next.delete(itemId);
      else next.set(itemId, held(value));
      current = next;
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
